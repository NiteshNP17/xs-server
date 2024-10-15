//models/labels.js
const mongoose = require("mongoose");
const labelsSchema = new mongoose.Schema({
  label: String,
  maxNum: Number,
  prefix: String,
  imgPre: String,
  name: String,
  is3digits: Boolean,
  isHq: Boolean,
  isDmb: Boolean,
  isVr: Boolean,
});

module.exports = mongoose.model("Label", labelsSchema);
