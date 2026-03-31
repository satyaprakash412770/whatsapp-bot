const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer so the browser download
  // survives Render's build-to-run transition.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
