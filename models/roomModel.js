const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    members: [String],
    title: { type: String, required: true, unique: true },
    tags: [String],
    banner: { type: Object },
    author: { type: String, required: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Room = mongoose.model("Rooms", roomSchema);
module.exports = { Room };
