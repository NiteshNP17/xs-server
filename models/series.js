// models/series.js
const mongoose = require("mongoose");

const seriesSchema = new mongoose.Schema({
  slug: { type: String, unique: true },
  name: String,
  studio: String,
  thumbs: String,
});

seriesSchema.pre("save", function (next) {
  if (!this.slug) {
    // Get the ObjectId as a string
    const idString = this._id.toString();
    // Extract 4 characters starting from the 6th character
    this.slug = idString.substring(4, 9);
  }
  next();
});

module.exports = mongoose.model("Serie", seriesSchema);
