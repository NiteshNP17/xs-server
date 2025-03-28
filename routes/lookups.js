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
    console.error("Scraping error: ", error.message);
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

const { chromium } = require("playwright-core");

async function scrapeMovieData2(code) {
  const browser = await chromium.launch({
    // channel: "chrome", // Tries system Chrome first
    headless: true,
    args: ["--no-sandbox"],
  });

  const context = await browser.newContext({
    // Spoof a realistic user agent
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    extraHTTPHeaders: {
      // Add typical headers to make the request look more like a real browser
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-User": "?1",
      "Sec-Fetch-Dest": "document",
    },
  });

  const page = await context.newPage();

  try {
    // Navigate to the movie page
    const url = `https://www.javdatabase.com/movies/${code}/`;
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Check if verification page is present
    const isVerificationPage = await page.evaluate(() => {
      return document.title === "Just a moment...";
    });

    if (isVerificationPage) {
      console.error("Verification page detected. Unable to bypass.");
      await browser.close();
      throw new Error("Human verification page encountered");
    }

    // Log the entire DOM content
    // const pageContent = await page.content();
    // console.log(pageContent);

    // Extract title from h1 tag
    let title = await page.$eval("h1", (el) => el.textContent.trim());
    title = title.slice(code.length + 3);

    // Extract relDate and runtime
    let relDate = "";
    let runtime = 0;

    const pElements = await page.$$("p.mb-1");
    for (const p of pElements) {
      const spanText = await p.$eval("b", (el) => el.textContent.trim());

      if (spanText === "Release Date:") {
        relDate = await p.evaluate((el) => {
          return Array.from(el.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent.trim())
            .join(" ")
            .trim();
        });
      } else if (spanText === "Runtime:") {
        const runtimeText = await p.evaluate((el) => {
          return Array.from(el.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent.trim())
            .join(" ")
            .trim();
        });
        runtime = parseInt(runtimeText.slice(0, 3));
      }
    }

    // Check for video
    const mrUrl = `https://fourhoi.com/${code}-uncensored-leak/preview.mp4`;
    const isMr = await checkVideoExists(mrUrl);

    return { title, relDate, runtime, isMr };
  } finally {
    await browser.close();
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
    const data = await scrapeMovieData2(code);
    if (!data) console.error("No response from URL");
    res.json(data);
  } catch (error) {
    console.error("Scraping error: ", error.message);
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

router.get("/scrape-actor-data", async (req, res) => {
  try {
    const { actor } = req.query;
    const url = `https://www.javdatabase.com/idols/${actor}/`;
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    // Initialize an object to store the actor data
    const actorData = {
      dob: null,
      sizes: null,
      height: null,
      cup: null,
    };

    // Find the div with class "col-12"
    const dataDiv = $("div.col-12");

    // Extract DOB - It's in an <a> tag after a <b> tag with text "DOB:"
    dataDiv.each(function () {
      const divText = $(this).text();

      // Check if this div contains DOB information
      if (divText.includes("DOB:")) {
        // Find the <b> tag with "DOB:" text and get the next <a> tag
        const dobElement = $(this).find('b:contains("DOB:")').next("a");
        if (dobElement.length) {
          actorData.dob = dobElement.text().trim();
        }

        if (divText.includes("Cup:")) {
          const cupEl = $(this).find('b:contains("Cup:")').next("a");
          if (cupEl.length) actorData.cup = cupEl.text().trim();
        }

        if (divText.includes("Height:")) {
          const heightEl = $(this).find('b:contains("Height:")').next("a");
          if (heightEl.length)
            actorData.height = parseInt(heightEl.text().trim().slice(0, 3));
        }

        // Find the <b> tag with "Height:" text and get the text after it
        const sizeElement = $(this).find('b:contains("Measurements:")');
        if (sizeElement.length) {
          // Extract the text after the height label, removing quotes
          const sizeText = sizeElement[0].nextSibling.nodeValue;
          if (sizeText) {
            actorData.sizes = sizeText.trim().slice(-0, -4);
          }
        }
      }
    });

    // Return the scraped data as JSON
    return res.status(200).json({
      success: true,
      data: actorData,
    });
  } catch (err) {
    console.error("Error scraping actor data: ", err.message);
    return res.status(500).json({
      success: false,
      error: "Failed to scrape actor data",
      message: err.message,
    });
  }
});

module.exports = { router, scrapeMovieData };
