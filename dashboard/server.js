"use strict";

const express = require("express");
const path = require("path");
const { EventEmitter } = require("events");
const ragStore = require("../ragStore");
const { getProviderName } = require("../aiProvider");

const botEvents = new EventEmitter();

const stats = {
  totalMessages: 0,
  totalSearches: 0,
  totalFiles: 0,
  totalImages: 0,
  startedAt: Date.now(),
  activeSessions: {},
  log: [],
};

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

botEvents.on("message", ({ phone, text, type }) => {
  stats.totalMessages += 1;
  if (type === "search") stats.totalSearches += 1;
  if (type === "file")   stats.totalFiles += 1;
  if (type === "image")  stats.totalImages += 1;
  stats.activeSessions[phone] = Date.now();
  stats.log.unshift({ ts: new Date().toISOString(), phone: phone.replace("@c.us", "").replace("@lid",""), text: text?.slice(0, 80), type: type || "text" });
  if (stats.log.length > 50) stats.log.pop();
});

botEvents.on("reply", ({ phone, text, type }) => {
  stats.log.unshift({ ts: new Date().toISOString(), phone: `→ ${phone.replace("@c.us", "").replace("@lid","")}`, text: text?.slice(0, 80), type: type || "reply" });
  if (stats.log.length > 50) stats.log.pop();
});

function getActiveSessions() {
  const now = Date.now();
  return Object.values(stats.activeSessions).filter((t) => now - t < SESSION_TIMEOUT_MS).length;
}

function startDashboard(port = 3001) {
  const app = express();

  app.use(express.static(path.join(__dirname)));

  app.get("/api/stats", (req, res) => {
    const ragStats = ragStore.getStats();
    res.json({
      totalMessages: stats.totalMessages,
      totalSearches: stats.totalSearches,
      totalFiles: stats.totalFiles,
      totalImages: stats.totalImages,
      activeSessions: getActiveSessions(),
      uptimeSeconds: Math.floor((Date.now() - stats.startedAt) / 1000),
      provider: getProviderName(),
      knowledge: {
        totalEntries: ragStats.totalEntries,
        topEntries: ragStats.topEntries,
      },
      log: stats.log.slice(0, 30),
    });
  });

  app.listen(port, () => {
    console.log(`🌐 Dashboard running on http://localhost:${port}`);
  });
}

module.exports = { startDashboard, botEvents };
