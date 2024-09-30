//models/labels.js
const mongoose = require("mongoose");
const labelsSchema = new mongoose.Schema({
  label: String,
  maxNum: Number,
  prefix: String,
  name: String,
  isHq: Boolean,
  isDmb: Boolean,
});

module.exports = mongoose.model("Label", labelsSchema);
