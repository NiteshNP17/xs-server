//routes/lookups.js
const express = require("express");
const router = express.Router();
const Prefixes = require("../models/prefixes");
const Movies = require("../models/movies"); // Adjust the path as needed
const Actors = require("../models/actors"); // Adjust the path as needed

router.get("/pre/:pre", async (req, res) => {
  const codenum = parseInt(req.query.codenum);

  const prefixData = await Prefixes.findOne(
    {
      pre: req.params.pre,
      $or: [{ maxNum: { $exists: false } }, { maxNum: { $gte: codenum } }],
    },
    null,
    { sort: { maxNum: 1 } }
  );

  res.json(prefixData ? prefixData : "notFound");
});

router.post("/pre", async (req, res) => {
  const prefix = new Prefixes();
  const { pre, prePre, isHq, isDmb, maxNum } = req.body;
  prefix.pre = pre;

  if (prePre) prefix.prePre = prePre;
  prefix.maxNum = maxNum ? maxNum : 9000;
  if (isHq) prefix.isHq = true;
  if (isDmb) prefix.isDmb = true;

  try {
    const newPreData = await prefix.save();
    res.status(201).json(newPreData);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

//get list of series names
router.get("/series", async (req, res) => {
  try {
    const series = await Movies.distinct("series");
    res.json(series);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get actor names only
router.get("/actor-names", async (req, res) => {
  try {
    const isMale = req.query.male !== undefined;
    const filterCondition = isMale ? { isMale: true } : { isMale: null };
    const actors = await Actors.find(filterCondition, {
      name: 1,
      dob: 1,
    });

    res.json(actors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
