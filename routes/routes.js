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
  newPassword,
  uploadProfile,
} = require("../controller/userController");

/*

      /=======================
              Auth
      /=======================
*/

route.route("/auth/login").post(login);
route.route("/auth/register").post(register);
route.route("/auth/verify").put(verifyAccount);
route.route("/auth/password/reset").post(resetPassword);
route.route("/auth/password/new").put(newPassword);
route.route("/auth/google").get(
  getProfile,
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);
route.route("/auth/google/callback").get((req, res) => {
  console.log(res);
}, passport.authenticate("google"));

/*

          /=======================
                  USER ROUTE
          /=======================
*/
route.route("/user/profile/:id").get(passport.authenticate("jwt"), getProfile);
route.route("/user/:id").put(passport.authenticate("jwt"), updateProfile);

route
  .route("/user/profile/upload")
  .post(passport.authenticate("jwt"), uploadProfile);

module.exports = route;
