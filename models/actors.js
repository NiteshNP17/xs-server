//models/actors.js
const mongoose = require("mongoose");
const actorsSchema = new mongoose.Schema({
  name: String,
  dob: String,
  height: Number,
  img500: String,
});

module.exports = mongoose.model("Actor", actorsSchema);
