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

  try {
    //find user
    const user = await Users.findOne({ email });

    if (!user) {
      return res
        .status(400)
        .json({ message: "User not found", statusCode: 400 });
    }

    //compire password
    if (!compareSync(password, user.password)) {
      return res
        .status(400)
        .json({ message: "Incorrect password", statusCode: 400 });
    }

    //gen token

    const token = genToken(user.id);
    //send token
    res.status(200).json({
      id: user.id,
      message: "Login Succeeded",
      token,
    });
  } catch (error) {
    throw new Error(error);
  }
};

/*



@desc - REGISTER USER
@method - POST
@access - PUBLIC
*/
const register = async (req, res) => {
  const { firstname, lastname, email, username, password } = req.body;

  //check if username already taken
  const isUsernameTaken = await Users.findOne({ username });
  if (isUsernameTaken) {
    return res.status(400).json({
      statusCode: 400,
      message: "Username is taken",
    });
  }

  //check if email already used/registered
  const isEmailUsed = await Users.findOne({ email });
  if (isEmailUsed) {
    return res.status(400).json({
      statusCode: 400,
      message: "Email already used",
    });
  }

  //hash user password
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  async.waterfall(
    [
      //gen token
      (done) => {
        crypto.randomBytes(3, (err, buffer) => {
          if (err) throw err;
          const token = buffer.toString("hex");
          console.log(token);
          done(err, token);
        });
      },

      (token, done) => {
        //CREATE ACCOUNT
        const newUser = new Users({
          firstname,
          lastname,
          email,
          username,
          password: hash,
          verifyCode: token,
        });

        newUser
          .save()
          .then((user) => {
            done(null, token, user);
          })
          .catch((error) => done(error, null, null));
      },

      (token, user, done) => {
        console.log("new User: ", user);

        res.status(201).json({
          message: "registration successful. Pls confirm your email",
          statusCode: 201,
        });

        //send user a registration email with verify email
        const Transporter = nodeMailer.createTransport({
          host: process.env.MAIL_HOST,
          port: 587,
          auth: {
            user: "apikey",
            pass: process.env.SEND_GRID_PASSWORD,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        const HTMLOption = `
        <main>
          <h2>New User Notice</h2>
          <h6>We are thrilled to have you here, ${user.username}!</h6>
          <br/>
          
        <p>Use the below link to verify your account to unlock full features</p>
        <a href="http://${req.headers.host}/account/verify?email=${
          user.email
        }&token=${token}">Verify Email</a>
        <p>Verification Code:<b>${token.toString()}</b></p>
        </main>
    `;

        const mailOptions = {
          to: user.email,
          from: process.env.SENDER_EMAIL,
          subject: "New User Notice",
          text: `We are thrilled to have you here, ${user.username}!\n\nPls use the below link to verify your account\n\n<a href="http://${req.headers.host}/account/verify?email=${user.email}&token=${token}">Verify Email</a>\n\nVerification Code: ${token}`,
          html: HTMLOption,
        };

        //send mail
        Transporter.sendMail(mailOptions);
      },
    ],
    (err) => {
      //In case of other errors
      throw new Error(err);
    }
  );
};

/*

@desc - VERIFY USER ACC
@method - GET
@access - PUBLIC
*/
const verifyAccount = async (req, res) => {
  const { email, token } = req.body;

  if (!email || !token) {
    return res.status(400).json({
      statusCode: 400,
      message: "Invalid  or broken link. Check the link and try again",
    });
  }

  const user = await Users.findOne({ email });

  if (!user) {
    return res.status(400).json({
      statusCode: 400,
      message: "Email not registered",
    });
  }

  //check if email is already verified
  if (user && user.verified) {
    return res.status(200).json({
      statusCode: 200,
      message: "Email already verified",
    });
  }

  console.log(token);
  console.log(user.verifyCode);
  //check if code is match
  if (token.toString() !== user.verifyCode) {
    return res.status(400).json({
      statusCode: 400,
      message: "invalid or token has expired",
    });
  }

  //verify account
  await Users.findOneAndUpdate(
    { email },
    { verified: true, verifyCode: "" },
    { updated: true }
  );

  res.status(201).json({
    statusCode: 201,
    message: "verification successful",
  });
};

/*



@desc - RESET USER PASSWD
@method - POST
@access - PUBLIC
*/
const resetPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      statusCode: 400,
      message: "No email was provided",
    });
  }

  async.waterfall(
    [
      //GEN TOKEN
      (done) => {
        crypto.randomBytes(12, (err, buffer) => {
          const token = buffer.toString("hex");
          console.log(token);
          done(err, token);
        });
      },

      //FIND USER WITH THIS EMAIL
      (token, done) => {
        Users.findOne({ email })
          .then((user) => {
            if (!user) {
              return res.status(400).json({
                statusCode: 400,
                message: "email not recognized",
              });
            }

            done(null, token, user);
          })
          .catch((err) => {
            throw new Error(err);
          });
      },

      //UPDATE USER RECORD
      //@desc- update user info with token
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

      //@desc- send token to user
      (token, user, done) => {
        res.status(201).json({
          statusCode: 201,
          message:
            "Instruction to reset your password has been sent to your email",
        });
        console.log("sending reset email...");

        //create mail transporter
        const Transporter = nodeMailer.createTransport({
          host: process.env.MAIL_HOST,
          port: 587,
          auth: {
            user: "apiKey",
            pass: process.env.SEND_GRID_PASSWORD,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        //html version of the email
        const HTMLOption = `
         <main> 
          <h2>Chatty Password Reset</h2>
          <h4>Hello ${user.username}! \nA request has been received to reset your chatty password</h4>
          <br/>
          <p>NOTE: If you do not initiate this request, please ignore this message and your password will remain Unchanged.</p>
          <br/>
           <a href="http://${req.headers.host}/auth/reset/?email=${user.email}?token=${token}">Reset Password</a>
          <br/>
          <p>Link expires in an hour time</p>
          <h2>Chatty Team!</h2>
        </main> 
    `;

        //create mail option
        const mailOptions = {
          from: process.env.SENDER_EMAIL,
          to: user.email,
          subject: "Chatty Password Reset",
          text: `Hello ${
            user.username
          }! \nYou recieve this message because you or someone else have requested for your chatty account password reset.\n\nCode: ${token.toUpperCase()}\nNOTE: If you do not initiate this request, please ignore this message and your password remain Unchanged.\n\nThank You,\nThe Chatty Team`,
          html: HTMLOption,
        };

        Transporter.sendMail(mailOptions, (err, info) => {
          if (err) {
            return res.status(500).json({
              statusCode: 500,
              message:
                "\nWe could not complete your request this time. Try later",
            });
          }

          if (info.response.includes("Ok")) {
            res.status(201).json({
              statusCode: 201,
              message:
                "Instruction to reset your password has been sent to your email",
            });
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
  const { token } = req.query;
  const { password, confirm } = req.body;

  const user = await Users.findOne({ email });

  if (!user) {
    //do something if no user
  }

  //is token expired
  if (user.resetPasswordExpires) {
    //do something
  }

  if (token !== user.resetPasswordToken) {
    //do something if token do not match
  }

  if (!password) {
    return res.status(400).json({
      message: "Enter new password",
      statusCode: 400,
    });
  }

  if (!confirm) {
    return res.status(400).json({
      message: "Confirm password is missing",
      statusCode: 400,
    });
  }

  if (password !== confirm) {
    return res.status(400).json({
      message: "Password do not match",
      statusCode: 400,
    });
  }

  //hash password
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  Users.findByIdAndUpdate({ _id: user.id }, { password: hash }, { new: true })
    .then(() => {
      res.statu(201).json({
        statusCode: 201,
        message: "new password set successfully",
      });
    })
    .catch((err) => {
      throw new Error(err);
    });
};

/*
Enter new password


@desc - GET USER PROFILE
@method - GET
@access - PRIVATE
*/
const getProfile = (req, res, next) => {
  res.status(200).json({ user: req.user });
};

/*


@desc - UPDATE USER PROFILE
@method - PUT
@access - PRIVATE
*/
const updateProfile = async (req, res, next) => {
  const { id } = req.params;

  const updated = await Users.findByIdAndUpdate({ _id: id }, req.body, {
    new: true,
  }).select("-password");

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
  newPassword,
  resetPassword,
  verifyAccount,
};
module.exports = userController;
