//routes/lookups.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const cheerio = require("cheerio");
const Labels = require("../models/labels");
const Tags = require("../models/tags"); // Adjust the path as needed
const Movies = require("../models/movies"); // Adjust the path as needed

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
      // console.log("Video exists at the given URL.");
      return true;
    } else {
      // console.log("Video does not exist at the given URL.");
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
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
    slowMo: 50,
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
    await page.goto(url, {
      waitUntil: "networkidle", // Wait until network is quiet
      timeout: 60000, // Allow 60 seconds for loading
    });

    // Log the entire DOM content
    // const pageContent = await page.content();
    // console.log(pageContent);

    // Add explicit waits before selecting elements
    // await page.waitForSelector("h1", { timeout: 30000 });

    const pageTitle = await page.title();
    console.log("Page loaded with title:", pageTitle);

    // Extract title from h1 tag
    let title = "";
    try {
      await page.waitForSelector("h1", { state: "attached" });
      title = await page.$eval("h1", (el) => el.textContent.trim());
      title = title.slice(code.length + 3);
    } catch (err) {
      console.log("Failed to get title:", err.message);
    }

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

  let tags = [];

  // Check if a specific tag link with text "ABC" exists
  const isPov =
    $('a[rel="tag"]').filter(function () {
      return $(this).text() === "POV";
    }).length > 0;

  const isAsL =
    $('a[rel="tag"]').filter(function () {
      return $(this).text() === "Ass Lover";
    }).length > 0;

  if (isPov) tags.push("pov");
  if (isAsL) tags.push("ass");

  const mrUrl = `https://fourhoi.com/${code}-uncensored-leak/preview.mp4`;
  const isMr = await checkVideoExists(mrUrl);
  const isEn = await checkVideoExists(
    `https://fourhoi.com/${code}-english-subtitle/preview.mp4`
  );
  if (isMr) tags.push("mr");
  if (isEn) tags.push("en");

  return { title, relDate, runtime, tags };
}

router.get("/scrape-actor-page", async (req, res) => {
  try {
    const { actor, startPage, endPage } = req.query;

    // Input validation
    if (!actor) {
      return res.status(400).json({ error: "Actor name is required" });
    }

    // Parse and validate page range
    const start = parseInt(startPage || "1", 10);
    const end = parseInt(endPage || "1", 10);

    // Safety checks for page range
    if (start < 1) {
      return res.status(400).json({ error: "Start page must be at least 1" });
    }
    if (end - start >= 10) {
      return res
        .status(400)
        .json({ error: "Maximum 10 pages can be scraped in a single request" });
    }
    if (start > end) {
      return res
        .status(400)
        .json({ error: "Start page must be less than or equal to end page" });
    }

    const baseUrl = `https://www.javdatabase.com/idols/${actor}/`;

    // Fetch unique labels using aggregation
    const uniqueLabels = await Labels.aggregate([
      { $group: { _id: "$label" } },
      { $project: { label: "$_id", _id: 0 } },
    ]);

    // Convert to Set for efficient lookup
    const allowedLabels = new Set(
      uniqueLabels.map((l) => l.label.toLowerCase())
    );

    // Create a rate limit to prevent overwhelming the server
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Iterate through pages with sequential processing
    const allResults = [];
    const labelsIgnored = [];

    for (let page = start; page <= end; page++) {
      try {
        // Construct URL with pagination
        const url = `${baseUrl}?ipage=${page}`;

        // Add small delay between requests
        await delay(500); // 500ms between requests

        console.log(`Scraping page ${page}...`);

        // Fetch the page content
        const response = await axios.get(url, {
          timeout: 10000, // 10 seconds timeout
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
        });

        // Check for empty or invalid response
        if (!response.data) {
          console.warn(`Empty response for page ${page}`);
          continue;
        }

        // Load HTML with Cheerio
        const $ = cheerio.load(response.data);

        // Get all non-sponsored elements
        const elements = $("p.pcard a.cut-text")
          .filter((i, element) => {
            const $element = $(element);
            const hasSpace =
              $element.text().trim().includes(" ") ||
              $element.text().trim().toLocaleLowerCase() === "bukkake";
            return !hasSpace;
          })
          .get(); // Get the DOM elements array

        console.log(`Found ${elements.length} elements on page ${page}`);

        // Process elements sequentially
        for (const element of elements) {
          const $element = $(element);
          const code = $element.text().trim().toLowerCase();

          if (!code) continue;

          // Check for existing movie
          const existingMovie = await Movies.findOne({ code });
          if (existingMovie) continue;

          // Extract code label and check against whitelist
          const codeLabel = code.split("-")[0];

          if (allowedLabels.has(codeLabel)) {
            allResults.push(code);
          } else {
            if (!labelsIgnored.includes(codeLabel)) {
              labelsIgnored.push(codeLabel);
            }
          }
        }
      } catch (pageError) {
        console.error(`Error scraping page ${page}:`, pageError.message);
      }
    }

    // Remove duplicates
    const uniqueScrapedData = [...new Set(allResults)];

    // Return scraped data
    res.json({
      total: uniqueScrapedData.length,
      data: uniqueScrapedData,
      labelsIgnored,
      start_page: start,
      end_page: end,
      pages_scraped: end - start + 1,
    });
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({
      error: "Failed to scrape data",
      details: error.message,
    });
  }
});

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
