const { Users } = require("../models/userModel");
const nodeMailer = require("nodemailer");
const crypto = require("crypto");
const async = require("async");
const jwt = require("jsonwebtoken");
const { hashSync, compareSync, genSaltSync } = require("bcryptjs");

/*



@desc - LOGIN USER
@method - POST
@access - PUBLIC
*/
const login = async (req, res) => {
  const { email, password } = req.body;
  //find user
  const user = await Users.findOne({ email });

  if (!user) {
    return res.status(400).json({ message: "User not found", error: true });
  }

  //compire password
  if (!compareSync(password, user.password)) {
    return res.status(400).json({ message: "Incorrect password", error: true });
  }

  //gen token

  const token = genToken(user.id);
  //send token
  res.status(200).json({
    id: user.id,
    message: "Login Succeeded",
    token,
  });
};

/*



@desc - REGISTER USER
@method - POST
@access - PUBLIC
*/
const register = async (req, res) => {
  //get req body

  const { firstname, lastname, email, username, password } = req.body;

  //check if username is taken
  const isUserExist = await Users.findOne({ username });
  if (isUserExist) {
    return res.status(400).json({
      error: true,
      message: "Username is taken",
    });
  }

  //check if email already registered
  const isEmailUsed = await Users.findOne({ email });
  if (isEmailUsed) {
    return res.status(400).json({
      error: true,
      message: "Email already registered",
    });
  }

  //hash user password
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  async.waterfall(
    [
      //gen token
      (done) => {
        crypto.randomBytes(20, (err, buffer) => {
          if (err) throw err;
          const token = buffer.toString("hex");

          done(err, token);
        });
      },

      (token, done) => {
        //CREATE ACCOUNT
        Users.create(
          {
            firstname,
            lastname,
            email,
            username,
            password: hash,
          },
          (error, user) => {
            done(error, token, user);
          }
        );
      },

      (token, user, done) => {
        //send user a registration email with verify email
        const Transporter = nodeMailer.createTransport({
          host: process.env.MAIL_HOST,
          port: 587,
          auth: {
            user: process.env.SEND_GRID_USER,
            pass: process.env.SEND_GRID_PASSWORD,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        const HTMLOption = `
        <h2>Welcome To Chatty, ${user.username.toUpperCase()}!</h2>
        <main>
        <h6>We are glad to see you join us Today<br/>
        </h6>
        You're just a few step to completing your registration.
        Please click below link, or paste to your browser to complete the process:
       <p><b>Verify Your Email</b></p>
       <a href="http://${req.headers.host}/auth/verify?id=${
          user._id
        }&token=${token}>Verify Email</a>
        </main>
    `;

        const mailOptions = {
          to: user.email,
          from: process.env.SENDER_EMAIL,
          subject: "Chatty Registration Notification",
          text: `You are receiving this because you or someone just used your email to signup to the Chatty Commmunity`,
          html: HTMLOption,
        };

        //send mail
        Transporter.sendMail(mailOptions, (err, info) => {
          if (err) {
            console.error("Mail Sending Error: ", err);
            done(err, null);
          }

          res.status(201).json({
            success: true,
            message: "Registration successful",
            mailDeliveryInfo: info,
          });

          done(null, user);
        });
      },
    ],
    (err) => {
      //do stuff with error
    }
  );
};

/*



@desc - VERIFY USER ACC
@method - GET
@access - PRIVATE
*/
const accountVerification = async (req, res) => {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({
      status: 400,
      error: true,
      message: "Unknown Request Type",
    });
  }

  const user = await Users.findOne({ _id: req.params.id });

  if (!user) {
    return res.status(400).json({
      message: "Request Not Understood: No user found",
    });
  }

  //check if email is already verified
  if (user && user.emailVerified) {
    return res.status(201).json({
      statusCode: 201,
      success: true,
      message: "Email already verified",
    });
  }

  //verify user if not verified
  let query = { _id: req.params.id };
  let updatedUser = {};
  updatedUser.emailVerified = true;

  // //send update
  const updated = await Users.updateOne(query, updatedUser);

  if (updated) {
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: "Email verification successful",
    });
  }
};

/*



@desc - PASSWD RECOVERY
@method - POST
@access - PUBLIC
*/
const resetPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      message: "Email field is required",
    });
  }

  async.waterfall(
    [
      //GEN TOKEN
      (done) => {
        crypto.randomBytes(20, (err, buffer) => {
          const token = buffer.toString("hex");
          done(err, token);
        });
      },

      //FIND USER WITH THIS EMAIL
      (token, done) => {
        Users.findOne({ email: email })
          .then((user) => {
            if (!user) {
              return res.status(400).json({
                statusCode: 400,
                error: true,
                message: "Sorry We do not this email",
              });
            }

            done(null, token, user);
          })
          .catch((err) => {
            res.status(500).json({
              statusCode: 500,
              error: true,
              message: "Server error: " + err.message,
            });
          });
      },

      //UPDATE USER RECORD
      //@desc- update user with token
      (token, user, done) => {
        Users.findByIdAndUpdate(
          { _id: user.id },
          {
            resetPasswordToken: token,
            resetPasswordExpires: new Date(Date.now() + 1 * (60 * 60 * 1000)), //1hr
          },
          { new: true }
        ).then((user) => {
          done(null, token, user);
        });
      },

      //SEND USER EMAIL
      //@desc- notify user via mail of his req with reset token
      (token, user, done) => {
        console.log("sending reset email...");
        console.log("Updated User: ", user);
        //create mail transporter
        const Transporter = nodeMailer.createTransport({
          host: "smtp.sendgrid.net",
          port: 587,
          auth: {
            user: process.env.SEND_GRID_USER,
            pass: process.env.SEND_GRID_PASSWORD,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        //html version of the email
        const HTMLOption = `
         <main> 
          <h2>Chatty Password Reset Request</h2>
          <h4>Hello ${user.username}! \nA request has been received to change the password for your Chatty account</h4>
          <br/>
          <a href="http://${req.headers.host}/auth/reset/${token}" style="color:#fff;padding:1rem;font-size:18px;font-weight:600;background-color:#4D4A95;text-decoration:none;width:120,display:block">Reset Password</a>
          <br/> <br/>
          <p>Link expires in an hour time</p>
          <p>NOTE: If you do not initiate this request, please ignore this message and your password remain Unchanged.</p>
          <br/>
          <h2>Thank You,<br/>The Chatty Team</h2>
        </main> 
    `;

        //create mail option
        const mailOptions = {
          from: process.env.SENDER_EMAIL,
          to: user.email,
          subject: "Chatty Password Reset Request",
          text: `Hello ${user.username}! \nYou recieve this message because you or someone else have requested for a reset in your Chatty password.\n\nFollow the link below to reset your password:\n http://${req.headers.host}/auth/reset/${token}\nLink expires in an hour time.\nNOTE: If you do not initiate this request, please ignore this message and your password remain Unchanged.\n\nThank You,\nThe Chatty Team`,
          html: HTMLOption,
        };

        Transporter.sendMail(mailOptions, (err, info) => {
          if (err) {
            return res.status(500).json({
              statusCode: 500,
              error: true,
              message: "Server error: " + "\nSomething went wrong. Try later",
            });
          }

          if (info.response.includes("Ok")) {
            res.status(201).json({
              statusCode: 201,
              success: true,
              message: "Reset instruction has been sent. Check your email",
            });

            console.log("Email Send...");
            done(err, info);
          }
        });
      },
    ],
    (err) => {
      res.status(500).json({
        statusCode: 500,
        error: true,
        message: "Somethhing went wrong " + err.message,
      });
    }
  );
};

/*



@desc - SET NEW PASSWD
@method - POST
@access - PUBLIC
*/
const newPassword = async (req, res) => {
  const { password, confirm } = req.body;

  if (!password || password === "") {
    return res.render("resetPassword", {
      message: "Enter new password",
      statusCode: 400,
      error: true,
    });
  }

  if (!confirm || confirm === "") {
    return res.render("resetPassword", {
      message: "Confirm password do not match",
      statusCode: 400,
      error: true,
    });
  }

  if (password !== confirm) {
    return res.render("resetPassword", {
      message: "Password do not match",
      statusCode: 400,
      error: true,
      password,
      confirm,
    });
  }
};

/*



@desc - GET USER PROFILE
@method - GET
@access - PRIVATE
*/
const getProfile = (req, res, next) => {
  res.status(200).json({ user: req.user });
};

/*


@desc - UPDATE YOUR PROFILE
@method - PUT
@access - PRIVATE
*/
const updateProfile = async (req, res, next) => {
  const updated = await Users.findByIdAndUpdate(
    { _id: req.params.id },
    req.body,
    { new: true }
  ).select("-password");

  res.status(201).json({ message: "Update applied", user: updated });
};

//gen auth token
const genToken = (id) => {
  const token = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });

  return token;
};

const userController = {
  getProfile,
  updateProfile,
  login,
  register,
  resetPassword,
};
module.exports = userController;
