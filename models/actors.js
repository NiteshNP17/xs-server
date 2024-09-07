//models/actors.js
const mongoose = require("mongoose");
const actorsSchema = new mongoose.Schema({
  slug: { type: String, unique: true },
  name: String,
  dob: String,
  height: Number,
  img500: String,
});

actorsSchema.pre("save", function (next) {
  if (!this.slug) {
    // Get the ObjectId as a string
    const idString = this._id.toString();
    // Extract 4 characters starting from the 6th character
    this.slug = idString.substring(4, 9);
  }
  next();
});

module.exports = mongoose.model("Actor", actorsSchema);
