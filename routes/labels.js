//routes/lables.js
const express = require("express");
const router = express.Router();
const Labels = require("../models/labels");

router.get("/:label", async (req, res) => {
  const codenum = req.query.codenum ? parseInt(req.query.codenum) : null;

  let query = { label: req.params.label };

  if (codenum !== null) {
    query.maxNum = { $gte: codenum };
  }

  const labelData = await Labels.findOne(query, null, {
    sort: { maxNum: 1 },
  }).populate("studio", "name slug");

  res.json(labelData ? labelData : "notFound");
});

router.post("/", async (req, res) => {
  const newLabel = new Labels(req.body);
  newLabel.is3digits = req.body.is3digits ? true : null;
  newLabel.isHq = req.body.isHq ? true : null;
  newLabel.isDmb = req.body.isDmb ? true : null;
  newLabel.isVr = req.body.isVr ? true : null;
  newLabel.maxNum = req.body.maxNum ? req.body.maxNum : 9000;

  try {
    const newLabelData = await newLabel.save();
    res.status(201).json(newLabelData);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/:label", async (req, res) => {
  const { label } = req.params;

  try {
    const updatedLabel = await Labels.updateMany({ label }, req.body);

    if (!updatedLabel) {
      return res.status(404).json({ message: "Label not found" });
    }

    res.json(updatedLabel);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 40;
    const skip = (page - 1) * limit;
    const isSortAsc = req.query.sort === "asc";

    const labelStats = await Labels.aggregate([
      // First stage: Get all labels
      {
        $project: {
          _id: 1,
          label: 1,
          prefix: 1,
          is3digits: 1,
          name: 1,
        },
      },
      // Second stage: Group by label to get distinct values
      {
        $group: {
          _id: "$label",
          label: { $first: "$label" },
          prefix: { $first: "$prefix" },
          name: { $first: "$name" },
          is3digits: { $first: "$is3digits" },
        },
      },
      // Third stage: Add a field that matches the movie count pattern
      {
        $lookup: {
          from: "movies",
          let: { labelValue: "$label" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $regexMatch: {
                    input: "$code",
                    regex: {
                      $concat: ["^", "$$labelValue", "-"],
                    },
                  },
                },
              },
            },
            {
              $project: {
                code: 1,
              },
            },
          ],
          as: "movies",
        },
      },
      // Fourth stage: Add the count and movie codes
      {
        $addFields: {
          movieCount: { $size: "$movies" },
          movieCodes: { $slice: ["$movies.code", 0, 3] },
        },
      },
      // Fifth stage: Remove the movies array as we only need the count and codes
      {
        $project: {
          movies: 0,
        },
      },
      // Sixth stage: Sort by movie count in the desired order
      {
        $sort: { movieCount: isSortAsc ? 1 : -1, label: 1 },
      },
      // Seventh stage: Facet to handle pagination and total count
      {
        $facet: {
          metadata: [{ $count: "totalLabels" }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ]);

    const metadata = labelStats[0].metadata[0];
    const labels = labelStats[0].data;

    // If no results found
    if (!metadata) {
      return res.json({
        labels: [],
        currentPage: page,
        totalPages: 0,
        totalItems: 0,
      });
    }

    const totalLabels = metadata.totalLabels;
    const totalPages = Math.ceil(totalLabels / limit);

    res.json({
      labels,
      currentPage: page,
      totalPages,
      totalItems: totalLabels,
    });
  } catch (error) {
    console.error("Error fetching labels with counts:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

module.exports = router;
