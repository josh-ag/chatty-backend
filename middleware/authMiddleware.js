const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const { Users } = require("../models/userModel");

//@Desc - create middleware to validate protected endpoints
const isAuthenticated = asyncHandler(async (req, res, next) => {
  let token;
  try {
    //@desc - check if  auth token exist @headers
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    //@desc - Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Users.findById(decoded.id).select("-password");
    req.user = user;
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized, No token found" });
  }

  //if not token
  if (!token) {
    return res.status(401).json({ message: "Unauthorized, No token found" });
  }

  //call next middleware
  next();
});
