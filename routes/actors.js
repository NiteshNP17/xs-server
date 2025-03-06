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
  const sortOption = { [reqSort]: sortDirection };
  let searchQuery;

  if (req.query.q) {
    const reqQuery = req.query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    searchQuery = new RegExp(`\\b${reqQuery}`, "i");
  }

  try {
    // Base match condition
    const filterCondition = isList
      ? { name: searchQuery }
      : !isRandom
      ? { img500: { $ne: null } }
      : {};

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
      const limit = 24;
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
    actor = await Actors.aggregate([
      { $match: { name: req.params.name } },
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
            { $sort: { release: -1 } },
            { $limit: 1 },
            { $project: { _id: 0, release: 1 } }, // Explicitly project release
          ],
          as: "latestMovie",
        },
      },
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
            { $sort: { release: 1 } },
            { $limit: 1 },
            { $project: { _id: 0, release: 1 } }, // Explicitly project release
          ],
          as: "oldestMovie",
        },
      },
      {
        $addFields: {
          latestMovie: {
            $ifNull: [{ $arrayElemAt: ["$latestMovie.release", 0] }, null],
          },
          oldestMovie: {
            $ifNull: [{ $arrayElemAt: ["$oldestMovie.release", 0] }, null],
          },
          ageAtLatestRelease: {
            $cond: {
              if: {
                $and: [
                  { $ne: ["$dob", null] },
                  {
                    $ne: [{ $arrayElemAt: ["$latestMovie.release", 0] }, null],
                  },
                ],
              },
              then: {
                $floor: {
                  $divide: [
                    {
                      $subtract: [
                        {
                          $toDate: {
                            $arrayElemAt: ["$latestMovie.release", 0],
                          },
                        },
                        { $toDate: "$dob" },
                      ],
                    },
                    // Milliseconds in a year (1000 * 60 * 60 * 24 * 365.25)
                    31557600000,
                  ],
                },
              },
              else: null,
            },
          },
          yearsActive: {
            $cond: {
              if: {
                $and: [
                  {
                    $ne: [{ $arrayElemAt: ["$oldestMovie.release", 0] }, null],
                  },
                  {
                    $ne: [{ $arrayElemAt: ["$latestMovie.release", 0] }, null],
                  },
                ],
              },
              then: {
                $floor: {
                  $divide: [
                    {
                      $subtract: [
                        {
                          $toDate: {
                            $arrayElemAt: ["$latestMovie.release", 0],
                          },
                        },
                        {
                          $toDate: {
                            $arrayElemAt: ["$oldestMovie.release", 0],
                          },
                        },
                      ],
                    },
                    // Milliseconds in a year (1000 * 60 * 60 * 24 * 365.25)
                    31557600000,
                  ],
                },
              },
              else: null,
            },
          },
        },
      },
      { $limit: 1 },
    ]);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }

  res.actor = actor || null;
  next();
}

// Helper function for data binding
function bindActorData(actor, data) {
  if (data.name) actor.name = data.name.trim().toLowerCase();
  if (data.cup) actor.cup = data.cup.trim().toLowerCase();
  if (data.dob) {
    const dobDate = new Date(data.dob.trim());
    // Set the time to 12:00:00.000 to prevent any potential time zone issues
    dobDate.setHours(12, 0, 0, 0);
    actor.dob = dobDate.toISOString().split("T")[0]; // YYYY-MM-DD
  }
  if (data.height) actor.height = data.height;
  if (data.img500) actor.img500 = data.img500.trim();
  if (data.sizes) {
    let sizeSplit = data.sizes.trim().split("-");
    actor.sizes = {
      bust: sizeSplit[0],
      waist: sizeSplit[1],
      hips: sizeSplit[2],
    };
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
