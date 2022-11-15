const mongoose = require("mongoose");

const dbConn = async () => {
  try {
    console.log(process.env.MONGO_LOCAL);
    let conn;
    const connString =
      process.env.NODE_ENV === "production"
        ? process.env.MONGO_URI
        : process.env.MONGO_LOCAL;

    //connect to mongodb
    conn = mongoose.connect(connString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`Db Connected @${conn.connection.host}`);
  } catch (err) {
    console.log("Mongo Error: ", err.message);
  }
};

module.exports = { dbConn };
