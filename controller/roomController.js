const { Rooms } = require("../models/roomModel");
const getRoom = async (req, res) => {
  const { roomId } = req.params;

  const roomInfo = await Rooms.findOne({
    roomId: roomId,
  });

  if (!roomInfo) {
    return res.status(404).json({ message: "Room Not Found", statusCode: 404 });
  }

  return res.status(200).json({
    roomId: roomInfo.roomId,
    name: roomInfo.name,
    authorId: roomInfo.authorId,
  });
};

module.exports = { getRoom };
