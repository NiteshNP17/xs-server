//routes/lookups.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const cheerio = require("cheerio");
const Labels = require("../models/labels");
const puppeteer = require('puppeteer-extra');

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
      { sort: { maxNum: 1 } }
    );

    const url = `https://javdatabase.com/movies/${code}`;

    // Generate poster URL
    const posterUrl = `https://pics.pornfhd.com/s/mono/movie/adult/${labelData?.imgPre || labelData?.prefix || ""}${codeLabel}${codeNum}/${labelData?.imgPre || labelData?.prefix || ""}${codeLabel}${codeNum}pl.jpg`;

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });

    // Extract title
    const titleElement = await page.$('p.mb-1 b:contains("Title:")');    const title = await page.evaluate((el) => el.nextElementSibling.textContent.trim(), titleElement);

    // Extract relDate
    const relDateElement = await page.$('p.mb-1 b:contains("Release Date:")');
    const relDate = await page.evaluate((el) => el.nextElementSibling.textContent.trim(), relDateElement)
    // Extract runtime
    const runtimeElement = await page.$('p.mb-1 b:contains("Runtime:")');
    const runtime = await page.evaluate((el) => el.nextElementSibling.textContent.trim().split(' ')[0], runtimeElement);

    await browser.close();

    res.json({
      title,
      relDate,      runtime,
      posterUrl,
    });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'An error occurred while scraping' });
  }
});

module.exports = router;
