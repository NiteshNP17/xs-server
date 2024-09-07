const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Actors = require("./models/actors");

const app = express();
require("dotenv").config();

// CORS configuration
const corsOptions = {
  origin: [process.env.FRONTEND_URL, "http://localhost:5173"],
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI, {})
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

async function generateSlugsForExistingActors() {
  try {
    const actors = await Actors.find({ slug: { $exists: false } });

    for (let actor of actors) {
      const idString = actor._id.toString();
      actor.slug = idString.substring(4, 9);
      await actor.save();
      console.log(`Generated slug ${actor.slug} for actor ${actor.name}`);
    }

    console.log("Finished generating slugs for all actors");
  } catch (error) {
    console.error("Error generating slugs:", error);
  } finally {
    mongoose.disconnect();
  }
}

generateSlugsForExistingActors();
