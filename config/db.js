const mongoose = require("mongoose");

const dbConn = async () => {
  let conn;
  const connString =
    process.env.NODE_ENV === "production"
      ? process.env.MONGO_URI
      : process.env.MONGO_LOCAL;

  try {
    conn = await mongoose.connect(connString);

    console.log(`Db Connected @${conn.connection.host}`);
  } catch (err) {
    console.log("Mongo Error: ", err.message);
  }
};

module.exports = { dbConn };
