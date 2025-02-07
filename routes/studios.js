//routes/studios.js
const express = require("express");
const router = express.Router();
const Studios = require("../models/studios"); // Adjust the path as needed
const Movies = require("../models/movies"); // Adjust the path as needed

router.get("/", async (req, res) => {
  try {
    const result = await Studios.aggregate([
      // Lookup to count movies for each studio
      {
        $lookup: {
          from: "movies", // Ensure this matches your movies collection name
          let: { studioLabels: "$labels" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $anyElementTrue: [
                    {
                      $map: {
                        input: "$$studioLabels",
                        as: "label",
                        in: {
                          $regexMatch: {
                            input: "$code",
                            regex: { $concat: ["^", "$$label"] },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
            { $count: "movieCount" },
          ],
          as: "movieCountArray",
        },
      },

      // Add a movieCount field
      {
        $addFields: {
          movieCount: {
            $ifNull: [{ $arrayElemAt: ["$movieCountArray.movieCount", 0] }, 0],
          },
        },
      },

      // Remove the temporary movieCountArray
      { $unset: "movieCountArray" },

      // Sort by movieCount in descending order
      { $sort: { movieCount: -1 } },
    ]);

    res.json(result);
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

router.post("/", async (req, res) => {
  try {
    req.body.labels = req.body.labels.split(",").map((label) => label.trim());
    const newStudio = new Studios(req.body);
    const savedStudio = await newStudio.save();
    res.status(201).json(savedStudio);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    req.body.labels = req.body.labels.split(",").map((label) => label.trim());

    const updatedStudio = await Studios.findOneAndUpdate(
      { slug: slug },
      { $set: req.body },
      { new: true }
    );

    if (!updatedStudio) {
      return res.status(404).json({ message: "Studio not found" });
    }

    res.json(updatedStudio);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
