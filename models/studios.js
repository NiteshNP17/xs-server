// models/studios.js
const mongoose = require("mongoose");

const studiosSchema = new mongoose.Schema({
  slug: String,
  name: String,
  labels: Array,
  rank: Number,
});

studiosSchema.pre("save", function (next) {
  if (!this.slug) {
    // Get the ObjectId as a string
    const idString = this._id.toString();
    // Extract 4 characters starting from the 6th character
    this.slug = idString.substring(5, 9);
  }
  next();
});

module.exports = mongoose.model("Studio", studiosSchema);
