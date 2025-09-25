//routes/actors.js
const express = require("express");
const router = express.Router();
const Actors = require("../models/actors"); // Adjust the path as needed
const Movies = require("../models/movies");
const mongoose = require("mongoose");

// Get all actors
router.get("/", async (req, res) => {
  const isList = req.query.list !== undefined;
  const isRandom = req.query.random !== undefined;
  const reqSort = req.query.sort || "name";
  const sortDirection = req.query.dir === "desc" ? -1 : 1;
  let sortOption = { [reqSort]: sortDirection };
  let searchQuery;

  if (reqSort === "cup") {
    sortOption = { [reqSort]: sortDirection, "sizes.bust": sortDirection };
  } else if (reqSort === "ageAtLatestRel") {
    sortOption = { [reqSort]: sortDirection, dob: -sortDirection };
  } else if (reqSort === "order") {
    sortOption = { [reqSort]: sortDirection, numMovies: 1, name: 1 };
  }

  if (req.query.q) {
    const reqQuery = req.query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    searchQuery = new RegExp(`\\b${reqQuery}`, "i");
  }

  try {
    // Base match condition
    const filterCondition = isList
      ? { name: searchQuery }
      : // : !isRandom
        // ? { img500: { $ne: null } }
        {};

    const pipeline = [{ $match: filterCondition }];

    if (isRandom) {
      pipeline.splice(1, 0, { $sample: { size: 1 } });
    }

    // Add sorting
    pipeline.push({ $sort: sortOption });

    // Projection and pagination
    if (isList) {
      pipeline.push(
        {
          $project: {
            name: 1,
            dob: 1,
          },
        },
        { $limit: 6 }
      );
    } else {
      const page = parseInt(req.query.page) || 1;
      const limit = 30;
      const totalActors = await Actors.countDocuments(filterCondition);

      pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });

      const actors = await Actors.aggregate(pipeline);

      return res.json({
        actors,
        currentPage: page,
        totalPages: Math.ceil(totalActors / limit),
      });
    }

    const actors = await Actors.aggregate(pipeline);
    res.json({ actors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update actor order
router.patch("/order/:id", async (req, res) => {
  try {
    const { newOrder, prevOrder, nextOrder } = req.body;

    let orderValue;

    // If explicit newOrder provided, use it
    if (newOrder !== undefined) {
      orderValue = newOrder;
    }
    // If positioning between two items, calculate the midpoint
    else if (prevOrder !== undefined && nextOrder !== undefined) {
      orderValue = prevOrder + (nextOrder - prevOrder) / 2;
    }
    // If only prevOrder, position after it
    else if (prevOrder !== undefined) {
      orderValue = prevOrder + 1;
    }
    // If only nextOrder, position before it
    else if (nextOrder !== undefined) {
      orderValue = nextOrder - 1;
    }
    // Default to a high value if none provided
    else {
      orderValue = 9999999;
    }

    // Validate the order is a number
    if (typeof orderValue !== "number") {
      return res.status(400).json({ message: "Order must be a number" });
    }

    const actor = await Actors.findByIdAndUpdate(
      req.params.id,
      { order: orderValue },
      { new: true }
    );

    if (!actor) {
      return res.status(404).json({ message: "Actor not found" });
    }

    res.json(actor);
  } catch (err) {
    console.error("Error updating actor order:", err);
    res.status(500).json({ message: err.message });
  }
});

// Get a specific actor by name
router.get("/:name", getActor, (req, res) => {
  if (res.actor) {
    res.json(res.actor);
  } else {
    res.status(200).json({ message: "notFound" });
  }
});

// Middleware function to get a single actor by name
async function getActor(req, res, next) {
  let actor;
  try {
    actor = await Actors.findOne({ name: req.params.name }).populate(
      "tag2",
      "name"
    );
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }

  res.actor = actor || null;
  next();
}

function calculateAge(dobDate, referenceDate) {
  const diffInMilliseconds = referenceDate.getTime() - dobDate.getTime();
  const ageInYears = Math.floor(
    diffInMilliseconds / (1000 * 60 * 60 * 24 * 365.25)
  );

  return parseInt(ageInYears);
}

// Helper function for data binding
function bindActorData(actor, data) {
  if (data.name) actor.name = data.name.trim().toLowerCase();
  if (data.jpName) actor.jpName = data.jpName.trim().toLowerCase();
  if (data.cup) actor.cup = data.cup.trim().toLowerCase();
  if (data.dob) {
    const dobDate = new Date(data.dob.trim());
    // Set the time to 12:00:00.000 to prevent any potential time zone issues
    dobDate.setHours(12, 0, 0, 0);
    actor.dob = dobDate.toISOString().split("T")[0]; // YYYY-MM-DD
    if (actor.latestMovieDate && !actor.ageAtLatestRel)
      actor.ageAtLatestRel = calculateAge(
        new Date(actor.dob),
        new Date(actor.latestMovieDate)
      );
  }
  if (data.height) actor.height = data.height;
  if (data.img500) actor.img500 = data.img500.trim();
  if (data.rebdSrc) actor.rebdSrc = data.rebdSrc.trim().toLowerCase();
  if (data.sizes) {
    let sizeSplit = data.sizes.trim().split("-");
    actor.sizes = {
      bust: sizeSplit[0],
      waist: sizeSplit[1],
      hips: sizeSplit[2],
    };
  }
  if (data.tags) {
    actor.tag2 = JSON.parse(data.tags);
  }
}

// add a new actor
router.post("/", async (req, res) => {
  const actor = new Actors();
  bindActorData(actor, req.body);
  try {
    const newActor = await actor.save();
    res.status(201).json(newActor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// update an actor
router.patch("/:id", async (req, res) => {
  try {
    const actor = await Actors.findById(req.params.id);

    if (!actor) {
      return res.status(404).json({ message: "Actor not found" });
    }

    bindActorData(actor, req.body);

    const updatedActor = await actor.save();
    res.json(updatedActor);
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ message: "Invalid actor ID" });
    }
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:name", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find the actor
    const actor = await Actors.findOne({ name: req.params.name }).session(
      session
    );

    if (!actor) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Actor not found" });
    }

    // Find movies with only this actor
    const moviesWithOnlyThisActor = await Movies.find({
      cast: {
        $size: 1,
        $elemMatch: { $eq: actor._id },
      },
    }).session(session);

    // Remove actor from all movies' cast arrays (if any)
    const updateResult = await Movies.updateMany(
      { cast: actor._id },
      { $pull: { cast: actor._id } },
      { session }
    );

    // Delete movies that only had this actor
    const deleteMoviesResult = await Movies.deleteMany(
      { _id: { $in: moviesWithOnlyThisActor.map((movie) => movie._id) } },
      { session }
    );

    // Delete the actor
    await Actors.deleteOne({ _id: actor._id }).session(session);

    await session.commitTransaction();

    // Prepare response message
    const response = {
      message: `Actor deleted`,
      movieUpdateDetails:
        updateResult.modifiedCount > 0
          ? `Removed from ${updateResult.modifiedCount} movie(s)`
          : "No movies referenced this actor",
      moviesDeleted:
        deleteMoviesResult.deletedCount > 0
          ? `Deleted ${deleteMoviesResult.deletedCount} movie(s) with only this actor`
          : "No movies were deleted",
    };

    res.json(response);
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

module.exports = router;
