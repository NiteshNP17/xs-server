const mongoose = require("mongoose");

const tagsSchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
  },
});

module.exports = mongoose.model("Tag", tagsSchema);
