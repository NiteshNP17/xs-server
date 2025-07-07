//routes/movies.js
const express = require("express");
const router = express.Router();
const Movies = require("../models/movies"); // Adjust the path as needed
const Tags = require("../models/tags"); // Adjust the path as needed
const Actors = require("../models/actors"); // Adjust the path as needed
const Series = require("../models/series"); // Adjust the path as needed
const Studios = require("../models/studios"); // Adjust the path as needed
const { scrapeMovieData } = require("./lookups");

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
      filter.cast = { $all: actorIds };
      // filter.cast = { $in: actorIds };
    }
  }

  if (queries.tag2Query) {
    const tagNames = queries.tag2Query.split(",").map((name) => name.trim());

    if (tagNames.length > 0) {
      const tags = await Tags.find({ name: tagNames }).select("_id");
      const tagsIds = tags.map((tag) => tag._id);

      filter.tag2 = { $all: tagsIds };
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
    // tag1Query: req.query.tag1,
    tag2Query: req.query.tags,
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
        .populate("tag2", "name") // Populate the 'cast' field with 'name' and 'dob' from the Actor model
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

router.get("/filter", async (req, res) => {
  const query = req.query.q;
  const queryCode = formatCode(req.query.q);

  try {
    const codes = await Movies.find({
      code: { $regex: queryCode, $options: "i" },
    })
      .select("code")
      .sort({ code: -1 })
      .limit(3);

    const codeOptions = codes.map((movie) => ({
      id: movie.code,
      type: "code",
    }));

    const actors = await Actors.find({ name: { $regex: query, $options: "i" } })
      .select("name")
      .sort({ numMovies: -1 })
      .limit(3);

    const castOptions = actors.map((actor) => ({
      id: actor.name,
      type: "cast",
    }));

    const tags = await Tags.find({ name: { $regex: query, $options: "i" } })
      .select("name")
      .sort({ _id: 1 })
      .limit(5);

    const tagOptions = tags.map((tag) => ({
      id: tag.name,
      type: "tag",
    }));

    res.json([...castOptions, ...tagOptions, ...codeOptions]);
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
      .populate("cast", "name slug dob")
      .populate("tag2", "name");

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
  if (data.tag2) {
    movie.tag2 = JSON.parse(data.tag2);
  }
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

function calculateAge(dobDate, referenceDate) {
  const diffInMilliseconds = referenceDate.getTime() - dobDate.getTime();
  const ageInYears = Math.floor(
    diffInMilliseconds / (1000 * 60 * 60 * 24 * 365.25)
  );

  return parseInt(ageInYears);
}

// Create a new movie
router.post("/", async (req, res) => {
  if (!req.body.code) {
    return res.status(400).json({ message: "no code received!" });
  }

  try {
    // First check if a movie with the same code exists
    const existingMovie = await Movies.findOne({
      code: req.body.code?.toLowerCase(),
    });

    if (existingMovie) {
      return res.status(409).json({
        message: `Movie with code ${req.body.code} already exists`,
      });
    }

    // If no existing movie found, proceed with creation
    const newMovie = new Movies();
    bindMovieData(newMovie, req.body);

    const savedMovie = await newMovie.save();

    // Update numMovies for all actors in this movie's cast
    if (savedMovie.cast && savedMovie.cast.length > 0) {
      await Actors.updateMany(
        { _id: { $in: savedMovie.cast } },
        { $inc: { numMovies: 1 } }
      );

      // Individual updates for latestMovieDate
      for (const actorId of savedMovie.cast) {
        const actor = await Actors.findById(actorId);

        // Compare and update latestMovieDate if needed
        if (
          !actor.latestMovieDate ||
          savedMovie.release > actor.latestMovieDate
        ) {
          actor.latestMovieDate = savedMovie.release;
          if (actor.dob)
            actor.ageAtLatestRel = calculateAge(
              new Date(actor.dob),
              new Date(savedMovie.release)
            );
          await actor.save();
        }
      }
    }

    console.log("New movie saved: ", savedMovie);
    res.status(201).json(savedMovie);
  } catch (err) {
    console.error("Error creating movie: ", err);
    res.status(400).json({ message: err.message });
  }
});

function formatCode(str) {
  if (!str) return;
  // Remove any leading/trailing whitespace
  str = str.trim();

  // Find the index of the last letter in the string
  let lastLetterIndex = -1;
  for (let i = str.length - 1; i >= 0; i--) {
    if (isNaN(+str[i]) && str[i] !== " ") {
      lastLetterIndex = i;
      break;
    }
  }

  // If no letter is found, return the original string
  if (lastLetterIndex === -1) {
    return str;
  }

  // Find the index of the first number after the last letter
  let firstNumberIndex = -1;
  for (let i = lastLetterIndex + 1; i < str.length; i++) {
    if (!isNaN(+str[i])) {
      firstNumberIndex = i;
      break;
    }
  }

  // If no number is found after the last letter, return the original string
  if (firstNumberIndex === -1) {
    return str;
  }

  // Check if a hyphen or space already exists between the last letter and the first number
  // const hasHyphen = str[lastLetterIndex] === "-";
  const hasHyphen = str.includes("-") || str.includes("_");

  const hasSpace = str[lastLetterIndex + 1] === " ";

  if (hasHyphen) return str;

  // If a hyphen or space doesn't exist, insert a hyphen
  if (!hasHyphen && !hasSpace) {
    const modifiedStr = `${str.slice(0, lastLetterIndex + 1)}-${str.slice(
      firstNumberIndex
    )}`;
    return modifiedStr;
  }

  // If a hyphen or space already exists, remove any spaces and return the string
  const modifiedStr = `${str.slice(0, lastLetterIndex + 1)}-${str
    .slice(firstNumberIndex)
    .replace(/ /g, "")}`;
  return modifiedStr;
}

// New route for batch processing
router.post("/batch-create", async (req, res) => {
  try {
    const { cast, codes } = req.body;

    if (!codes) {
      return res.status(400).json({
        error: "'codes' are required",
      });
    }

    const codeArray = codes
      .split(" ")
      .filter((str) => str)
      .map((code) => formatCode(code));
    const results = {
      success: [],
      failures: [],
      exists: [],
    };

    for (const code of codeArray) {
      try {
        // Check for existing movie
        const existingMovie = await Movies.findOne({
          code: code.toLowerCase(),
        });

        if (existingMovie) {
          results.exists.push(code);
          continue;
        }

        // Scrape data
        const scrapedData = await scrapeMovieData(code);
        const mrUrl = `https://fourhoi.com/${code}-uncensored-leak/preview.mp4`;
        const tagIDs = scrapedData.tags?.map((tag) => tag._id);

        // Create new movie object
        const movieData = {
          code,
          cast: JSON.stringify(scrapedData.cast?.map((actor) => actor._id)),
          title: scrapedData.title,
          release: scrapedData.relDate,
          runtime: scrapedData.runtime,
          tag2: JSON.stringify(tagIDs || []), // default empty array or whatever default you want
          preview: scrapedData.tags?.some((tag) => tag.name === "MR")
            ? mrUrl
            : "", // default empty string or whatever default you want
          cover: null, // default null or whatever default you want
        };

        const newMovie = new Movies();
        bindMovieData(newMovie, movieData);

        const savedMovie = await newMovie.save();
        results.success.push(code);

        // Update numMovies for all actors in this movie's cast
        if (savedMovie.cast && savedMovie.cast.length > 0) {
          await Actors.updateMany(
            { _id: { $in: savedMovie.cast } },
            { $inc: { numMovies: 1 } }
          );

          // Individual updates for latestMovieDate
          const actor = await Actors.findById(savedMovie.cast[0]);

          // Compare and update latestMovieDate if needed
          if (
            !actor.latestMovieDate ||
            savedMovie.release > actor.latestMovieDate
          ) {
            actor.latestMovieDate = savedMovie.release;
            await actor.save();
          }
        }
      } catch (error) {
        results.failures.push({
          code,
          reason: error.message,
        });
      }
    }

    console.log(results);

    res.json({
      message: `Processed ${codeArray.length} movies`,
      results,
    });
  } catch (err) {
    console.error("Batch processing error:", err);
    res.status(500).json({
      message: "An error occurred during batch processing",
      error: err.message,
    });
  }
});

// Update a movie by code
router.put("/:code", getMovie, async (req, res) => {
  try {
    // Store the original cast before updating
    const originalCast = [...res.movie.cast].map((actor) =>
      actor._id.toString()
    );

    // Update movie data
    bindMovieData(res.movie, req.body);

    // Get the new cast IDs as strings for comparison
    const newCast = res.movie.cast.map((id) => id.toString());

    // Find actors that were added (in newCast but not in originalCast)
    const addedActors = newCast.filter(
      (actorId) => !originalCast.includes(actorId)
    );

    // Find actors that were removed (in originalCast but not in newCast)
    const removedActors = originalCast.filter(
      (actorId) => !newCast.includes(actorId)
    );

    // Save the updated movie
    const updatedMovie = await res.movie.save();

    // Increment numMovies for newly added actors
    if (addedActors.length > 0) {
      await Actors.updateMany(
        { _id: { $in: addedActors } },
        { $inc: { numMovies: 1 } }
      );

      // Update latestMovieDate for newly added actors if needed
      for (const actorId of addedActors) {
        const actor = await Actors.findById(actorId);

        // Compare and update latestMovieDate if needed
        if (
          !actor.latestMovieDate ||
          updatedMovie.release > actor.latestMovieDate
        ) {
          actor.latestMovieDate = updatedMovie.release;
          if (actor.dob)
            actor.ageAtLatestRel = calculateAge(
              new Date(actor.dob),
              new Date(updatedMovie.release)
            );
          await actor.save();
        }
      }
    }

    // Decrement numMovies for removed actors
    if (removedActors.length > 0) {
      await Actors.updateMany(
        { _id: { $in: removedActors } },
        { $inc: { numMovies: -1 } }
      );

      // Note: We don't update latestMovieDate here as it would require
      // finding the new latest movie for each actor, which is more complex
    }

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
    console.error("Error updating movie: ", err);
    res.status(400).json({ message: err.message });
  }
});

// Modify delete route to potentially update latestMovieDate
router.delete("/:code", async (req, res) => {
  try {
    // First, find the movie to get its cast before deleting
    const movieToDelete = await Movies.findOne({ code: req.params.code });

    if (!movieToDelete) {
      return res.status(404).json({ message: "Cannot find movie" });
    }

    // Delete the movie
    const deletedMovie = await Movies.deleteOne({ code: req.params.code });

    // If movie was successfully deleted and had a cast
    if (
      deletedMovie.deletedCount > 0 &&
      movieToDelete.cast &&
      movieToDelete.cast.length > 0
    ) {
      // Decrement numMovies for actors in this movie's cast
      await Actors.updateMany(
        { _id: { $in: movieToDelete.cast } },
        { $inc: { numMovies: -1 } }
      );

      // Potentially update latestMovieDate for affected actors
      for (const actorId of movieToDelete.cast) {
        const actor = await Actors.findById(actorId);

        // If the deleted movie was the latest, find the next latest movie
        if (actor.latestMovieDate === movieToDelete.release) {
          const nextLatestMovie = await Movies.findOne(
            {
              cast: actorId,
              release: { $ne: movieToDelete.release },
            },
            { release: 1 }
          ).sort({ release: -1 });

          // Update or clear latestMovieDate
          actor.latestMovieDate = nextLatestMovie
            ? nextLatestMovie.release
            : null;
          await actor.save();
        }
      }
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

// Route to handle liking a movie
router.post("/came/:id", async (req, res) => {
  try {
    const movieCode = req.params.id;

    // Find the movie and populate the cast
    const movie = await Movies.findOne({ code: movieCode }).populate("cast");

    if (!movie) {
      return res.status(404).json({ error: "Movie not found" });
    }

    // Increment movie cames
    movie.came += 1;
    await movie.save();

    // Increment cames for all cast members
    if (movie.cast && movie.cast.length > 0) {
      const castIds = movie.cast.map((actor) => actor._id);

      await Actors.updateMany({ _id: { $in: castIds } }, { $inc: { came: 1 } });
    }

    res.json({
      success: true,
      message: "Movie and cast members camed successfully",
      moviecames: movie.came,
      castMembersUpdated: movie.cast.length,
    });
  } catch (error) {
    console.error("Error liking movie:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

module.exports = router;
