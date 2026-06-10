// Captures article screenshots from the running app (http://localhost:4000).
// Usage: node scripts/screenshots.mjs
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:4000';
const OUT = fileURLToPath(new URL('../article/images/', import.meta.url));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: 'networkidle0' });

// 1. Hero + form (top of page, fresh state)
await page.screenshot({ path: `${OUT}01-home.png` });
console.log('01-home.png');

// 2. Run the default analysis and capture the results table
await page.click('#runBtn');
await page.waitForSelector('#tableWrap:not([hidden])', { timeout: 60000 });
await page.evaluate(() => {
  document.querySelector('.results').scrollIntoView({ block: 'start' });
  // select the top three rows so the action buttons show their live state
  document.querySelectorAll('#resultsBody input[type="checkbox"]').forEach((cb, i) => {
    if (i < 3) cb.click();
  });
});
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `${OUT}02-results.png` });
console.log('02-results.png');

// 3. Tighter crop of the results table itself
const table = await page.$('.results');
await table.screenshot({ path: `${OUT}03-results-table.png` });
console.log('03-results-table.png');

await browser.close();
