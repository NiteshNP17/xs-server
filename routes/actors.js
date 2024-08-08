//routes/actors.js
const express = require("express");
const router = express.Router();
const Actors = require("../models/actors"); // Adjust the path as needed

// Get all actors
router.get("/", async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Get the page number from the query string, default to 1
  const limit = 30; // Number of entries per page
  const isMale = req.query.male !== undefined; // Check if the
  let sortOption = {};

  if (req.query.sort === "heightdesc") {
    sortOption = { height: -1 };
  } else if (req.query.sort === "heightasc") {
    sortOption = { height: 1 };
  } else if (req.query.sort === "ageasc") {
    sortOption = { dob: -1 };
  } else if (req.query.sort === "agedesc") {
    sortOption = { dob: 1 };
  } else if (req.query.sort === "nameasc") {
    sortOption = { name: 1 };
  } else if (req.query.sort === "namedesc") {
    sortOption = { name: -1 };
  } else if (req.query.sort === "addedasc") {
    sortOption = { _id: -1 };
  } else if (req.query.sort === "addeddesc") {
    sortOption = {};
  } else if (req.query.sort === "moviecountdesc") {
    sortOption = { numMovies: -1 };
  } else if (req.query.sort === "moviecountasc") {
    sortOption = { numMovies: 1 };
  }

  try {
    const filterCondition = isMale ? { isMale: true } : { isMale: null }; // Filter based on the isMale query parameter
    const totalActors = await Actors.countDocuments(filterCondition); // Get the total number of actors based on the filter condition

    const actors = await Actors.aggregate([
      { $match: filterCondition },
      {
        $lookup: {
          from: "movies",
          let: { actorName: "$name" },
          pipeline: [
            { $unwind: "$cast" },
            { $match: { $expr: { $eq: ["$$actorName", "$cast"] } } },
            { $group: { _id: null, count: { $sum: 1 } } },
          ],
          as: "movies",
        },
      },
      {
        $addFields: {
          numMovies: { $ifNull: [{ $arrayElemAt: ["$movies.count", 0] }, 0] },
        },
      },
      // { $project: { name: 1, dob: 1, isMale: 1, height: 1, numMovies: 1 } },
      { $sort: sortOption },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]);

    res.json({
      actors,
      currentPage: page,
      totalPages: Math.ceil(totalActors / limit), // Calculate the total number of pages
    });
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
  if (data.activeFrom) actor.activeFrom = data.activeFrom.trim();
  if (data.isMale) actor.isMale = true;
  if (data.img500) actor.img500 = data.img500.trim().toLowerCase();
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
router.put("/:name", getActor, async (req, res) => {
  if (!res.actor) {
    return res.status(404).json({ message: "Actor not found" });
  }

  const originalActorName = res.actor.name;

  try {
    // Update the actor's details
    bindActorData(res.actor, req.body);

    // Save the updated actor
    const updatedActor = await res.actor.save();

    // Update the actor's name in all the movies
    if (originalActorName !== updatedActor.name) {
      const Movies = require("../models/movies");
      const actMovie = await Movies.updateMany(
        { cast: originalActorName },
        { $set: { "cast.$": updatedActor.name } }
      );

      console.log(
        "original actor name - ",
        originalActorName,
        "updated name - ",
        updatedActor.name,
        ", movie: ",
        actMovie
      );
    }

    res.json(updatedActor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

//delete an actor
router.delete("/:name", async (req, res) => {
  try {
    await Actors.deleteOne({ name: req.params.name });
    res.json({ message: "Actor deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
