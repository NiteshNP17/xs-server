//models/actors.js
const mongoose = require("mongoose");
const actorsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      index: true, // For name sorting
    },
    jpName: {
      type: String,
      index: false, // For name sorting
    },
    dob: {
      type: String,
      index: true, // For date of birth sorting
    },
    cup: {
      type: String,
      index: true, // For date of birth sorting
      length: 1,
    },
    sizes: {
      bust: {
        type: Number,
        min: 20,
        max: 200,
      },
      waist: {
        type: Number,
        min: 20,
        max: 200,
      },
      hips: {
        type: Number,
        min: 20,
        max: 200,
      },
    },
    height: {
      type: Number,
      index: true, // For height sorting
    },
    img500: String,
    rebdSrc: String,
    latestMovieDate: String,
    numMovies: {
      type: Number,
      default: 0,
      min: 0, // Ensure numMovies is never negative
    }, // Add this field
    ageAtLatestRel: {
      type: Number,
      default: null,
    },
    order: {
      type: Number,
      default: 99999.0,
    },
  },
  {
    // Add compound indexes for more complex sorting scenarios
    indexes: [
      { name: 1 }, // Ascending name sort
      { height: -1 }, // Descending height sort
      { dob: 1 }, // Ascending date of birth
      { cup: -1 }, // Ascending date of birth
      // If you often sort by movie count or years active, you might want to add placeholders for those
      { numMovies: -1 },
      { yearsActive: 1 },
      { ageAtLatestRel: 1 }, // Add index for the new field
      { order: 1 }, // Add index for the new field
    ],
  }
);

module.exports = mongoose.model("Actor", actorsSchema);
