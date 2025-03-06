//routes/lookups.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const cheerio = require("cheerio");
const Labels = require("../models/labels");
const Tags = require("../models/tags"); // Adjust the path as needed

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
    /*const [codeLabel, codeNum] = code.split("-");
    let posterUrl;


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
    }*/

    const url = `https://123av.com/en/dm1/v/${code}`;

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
      // posterUrl,
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

    /*//generate poster url
    const posterUrl = `https://pics.pornfhd.com/s/mono/movie/adult/${
      labelData?.imgPre || labelData?.prefix || ""
    }${codeLabel}${codeNum}/${
      labelData?.imgPre || labelData?.prefix || ""
    }${codeLabel}${codeNum}pl.jpg`;
    // }${codeLabel}${labelData?.is3digits ? codeNum : codeNumPadded}pl.jpg`;*/

    const response = await axios.get(url);

    if (!response) console.error("No response from URL");

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

    const mrUrl = `https://fourhoi.com/${code}-uncensored-leak/preview.mp4`;
    const isMr = await checkVideoExists(mrUrl);

    const data1 = {
      title,
      relDate,
      runtime,
      isMr,
      // posterUrl,
    };

    // console.log("data1: ", data1);

    res.json(data1);
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({ error: "An error occurred while scraping" });
  }
});

async function checkVideoExists(url) {
  try {
    const response = await axios.head(url);
    if (response.status === 200) {
      console.log("Video exists at the given URL.");
      return true;
    } else {
      console.log("Video does not exist at the given URL.");
      return false;
    }
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log("Video does not exist at the given URL.");
      return false;
    } else if (error.request) {
      // The request was made but no response was received
      console.log("No response received from the server.");
      return false;
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log("Error:", error.message);
      return false;
    }
  }
}

async function scrapeMovieData(code) {
  const url = `https://www.javdatabase.com/movies/${code}/`;
  const response = await axios.get(url);
  const html = response.data;
  const $ = cheerio.load(html);

  // Extract title from h1 tag
  let title = $("h1").first().text().trim();
  title = title.slice(code.length + 3);

  // Extract relDate and runtime
  const pElements = $("p.mb-1");
  let relDate = "";
  let runtime = 0;

  pElements.each((index, element) => {
    const $element = $(element);
    const spanText = $element.find("b").text().trim();

    if (spanText === "Release Date:") {
      relDate = $element
        .contents()
        .filter(function () {
          return this.type === "text";
        })
        .text()
        .trim();
    } else if (spanText === "Runtime:") {
      runtime = $element
        .contents()
        .filter(function () {
          return this.type === "text";
        })
        .text()
        .trim()
        .slice(0, 3);
      runtime = parseInt(runtime);
    }
  });

  const mrUrl = `https://fourhoi.com/${code}-uncensored-leak/preview.mp4`;
  const isMr = await checkVideoExists(mrUrl);

  return { title, relDate, runtime, isMr };
}

// Keep the original route
router.get("/scrape-jd", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: "code is required" });
    }
    const data = await scrapeMovieData(code);
    if (!data) console.error("No response from URL");
    res.json(data);
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({ error: "An error occurred while scraping" });
  }
});

router.get("/tags", async (req, res) => {
  try {
    let searchQuery;

    if (req.query.q) {
      const reqQuery = req.query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      searchQuery = new RegExp(`\\b${reqQuery}`, "i");
    }

    const tags = await Tags.find(searchQuery ? { name: searchQuery } : {});
    res.json(tags);
  } catch (err) {
    console.error("fetching tags error:", err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching tags - ", err });
  }
});

module.exports = { router, scrapeMovieData };
