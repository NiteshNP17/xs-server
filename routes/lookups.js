//routes/lookups.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const cheerio = require("cheerio");
const Labels = require("../models/labels");

router.get("/label/:label", async (req, res) => {
  const codenum = req.query.codenum ? parseInt(req.query.codenum) : null;

  let query = { label: req.params.label };

  if (codenum !== null) {
    query.maxNum = { $gte: codenum };
  }

  const labelData = await Labels.findOne(query, null, {
    sort: { maxNum: 1 },
  });

  res.json(labelData ? labelData : "notFound");
});

router.post("/label", async (req, res) => {
  const newLabel = new Labels(req.body);
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

function convertToMinutes(timeString) {
  const [hours, minutes, seconds] = timeString.split(":").map(Number);
  return Math.floor(hours * 60 + minutes + seconds / 60);
}

router.get("/scrape", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: "code is required" });
    }

    const url = `https://njav.tv/en/v/${code}`;

    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    // Extract title from h1 tag
    let title = $("h1").first().text().trim();
    title = title.slice(code.length + 1);

    // Extract relDate and runtime
    let relDate = "";
    let runtime = "";

    $("div").each((index, element) => {
      const $element = $(element);
      const spans = $element.find("span");
      if (spans.length === 2) {
        const labelSpan = spans.first().text().trim();
        const valueSpan = spans.last().text().trim();

        if (labelSpan === "Release date:") {
          relDate = valueSpan;
        } else if (labelSpan === "Runtime:") {
          runtime = convertToMinutes(valueSpan);
        }
      }
    });

    res.json({
      title,
      relDate,
      runtime,
    });
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({ error: "An error occurred while scraping" });
  }
});

module.exports = router;
