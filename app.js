const express = require("express");
require("dotenv").config();
const path = require("path");
const http = require("http");
const userRoute = require("./routes/userRoute");
const PORT = process.env.PORT || 5050;
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const db = require("./services/db");
const passport = require("passport");
const cookieSession = require("cookie-session");
const bodyParser = require("body-parser");

require("./services/authProvider").localStrategy;
require("./services/authProvider").googleStrategy;
require("./services/authProvider").jwtStrategy;

//init express
const app = express();
//allow same origin sharing
app.use(require("cors")());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.use(express.static(path.join(__dirname, "public")));

//middlewares
app.set("trust proxy", 1); // trust first proxy
app.use(require("cookie-parser")());
app.use(
  cookieSession({
    keys: process.env.JWT_SECRET,
    maxAge: 24 * 60 * 60 * 1000,
  })
);

app.use(passport.initialize());
app.use(passport.session());

//create server
const server = http.createServer(app);

//init socket
const io = new Server(server);

//route handler
app.use("/api/user", userRoute);

io.on("connection", (socket) => {
  //LISTEN TO WHEN USER CONNECTS
  socket.on("join", (data) => {
    socket.broadcast.emit(`new ${data.room} member`, data);
  });

  socket.on("disconnect", (socket) => {
    io.sockets.emit("offline", {
      id: socket.id,
      status: "disconnected",
    });
  });

  socket.on("chat message", (msg) => {
    io.emit("message", msg);
  });

  //listen for typing event
  socket.on("typing", () => {
    socket.broadcast.emit("typing", socket.id);
  });
});

mongoose.connect(
  db.mongodb,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
  () => console.log("Db connected")
);

server.listen(PORT, () => console.log("Server Started On Port: ", PORT));
