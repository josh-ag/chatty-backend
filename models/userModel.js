const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    rooms: [String],
    bios: { type: String },
    country: { type: String },
    phone: { type: Number },
    emailVerified: { type: Boolean, default: false },
    resetPassword: String,
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

const Users = mongoose.model("user", userSchema);

module.exports = {
  Users,
};
