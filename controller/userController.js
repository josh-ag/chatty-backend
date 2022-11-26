const { Users } = require("../models/userModel");
const cloudinary = require("../services/cloudinary");
const jwt = require("jsonwebtoken");
const { hashSync, compareSync, genSaltSync } = require("bcryptjs");
const { sendEmail } = require("../services/sendEmailProvider");

/*
=====================================================
        @desc - LOGIN USER
        @method - POST
        @access - PUBLIC
=====================================================
*/
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    //find user
    const user = await Users.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", statusCode: 404 });
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

=====================================================
        @desc - REGISTER USER
        @method - POST
        @access - PUBLIC
=====================================================
*/
const register = async (req, res) => {
  const { firstname, lastname, email, username, password } = req.body;

  try {
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

    //gen token
    const code = genCode(6);

    //CREATE ACCOUNT
    const newUser = await Users.create({
      firstname,
      lastname,
      email,
      username,
      password: hash,
      verifyCode: code,
    });

    if (!newUser) {
      return res.status(500).json({
        message: "Something went wrong. We're fixing it at the moment",
      });
    }

    await sendEmail(
      newUser,
      "Welcome To Chatty",
      `<p>We're thrilled to have you be part of our community</p> <br/>To fully explore and enjoy all of the services and features we'll be providing you, please confirm your email address. <p>Your verifcation code is <b>${code}</p><br/><p>Alternatively, you can click the link below to verify your account. </p><a style="padding:10;border-radius:16;background-color:#07ABFC;font-size:18px;font-weight:400;color:#fff;text-decoration:none;font-family:"Roboto Condensed"" href="https://chatty-web-app.netlify.app/account_verification">Verify</a>`
    );

    res.status(201).json({
      statusCode: 201,
      message: "Account created successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Server is having trouble understanding your request this time",
      statusCode: 500,
      error,
    });
  }
};

/*
=======================================
      @desc - VERIFY USER ACC
      @method - GET
      @access - PUBLIC
========================================
*/
const verifyAccount = async (req, res) => {
  const { verifyCode } = req.body;

  try {
    if (!verifyCode) {
      return res.status(400).json({
        statusCode: 400,
        message: "Invalid or expired verification code",
      });
    }

    const user = await Users.findOne({ verifyCode });

    if (!user) {
      return res.status(404).json({
        statusCode: 404,
        message: "Verification code is incorrect",
      });
    }

    //check if email is already verified
    if (user && user?.verified) {
      return res.status(200).json({
        statusCode: 200,
        message: "Email already verified",
      });
    }

    //verify account
    await Users.findOneAndUpdate(
      { verifyCode },
      { verified: true, verifyCode: "" },
      { updated: true }
    );

    res.status(200).json({
      statusCode: 200,
      message: "Your account has been verified",
    });
  } catch (err) {
    res.status(500).json({
      message: "Sorry, server unable to perform this action at the moment",
      statusCode: 500,
    });
  }
};

/*
=====================================
      @desc - RESET USER PASSWD
      @method - POST
      @access - PUBLIC
=====================================
*/
const resetPassword = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({
        statusCode: 400,
        message: "Email was not provided",
      });
    }

    //check if user with this email exist
    const user = await Users.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "Email not recognized",
        statusCode: 404,
      });
    }

    //Gen. resetCode
    const resetCode = genCode(6);

    const updatedUser = await Users.findByIdAndUpdate(
      { _id: user.id },
      {
        resetPasswordToken: resetCode,
        resetPasswordExpires: new Date(Date.now() + 1 * (60 * 60 * 1000)), //1hr
      },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      res.status(500).json({
        statusCode: 500,
        message:
          "Server is currently busy and cant your request this time. try later",
      });
    }

    await sendEmail(
      updatedUser,
      "Password Reset Request",
      `<p>
       Either you or someone else has requested for a Password Reset with your chatty account.
      </p><p>Your Reset Code is: <b>${resetCode}</b><br/>Be informed this code expires in 1hr time.</p>
      
      <p>NOTE: If you do not initiate this request, please ignore this message and your password will remain Unchanged.</p>`
    );

    res.status(200).json({
      statusCode: 200,
      message: "Email sent. Pls check your email",
    });
  } catch (err) {
    res.status(500).json({
      message: "Sorry we re unable to send email at the moment. Try later",
      statusCode: 500,
    });
  }
};

/*

=====================================================
          @desc - SET NEW PASSWD
          @method - PUT
          @access - PUBLIC
=====================================================
*/
const newPassword = async (req, res) => {
  const { password, resetCode } = req.body;
  try {
    if (!password) {
      return res.status(400).json({
        message: "Enter new password",
        statusCode: 400,
      });
    }

    if (!resetCode) {
      return res.status(400).json({
        message: "Provide reset code sent to your email",
        statusCode: 400,
      });
    }

    const user = await Users.findOne({ resetPasswordToken: resetCode });

    //do something token notMatch||Invalid||noToken
    if (!user) {
      return res.status(404).json({
        message: "Reset code do not match or invalid",
      });
    }
    //is token expired
    if (user.resetPasswordExpires) {
      //do something
    }

    //hash password
    const salt = genSaltSync(10);
    const hash = hashSync(password, salt);

    const updatedUser = await Users.findByIdAndUpdate(
      { _id: user.id },
      { password: hash, resetPasswordToken: "" },
      { new: true }
    );
    if (!updatedUser) {
      //do something ....
    }

    res.status(200).json({
      message: "New password set successfully",
      statusCode: 200,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server unable to perform the action at the moment. Try later",
    });
  }
};

/*
=====================================================
          @desc - GET USER PROFILE
          @method - GET
          @access - PRIVATE
=====================================================
*/
const getProfile = (req, res, next) => {
  res.status(200).json({ user: req.user });
};

/*

=====================================================
          @desc - UPDATE USER PROFILE
          @method - PUT
          @access - PRIVATE
=====================================================
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

//Gen auth codes
const genCode = (length) => {
  let result = "";
  const chars = "0123456789";
  const charsLength = chars.length;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * charsLength));
  }

  return result;
};

/*

=====================================================
          @desc - UPLOAD PROFILE PICTURE
          @method - POST
          @access - PRIVATE
=====================================================
*/
const uploadProfile = async (req, res) => {
  const { uploads } = req.body;

  const options = {
    use_filename: false,
    unique_filename: true,
    overwrite: true,
  };

  try {
    // Upload the image
    const result = await cloudinary.uploader.upload(uploads, options);

    if (!result)
      return res.status(500).json({
        message: "Something went wrong from our end",
        statusCode: 500,
      });
    //update user info
    const updatedUser = await Users.findByIdAndUpdate(
      { _id: req.user._id },
      { profilePicture: { id: result.public_id, url: result.secure_url } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(400).json({
        statusCode: 404,
        message: "No user was found",
      });
    }

    res.status(201).json({
      statusCode: 201,
      message: "new profile picture set successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong from our end",
      statusCode: 500,
      stack: error.message,
    });
  }
};

const userController = {
  getProfile,
  updateProfile,
  login,
  register,
  newPassword,
  resetPassword,
  verifyAccount,
  uploadProfile,
};
module.exports = userController;
