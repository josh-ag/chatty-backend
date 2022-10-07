const express = require("express");
const passport = require("passport");
const route = express.Router();

const {
  getProfile,
  updateProfile,
  login,
  register,
  resetPassword,
  verifyAccount,
} = require("../controller/userController");

//USER ROUTE
route.route("/login").post(login);
route.route("/register").post(register);
route.route("/profile").get(passport.authenticate("jwt"), getProfile);
route.route("/:id").put(passport.authenticate("jwt"), updateProfile);
route.route("/password/reset").post(resetPassword);
route.route("/account/verify").put(verifyAccount);

module.exports = route;
