//models/prefixes.js
const mongoose = require("mongoose");
const prefixesSchema = new mongoose.Schema({
  pre: String,
  maxNum: Number,
  prePre: String,
  studio: String,
  is3Digits: Boolean,
  isDmb: Boolean,
});

module.exports = mongoose.model("Prefixe", prefixesSchema);
