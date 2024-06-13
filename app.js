//app.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const app = express();

const movieRoutes = require("./routes/movies");
const actorRoutes = require("./routes/actors");
const lookupRoutes = require("./routes/lookups");

require("dotenv").config();

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173", // Replace with your React app's URL
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI, {})
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// Use routes
app.use("/movies", movieRoutes);
app.use("/actors", actorRoutes);
app.use("/lookups", lookupRoutes);

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
