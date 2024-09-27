//routes/actors.js
const express = require("express");
const router = express.Router();
const Actors = require("../models/actors"); // Adjust the path as needed
const Movies = require("../models/movies");
const mongoose = require("mongoose");

function sortOptionBuilder(reqSort) {
  let sortOption = {};

  if (reqSort === "heightdesc") {
    sortOption = { height: -1 };
  } else if (reqSort === "heightasc") {
    sortOption = { height: 1 };
  } else if (reqSort === "ageasc") {
    sortOption = { dob: -1 };
  } else if (reqSort === "agedesc") {
    sortOption = { dob: 1 };
  } else if (reqSort === "nameasc") {
    sortOption = { name: 1 };
  } else if (reqSort === "namedesc") {
    sortOption = { name: -1 };
  } else if (reqSort === "addedasc") {
    sortOption = { _id: -1 };
  } else if (reqSort === "addeddesc") {
    sortOption = {};
  } else if (reqSort === "moviecountdesc") {
    sortOption = { numMovies: -1 };
  } else if (reqSort === "moviecountasc") {
    sortOption = { numMovies: 1 };
  }
  return sortOption;
}

// Get all actors
router.get("/", async (req, res) => {
  const isList = req.query.list !== undefined;
  const searchQuery = req.query.q ? new RegExp(`\\b${req.query.q}`, "i") : null;
  const sortOption = sortOptionBuilder(req.query.sort);

  try {
    const filterCondition = isList
      ? { name: searchQuery }
      : {
          img500: { $ne: null },
        };

    let aggregationPipeline = [
      { $match: filterCondition },
      {
        $lookup: {
          from: "movies",
          let: { actorId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$$actorId", "$cast"] },
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
              },
            },
          ],
          as: "movies",
        },
      },
      {
        $addFields: {
          numMovies: { $ifNull: [{ $arrayElemAt: ["$movies.count", 0] }, 0] },
        },
      },
      { $sort: sortOption },
    ];

    if (isList) {
      aggregationPipeline.push(
        {
          $project: {
            name: 1,
            dob: 1,
            // numMovies: 1, // Keep this for sorting purposes
          },
        },
        { $limit: 6 }
      );
    } else {
      const page = parseInt(req.query.page) || 1;
      const limit = 24;
      const totalActors = await Actors.countDocuments(filterCondition);

      aggregationPipeline.push(
        { $skip: (page - 1) * limit },
        { $limit: limit }
      );

      const actors = await Actors.aggregate(aggregationPipeline);

      return res.json({
        actors,
        currentPage: page,
        totalPages: Math.ceil(totalActors / limit),
      });
    }

    const actors = await Actors.aggregate(aggregationPipeline);
    res.json({ actors });
  } catch (err) {
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
    actor = await Actors.findOne({ name: req.params.name });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }

  res.actor = actor || null;
  next();
}

// Helper function for data binding
function bindActorData(actor, data) {
  if (data.name) actor.name = data.name.trim().toLowerCase();
  if (data.dob) {
    const dobDate = new Date(data.dob.trim());
    // Set the time to 12:00:00.000 to prevent any potential time zone issues
    dobDate.setHours(12, 0, 0, 0);
    actor.dob = dobDate.toISOString().split("T")[0]; // YYYY-MM-DD
  }
  if (data.height) actor.height = data.height;
  if (data.img500) actor.img500 = data.img500.trim();
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

// Delete an actor and remove their references from movies (if any)
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

    // Remove actor from all movies' cast arrays (if any)
    const updateResult = await Movies.updateMany(
      { cast: actor._id },
      { $pull: { cast: actor._id } },
      { session }
    );

    // Delete the actor
    await Actors.deleteOne({ _id: actor._id }).session(session);

    await session.commitTransaction();

    if (updateResult.modifiedCount > 0) {
      res.json({
        message: `Actor deleted and removed from ${updateResult.modifiedCount} movie(s)`,
      });
    } else {
      res.json({
        message: "Actor deleted. No movies were referencing this actor.",
      });
    }
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

module.exports = router;
