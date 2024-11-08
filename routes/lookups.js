//routes/lookups.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const cheerio = require("cheerio");
const Labels = require("../models/labels");

function convertToMinutes(timeString) {
  const [hours, minutes, seconds] = timeString.split(":").map(Number);
  return Math.floor(hours * 60 + minutes + seconds / 60);
}

router.get("/scrape", async (req, res) => {
  try {
    const { code } = req.query;
    const [codeLabel, codeNum] = code.split("-");
    let posterUrl;

    if (!code) {
      return res.status(400).json({ error: "code is required" });
    }

    if (codeLabel !== "fc2") {
      const labelData = await Labels.findOne(
        { label: codeLabel, maxNum: { $gte: parseInt(codeNum) } },
        null,
        {
          sort: { maxNum: 1 },
        }
      );

      //generate poster url
      posterUrl = `https://pics.pornfhd.com/s/mono/movie/adult/${
        labelData?.imgPre || labelData?.prefix || ""
      }${codeLabel}${codeNum}/${
        labelData?.imgPre || labelData?.prefix || ""
      }${codeLabel}${codeNum}pl.jpg`;
      // }${codeLabel}${labelData?.is3digits ? codeNum : codeNumPadded}pl.jpg`;
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
      posterUrl,
    });
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({ error: "An error occurred while scraping" });
  }
});

router.get("/scrape-jt", async (req, res) => {
  try {
    const { code } = req.query;
    const [codeLabel, codeNum] = code.split("-");
    const codeNumPadded = codeNum.padStart(5, "0");

    if (!code) {
      return res.status(400).json({ error: "code is required" });
    }

    const labelData = await Labels.findOne(
      { label: codeLabel, maxNum: { $gte: parseInt(codeNum) } },
      null,
      {
        sort: { maxNum: 1 },
      }
    );

    const url = `https://javtrailers.com/video/${
      labelData?.prefix || ""
    }${codeLabel}${codeNumPadded}`;

    //generate poster url
    const posterUrl = `https://pics.pornfhd.com/s/mono/movie/adult/${
      labelData?.imgPre || labelData?.prefix || ""
    }${codeLabel}${codeNum}/${
      labelData?.imgPre || labelData?.prefix || ""
    }${codeLabel}${codeNum}pl.jpg`;
    // }${codeLabel}${labelData?.is3digits ? codeNum : codeNumPadded}pl.jpg`;

    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    // Extract title from h1 tag
    let title = $("h1").first().text().trim();
    title = title.slice(code.length + 1);

    // Extract relDate and runtime
    const pElements = $("p.mb-1");
    let relDate = "";
    let runtime = "";

    pElements.each((index, element) => {
      const $element = $(element);
      const spanText = $element.find("span").text().trim();

      if (spanText === "Release Date:") {
        relDate = $element
          .contents()
          .filter(function () {
            return this.type === "text";
          })
          .text()
          .trim();
      } else if (spanText === "Duration:") {
        runtime = $element
          .contents()
          .filter(function () {
            return this.type === "text";
          })
          .text()
          .trim()
          .split(" ")[0];
      }
    });

    res.json({
      title,
      relDate,
      runtime,
      posterUrl,
    });
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({ error: "An error occurred while scraping" });
  }
});

module.exports = router;
