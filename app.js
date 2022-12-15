const express = require("express");
const corse = require("cors");
require("dotenv").config();
const http = require("http");
const routes = require("./routes/routes");
const PORT = process.env.PORT || 2022;
const { Server } = require("socket.io");
const { dbConn } = require("./config/db");
const passport = require("passport");
const bodyParser = require("body-parser");
const { errorHandler } = require("./middleware/errorMiddleware");
require("./services/authProvider").googleStrategy;
require("./services/authProvider").jwtStrategy;
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { Rooms } = require("./models/roomModel");
const { Users } = require("./models/userModel");

//init express
const app = express();

// MIDDLEWARES
//allow same origin sharing
app.use(corse());
//-momery unleaked---------
app.set("trust proxy", 1);

app.use(express.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    store: new MongoStore({
      mongoUrl: process.env.MONGO_URI,
    }),
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true, maxAge: 60000 },
  })
);

// init passport
app.use(passport.initialize());
app.use(passport.session());

//create http server instance
const server = http.createServer(app);

//route handler
app.use("/api", routes);
app.get("/", (req, res) => {
  res.status(200).json({ message: "Welcome! Chatty Web Server v.1" });
});
app.use(errorHandler);

//init socket
const io = new Server(server, {
  cors: {
    origin: "*",
    credentials: true,
    methods: ["GET", "POST"],
  },
});
/*
************************************
      SOCKET
************************************
*/
//all users in a room
let roomUsers = [];

let uniqueArray = (a) =>
  [...new Set(a.map((o) => JSON.stringify(o)))].map((s) => JSON.parse(s));
//all messages in a room
const roomMessages = [];

//add message
const addMessage = (message) => {
  roomMessages.push(message);
};
//get messages associated with room
const getMessages = (roomId) => {
  const messages = roomMessages.filter((message) => message.roomId === roomId);
  return messages;
};
//add user
const addUser = (userId, roomId, username) => {
  roomUsers.push({ userId, roomId, username });
};
//get users
const getRoomUsers = (roomId) => {
  let activeRoomUsers = roomUsers.filter((user) => user.roomId == roomId);
  //remove dublicates
  let uniqueArray = (a) =>
    [...new Set(a.map((o) => JSON.stringify(o)))].map((s) => JSON.parse(s));

  return uniqueArray(activeRoomUsers);
};

//@CREATE NEW ROOM
const createRoom = async (socket, roomInfo) => {
  //save room
  const createdRoom = await Rooms.create({
    name: roomInfo.name,
    roomId: roomInfo.roomId,
    authorId: roomInfo.userId,
  });

  if (!createdRoom) {
    return console.log("Something went wrong");
  }

  socket.emit("new-room", createdRoom);
};

//@desc - find room
const findRoom = async (socket, userData) => {
  //check if room is available
  const { roomId } = userData;
  const isRoomExist = await Rooms.findOne({ roomId });

  if (!isRoomExist) {
    return socket.emit("room-not-found", {
      message: "Room Not Found",
      status: 404,
    });
  }

  socket.emit("room-found", { success: true, status: 200 });
};

//@GET NEWLY JOINED USER
const getNewUser = async (socket, userData) => {
  const { roomId, userId } = userData;
  //find the user
  const user = await Users.findById({ _id: userId }).select("-password");

  if (!user) {
    console.log("user Dont Exist!");
    return;
  }

  socket.join(roomId);
  //add the user to roomUsers

  addUser(userId, roomId, user.username);
  //tell everyone else in the room of new user
  socket.to(roomId).emit("new-user", user.username);

  //emit to all users in the room with ID roomID
  io.to(roomId).emit("all-users", getRoomUsers(roomId));
};

//remove user
const userLeave = (userId, roomId) => {
  roomUsers = roomUsers.filter((user) => user.userId == userId);

  io.to(roomId).emit("all-users", getRoomUsers(roomId));
};

//@SOCKET CONNECTION
io.on("connection", (socket) => {
  console.log("New connection established!");

  //@CREATE ROOM
  socket.on("new-room", (data) => {
    createRoom(socket, data);
  });

  //@FOUNDS ROOM
  socket.on("find-room", (data) => {
    findRoom(socket, data);
  });

  //@LISTEN TO WHEN USER CONNECTS
  socket.on("join", (data) => {
    getNewUser(socket, data);

    //LISTEN FOR DISCONNECT
    socket.on("disconnect", async () => {
      //remove user
      socket.leave(data.roomId);
      userLeave(data.userId, data.roomId);
    });
  });

  //listen for typing event
  socket.on("typing", ({ username, roomId }) => {
    socket.to(roomId).emit("is-typing", `${username} is typing`);
  });

  //GET MESSAGE
  socket.on("message", ({ message, roomId, username, userId }) => {
    addMessage({ message, roomId, username, userId });
    //send message to users in the room
    io.to(roomId).emit("new-message", getMessages(roomId));
  });
});

//connect Db
dbConn();

server.listen(PORT, () => console.log("Server Started On Port: ", PORT));
