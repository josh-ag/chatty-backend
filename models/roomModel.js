const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    roomId: { type: String, required: true, unique: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

const Rooms = mongoose.model("Rooms", roomSchema);
module.exports = { Rooms };
