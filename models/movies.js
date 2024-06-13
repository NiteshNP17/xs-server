const mongoose = require("mongoose");

const moviesSchema = new mongoose.Schema({
  code: String,
  title: String,
  cast: Array,
  maleCast: Array,
  release: String,
  runtime: Number,
  tags: Array,
  opt: Array,
  series: String,
  overrides: {
    cover: String,
    preview: String,
  },
});

module.exports = mongoose.model("Movie", moviesSchema);
