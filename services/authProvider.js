const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20");
const { Users } = require("../models/userModel");

//Passport-Jwt config
const JwtStrategy = require("passport-jwt").Strategy;
const extractJwt = require("passport-jwt").ExtractJwt;
const opts = {};

opts.jwtFromRequest = extractJwt.fromAuthHeaderAsBearerToken();
opts.secretOrKey = process.env.JWT_SECRET;

//JWT STRATEGY
const jwtStrategy = passport.use(
  new JwtStrategy(opts, (jwt_payload, done) => {
    Users.findById({ _id: jwt_payload.id }, async (err, user) => {
      if (err) {
        return done(null, false, { message: err.message });
      }

      if (!user) {
        return done(null, false, { message: "Account doesn't exist" });
      }

      done(null, user);
    }).select("-password");
  })
);

//GOOGLE STRATEGY
const googleStrategy = passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENTID,
      clientSecret: process.env.Google_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      Users.findOne({ id: profile.id }).then((existingUser) => {
        if (existingUser) {
          // we already have a record with the given profile ID
          done(null, existingUser);
        } else {
          // we don't have a user record with this ID, make a new record!
          new Users({ id: profile.id }).save().then((user) => done(null, user));
        }
      });
    }
  )
);

//serialize and deserialize user
//@desc: this make sure user stay loggedIn while navigating through the app
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  Users.findById(id, (err, user) => {
    done(err, user);
  }).select("-password");
});

module.exports = {
  googleStrategy,
  jwtStrategy,
};
