//routes/series.js
const express = require("express");
const router = express.Router();
const Series = require("../models/series");
const Movies = require("../models/movies"); // Adjust the path as needed

router.get("/", async (req, res) => {
  try {
    let filterCondition = req.query.studio ? { studio: req.query.studio } : {};
    let aggregationPipeline = [
      { $match: filterCondition },
      {
        $lookup: {
          from: "movies",
          localField: "_id",
          foreignField: "series",
          as: "movies",
        },
      },
      {
        $project: {
          _id: 1,
          slug: 1,
          name: 1,
          studio: 1,
          thumbs: 1,
          movieCount: { $size: "$movies" },
          movieCodes: {
            $slice: ["$movies.code", 3],
          },
        },
      },
      {
        $sort: { movieCount: -1, _id: 1 },
      },
    ];

    let responseData = {};

    if (req.query.page) {
      const page = parseInt(req.query.page);
      const limit = 12;
      const skip = (page - 1) * limit;

      const totalSeries = await Series.countDocuments(filterCondition);
      const totalPages = Math.ceil(totalSeries / limit);

      aggregationPipeline.push({ $skip: skip }, { $limit: limit });

      responseData = {
        currentPage: page,
        totalPages: totalPages,
        limit: limit,
      };
    }

    const seriesList = await Series.aggregate(aggregationPipeline);

    responseData.data = seriesList;
    res.json(responseData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/list", async (req, res) => {
  const query = req.query.q;
  try {
    const seriesList = await Series.find({
      name: { $regex: query, $options: "i" },
    });
    res.json(seriesList);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const newSeries = new Series(req.body);

    const savedSeries = await newSeries.save();
    res.status(201).json(savedSeries);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const updateData = req.body;

    const updatedSeries = await Series.findOneAndUpdate(
      { slug: slug },
      { $set: updateData },
      { new: true }
    );

    if (!updatedSeries) {
      return res.status(404).json({ message: "Series not found" });
    }

    res.json(updatedSeries);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/:slug", async (req, res) => {
  const dataOnly = req.query.type == "dataonly";
  let movies;
  try {
    // First, find the series by slug
    const series = await Series.findOne({ slug: req.params.slug });

    if (!series) {
      return res.status(404).json({ message: "Series not found" });
    }

    // Then, find all movies associated with this series
    if (!dataOnly) {
      movies = await Movies.find({ series: series._id }).sort({
        release: -1,
      }); // Sort by release date, newest first
    }

    res.json(
      dataOnly
        ? series
        : {
            seriesName: series.name,
            movies: movies,
            totalMovies: movies.length,
          }
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
