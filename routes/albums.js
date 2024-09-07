const express = require("express");
const mongoose = require("mongoose");
const Album = require("../models/albums");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    // Split the plain text string into an array of URLs
    const imageUrls = req.body.images.trim().split("\n");

    // Process the URLs to extract imgCode and fileName
    const processedImages = imageUrls.map((url) => {
      const [domainName, imgCode, fileName] = url.split("/").slice(-3);
      return { imgCode, fileName };
    });

    req.body.images = processedImages;
    req.body.models = JSON.parse(req.body.models);

    // Create a new album
    const album = new Album(req.body);

    // Save the album to the database
    await album.save();

    res.status(201).json({ message: "Album created successfully", album });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const filterCondition = req.query.model
      ? { models: new mongoose.Types.ObjectId(req.query.model) }
      : {};

    const sortOption =
      req.query.sort == "release" ? { release: -1 } : { _id: -1 };

    const albums = await Album.aggregate([
      { $match: filterCondition },
      {
        $project: {
          models: 1,
          name: 1,
          cover: 1,
          studio: 1,
          galleryCode: 1,
          date: 1,
          imageCount: { $size: "$images" }, // Add a field 'imageCount' with the count of images
          slug: 1,
        },
      },
      { $sort: sortOption },
    ]);

    // Populate the 'models' field with 'slug', 'name', and 'dob' from the Actor model
    await Album.populate(albums, { path: "models", select: "slug name dob" });

    res.json(albums);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const album = await Album.findOne({ slug });

    if (!album) {
      return res.status(404).json({ message: "Album not found" });
    }

    //pagination
    const page = parseInt(req.query.page) || 1; // Get the page number from the query string, default to 1
    const limit = 20; // Number of entries per page
    const startIndex = (page - 1) * limit; // Calculate the starting index
    const endIndex = startIndex + limit; // Calculate the ending index

    // Paginate the images array
    const paginatedImages = album.images.slice(startIndex, endIndex);

    // Include pagination info
    // const paginationInfo = {
    //   currentPage: page,
    //   totalPages: Math.ceil(album.images.length / limit),
    //   totalImages: album.images.length,
    //   imagesOnPage: paginatedImages.length,
    // };

    res.status(200).json({
      album: { ...album.toObject(), images: paginatedImages },
      // pagination: paginationInfo,
      totalPages: Math.ceil(album.images.length / limit),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
