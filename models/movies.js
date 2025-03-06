//models/movies.js
const mongoose = require("mongoose");

const moviesSchema = new mongoose.Schema({
  code: String,
  title: String,
  cast: [{ type: mongoose.Schema.Types.ObjectId, ref: "Actor" }],
  maleCast: Array,
  release: String,
  runtime: Number,
  tags: Array,
  tag2: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],
  opt: Array,
  series: { type: mongoose.Schema.Types.ObjectId, ref: "Serie" },
  overrides: {
    cover: String,
    preview: String,
  },
});

module.exports = mongoose.model("Movie", moviesSchema);
