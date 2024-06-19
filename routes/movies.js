//routes/movies.js
const express = require("express");
const router = express.Router();
const Movies = require("../models/movies"); // Adjust the path as needed

// Helper function to build the query and count filter based on the cast and maleCast queries
const buildFilter = (castQuery, maleCastQuery) => {
  const filter = {};

  if (castQuery) {
    const castNames = castQuery.split(",");
    if (castNames.length > 0) {
      filter.cast = { $in: castNames };
    }
  }

  if (maleCastQuery) {
    const maleCastNames = maleCastQuery.split(",");
    if (maleCastNames.length > 0) {
      filter.maleCast = { $in: maleCastNames };
    }
  }
  return filter;
};

// Helper function to build the sort option based on the query parameters
const buildSortOption = (sortQuery) => {
  switch (sortQuery) {
    case "release":
      return { release: -1 }; // Sort by release date in descending order (newest first)
    default:
      return { _id: -1 }; // Default sort by _id in descending order (newest first)
  }
};

// Get all movies
router.get("/", async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Get the page number from the query string, default to 1
  const limit = 24; // Number of entries per page
  const castQuery = req.query.cast;
  const maleCastQuery = req.query.mcast;
  const sortQuery = req.query.sort;

  try {
    const filter = buildFilter(castQuery, maleCastQuery);
    const sortOption = buildSortOption(sortQuery);
    const totalMovies = await Movies.countDocuments(filter);
    const movies = await Movies.find(filter)
      .select("code title cast maleCast release overrides")
      .sort(sortOption)
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

// Get a specific movie by ID
router.get("/:code", getMovie, (req, res) => {
  res.json(res.movie);
});

// Middleware function to get a single movie by code
async function getMovie(req, res, next) {
  try {
    const movie = await Movies.findOne({ code: req.params.code });
    if (!movie) {
      return res.status(404).json({ message: "Cannot find movie" });
    }
    res.movie = movie; // Convert to a plain JavaScript object
    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// Helper function for data binding
function bindMovieData(movie, data) {
  if (data.code) {
    movie.code = data.code.toLowerCase();
  }
  if (data.title) {
    movie.title = data.title.trim().toLowerCase();
  }
  if (data.cast) {
    movie.cast = JSON.parse(data.cast);
  }
  if (data.maleCast) {
    movie.maleCast = data.maleCast
      .split(",")
      .map((val) => val.trim().toLowerCase());
  }
  if (data.release) {
    const releaseDate = new Date(data.release.trim());
    movie.release = releaseDate.toISOString().split("T")[0];
  }
  if (data.runtime) {
    movie.runtime = data.runtime;
  }
  if (data.tags) {
    movie.tags = data.tags.split(",").map((val) => val.trim().toLowerCase());
  }
  if (data.opt) {
    movie.opt = data.opt.split(",").map((val) => val.trim().toLowerCase());
  }
  if (data.series) {
    movie.series = data.series.trim().toLowerCase();
  }
  if (data.cover || data.preview) {
    // Create the overrides object if it doesn't exist
    if (!movie.overrides) {
      movie.overrides = {};
    }
    if (data.cover) {
      movie.overrides.cover = data.cover.trim().toLowerCase();
    }
    if (data.preview) {
      movie.overrides.preview = data.preview.trim().toLowerCase();
    }
  }
}

// Create a new movie
router.post("/", async (req, res) => {
  try {
    const newMovie = new Movies();
    bindMovieData(newMovie, req.body);

    const savedMovie = await newMovie.save();

    console.log("New movie saved: ", savedMovie);
    res.status(201).json(savedMovie);
  } catch (err) {
    console.error("Error creating movie: ", err);
    res.status(400).json({ message: err.message });
  }
});

// Update a movie by code
router.put("/:code", getMovie, async (req, res) => {
  try {
    bindMovieData(res.movie, req.body);

    const updatedMovie = await res.movie.save();
    res.json(updatedMovie);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete a movie by code
router.delete("/:code", async (req, res) => {
  try {
    const deletedMovie = await Movies.deleteOne({ code: req.params.code });
    if (deletedMovie.deletedCount === 0) {
      return res.status(404).json({ message: "Cannot find movie" });
    }
    res.json({ message: "Movie deleted" });
  } catch (err) {
    console.error(err);
    if (err.name === "CastError") {
      return res.status(400).json({ message: "Invalid movie code" });
    }
    res.status(500).json({ message: err.message });
  }
});

//search route
router.get("/search", async (req, res) => {
  const query = req.query.q;

  const searchQuery = [
    {
      $search: {
        index: "default",
        text: {
          query: query,
          path: {
            wildcard: "*",
          },
        },
      },
    },
  ];

  try {
    const searchResults = await Movies.aggregate(searchQuery).toArray();
    res.json(searchResults);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
