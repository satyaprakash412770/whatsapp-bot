require("dotenv").config({ override: true });

module.exports = {
  // ── Groq ───────────────────────────────────────────────────────────────────
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",

  // Model — llama-3.3-70b-versatile is fast, smart, and free
  AI_MODEL: process.env.AI_MODEL || "llama-3.3-70b-versatile",

  // Max tokens in each AI response
  MAX_TOKENS: parseInt(process.env.MAX_TOKENS) || 1024,

  // ── Conversation Memory ────────────────────────────────────────────────────
  MAX_HISTORY: parseInt(process.env.MAX_HISTORY) || 10,
  SESSION_TIMEOUT_MINUTES: parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 30,

  // ── Bot Persona ────────────────────────────────────────────────────────────
  BOT_NAME: process.env.BOT_NAME || "Aria",
  BOT_ROLE: process.env.BOT_ROLE || "a helpful AI assistant",
  BOT_LANGUAGE: process.env.BOT_LANGUAGE || "English",
};
