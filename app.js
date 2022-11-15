const express = require("express");
require("dotenv").config();
const http = require("http");
const Routes = require("./routes/routes");
const PORT = process.env.PORT || 5050;
const { Server } = require("socket.io");
const { dbConn } = require("./config/db");
const passport = require("passport");
const bodyParser = require("body-parser");
const corse = require("cors");
const { errorHandler } = require("./middleware/errorMiddleware");
require("./services/authProvider").googleStrategy;
require("./services/authProvider").jwtStrategy;
const session = require("express-session");

//init express
const app = express();
//allow same origin sharing
app.use(corse());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true },
  })
);

// init passport
app.use(passport.initialize());
app.use(passport.session());

//create server
const server = http.createServer(app);

//init socket
const io = new Server(server);

//route handler
app.use("/api", Routes);
app.get("/", (req, res) => {
  res.status(200).json({ message: "Welcome To Chatty Web Server!" });
});
app.use(errorHandler);

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

//connect Db
dbConn();
app.listen(PORT, () => console.log("Server Started On Port: ", PORT));
