//routes/movies.js
const express = require("express");
const router = express.Router();
const Movies = require("../models/movies"); // Adjust the path as needed
const Actors = require("../models/actors"); // Adjust the path as needed
const Series = require("../models/series"); // Adjust the path as needed
const Studios = require("../models/studios"); // Adjust the path as needed

// Helper function to build the query and count filter based on the cast and maleCast queries
const buildFilter = async (queries) => {
  const filter = {};

  if (queries.castQuery) {
    const castNames = queries.castQuery.split(",").map((name) => name.trim());
    if (castNames.length > 0) {
      const actors = await Actors.find({ name: { $in: castNames } }).select(
        "_id"
      );
      const actorIds = actors.map((actor) => actor._id);
      filter.cast = { $in: actorIds };
    }
  }

  if (queries.maleCastQuery) {
    const maleCastNames = queries.maleCastQuery.split(",");
    if (maleCastNames.length > 0) {
      filter.maleCast = { $in: maleCastNames };
    }
  }

  if (queries.seriesQuery) {
    const series = await Series.findOne({ slug: queries.seriesQuery });
    if (series) {
      filter.series = series._id;
    } else {
      // If no series found, return a filter that will match no movies
      filter.series = null;
    }
  }

  if (queries.tagsQuery) {
    const optTags = ["vr", "mr", "un", "en"];

    if (optTags.includes(queries.tagsQuery)) filter.opt = queries.tagsQuery;
    else filter.tags = queries.tagsQuery;
  }

  if (queries.studioQuery) {
    // Find the studio by slug
    const studio = await Studios.findOne({ slug: queries.studioQuery });

    if (!studio) {
      return res.status(404).json({ message: "Studio not found" });
    }

    // Create a regex pattern for each label
    const labelPatterns = studio.labels.map((label) => new RegExp(`^${label}`));

    filter.code = { $in: labelPatterns };
  }

  if (queries.labelQuery) {
    const labelPattern = new RegExp(`^${queries.labelQuery}-`);
    filter.code = labelPattern;
  }

  return filter;
};

// Helper function to build the sort option based on the query parameters
const buildSortOption = (sortQuery) => {
  switch (sortQuery) {
    case "release":
      return { release: -1, code: -1 }; // Sort by release date in descending order (newest first)
    case "code":
      return { code: -1 };
    case "codeAsc":
      return { code: 1 };
    default:
      return { _id: -1 }; // Default sort by _id in descending order (newest first)
  }
};

// Get all movies
router.get("/", async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Get the page number from the query string, default to 1
  const limit = 20; // Number of entries per page

  const filterQueries = {
    castQuery: req.query.cast,
    maleCastQuery: req.query.mcast,
    seriesQuery: req.query.series,
    tagsQuery: req.query.tags,
    studioQuery: req.query.studio,
    labelQuery: req.query.label,
  };

  try {
    const filter = await buildFilter(filterQueries);

    if (req.query.random !== undefined) {
      const movie = await Movies.aggregate([
        { $match: filter },
        { $sample: { size: 1 } },
        {
          $lookup: {
            from: "actors",
            localField: "cast",
            foreignField: "_id",
            as: "cast",
          },
        },
        {
          $lookup: {
            from: "series",
            localField: "series",
            foreignField: "_id",
            as: "series",
          },
        },
        {
          $unwind: {
            path: "$series",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            code: 1,
            title: 1,
            "cast._id": 1,
            "cast.name": 1,
            "cast.dob": 1,
            maleCast: 1,
            release: 1,
            runtime: 1,
            tags: 1,
            opt: 1,
            "series._id": 1,
            "series.slug": 1,
            "series.name": 1,
            overrides: 1,
          },
        },
      ]);

      res.json({
        movies: movie,
        currentPage: 1,
        totalPages: 1,
        totalMovies: 1,
      });
    } else {
      const sortOption = buildSortOption(req.query.sort);
      const totalMovies = await Movies.countDocuments(filter);
      const movies = await Movies.find(filter)
        // .select("code title cast maleCast release opt overrides")
        .populate("cast", "name dob") // Populate the 'cast' field with 'name' and 'dob' from the Actor model
        .populate("series", "name slug thumbs") // Populate the 'cast' field with 'name' and 'dob' from the Actor model
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(limit);

      let response = {
        movies,
        currentPage: page,
        totalPages: Math.ceil(totalMovies / limit),
        totalMovies,
      };

      // Add actor statistics if studioQuery is present
      if (filterQueries.studioQuery || filterQueries.labelQuery) {
        const actorStats = await Movies.aggregate([
          { $match: filter },
          { $unwind: "$cast" },
          {
            $group: {
              _id: "$cast",
              numMovies: { $sum: 1 },
            },
          },
          {
            $lookup: {
              from: "actors",
              localField: "_id",
              foreignField: "_id",
              as: "actorInfo",
            },
          },
          { $unwind: "$actorInfo" },
          {
            $project: {
              _id: 1,
              numMovies: 1,
              name: "$actorInfo.name",
            },
          },
          { $sort: { numMovies: -1, name: 1 } },
          { $limit: 10 },
        ]);

        response.actorStats = actorStats;
      }

      res.json(response);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Search route
router.get("/search", async (req, res) => {
  const query = req.query.q;
  const page = parseInt(req.query.page) || 1;
  const limit = 24;
  const skip = (page - 1) * limit;

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
    {
      $facet: {
        searchResults: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: "count" }],
      },
    },
  ];

  try {
    const result = await Movies.aggregate(searchQuery);
    const searchResultIds = result[0].searchResults.map((movie) => movie._id);
    const totalCount = result[0].totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    // Fetch full documents for the search results
    const populatedResults = await Movies.find({
      _id: { $in: searchResultIds },
    })
      .populate("cast", "slug name dob")
      .populate("series", "slug name");

    // Sort the populated results to match the order from the search query
    const sortedResults = searchResultIds.map((id) =>
      populatedResults.find((movie) => movie._id.toString() === id.toString())
    );

    // Transform the results
    const transformedResults = sortedResults.map((movie) => ({
      ...movie.toObject(),
      cast: movie.cast.map((actor) => ({
        _id: actor._id,
        slug: actor.slug,
        name: actor.name,
        dob: actor.dob,
      })),
      series: movie.series
        ? {
            _id: movie.series._id,
            slug: movie.series.slug,
            name: movie.series.name,
          }
        : null,
    }));

    res.json({
      searchResults: transformedResults,
      currentPage: page,
      totalPages: totalPages,
      totalCount: totalCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get a specific movie by code
router.get("/:code", getMovie, (req, res) => {
  // Transform the populated cast for the GET response
  const transformedCast = res.movie.cast.map((actor) => ({
    _id: actor._id,
    name: actor.name,
    slug: actor.slug,
    dob: actor.dob,
  }));

  const movieResponse = {
    ...res.movie.toObject(),
    cast: transformedCast,
  };

  res.json(movieResponse);
});

// Middleware function to get a single movie by code
async function getMovie(req, res, next) {
  try {
    const movie = await Movies.findOne({ code: req.params.code })
      .populate("series", "name slug")
      .populate("cast", "name slug dob");

    if (!movie) {
      return res.status(404).json({ message: "Cannot find movie" });
    }

    res.movie = movie;
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
    movie.title = data.title.trim();
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
    releaseDate.setHours(12, 0, 0, 0);
    movie.release = releaseDate.toISOString().split("T")[0];
  }
  if (data.runtime) {
    movie.runtime = data.runtime;
  }
  if (data.tags) {
    movie.tags = data.tags.split(",").map((val) => val.trim().toLowerCase());
  }
  movie.opt = data.opt.split(",").map((val) => val.trim().toLowerCase());
  if (data.series) {
    movie.series = data.series; // This will now be an ObjectId
  }
  if (!movie.overrides) {
    movie.overrides = {};
  }
  movie.overrides.cover =
    data.cover && !data.cover.startsWith("http://javpop")
      ? data.cover.trim()
      : null;
  movie.overrides.preview = data.preview.trim();
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
  bindMovieData(res.movie, req.body);

  try {
    const updatedMovie = await res.movie.save();

    // Repopulate the cast after saving
    await updatedMovie.populate("cast", "name slug dob");

    // Transform the populated cast for the response
    const transformedCast = updatedMovie.cast.map((actor) => ({
      _id: actor._id,
      name: actor.name,
      slug: actor.slug,
      dob: actor.dob,
    }));

    const movieResponse = {
      ...updatedMovie.toObject(),
      cast: transformedCast,
    };

    res.json(movieResponse);
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

module.exports = router;
