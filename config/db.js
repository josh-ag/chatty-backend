const mongoose = require("mongoose");
const connString =
  process.env.NODE_ENV === "production"
    ? process.env.MONGO_URI
    : process.env.MONGO_LOCAL;

const dbConn = async () => {
  let conn;

  try {
    //connect to mongodb
    conn = await mongoose.connect(connString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connection to DB succeeded...->", conn.connection.host);
  } catch (err) {
    console.log("Mongo Error: ", err.message);
  }
};

module.exports = { dbConn, connString };
