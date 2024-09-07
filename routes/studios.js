//routes/studios.js
const express = require("express");
const router = express.Router();
const Studios = require("../models/studios"); // Adjust the path as needed
const Movies = require("../models/movies"); // Adjust the path as needed

router.get("/", async (req, res) => {
  try {
    const studList = await Studios.find().sort({ rank: 1 });
    res.json(studList);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:studioSlug", async (req, res) => {
  try {
    const studioSlug = req.params.studioSlug;

    // Find the studio by slug
    const studio = await Studios.findOne({ slug: studioSlug });

    if (!studio) {
      return res.status(404).json({ message: "Studio not found" });
    }

    // Create a regex pattern for each label
    const labelPatterns = studio.labels.map((label) => new RegExp(`^${label}`));

    //pagination
    const page = parseInt(req.query.page) || 1; // Get the page number from the query string, default to 1
    const limit = 24; // Number of entries per page

    // Find movies with codes starting with any of the labels
    const filter = { code: { $in: labelPatterns } };
    const totalMovies = await Movies.countDocuments(filter);
    const movies = await Movies.find(filter)
      .sort({ release: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      movies,
      currentPage: page,
      totalPages: Math.ceil(totalMovies / limit),
      totalMovies,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
