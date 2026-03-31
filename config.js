require("dotenv").config({ override: true });

module.exports = {
  // ── AI Provider ────────────────────────────────────────────────────────────
  // Set AI_PROVIDER to 'openai' to use OpenAI instead of Groq
  AI_PROVIDER: process.env.AI_PROVIDER || "groq",

  // ── Groq ───────────────────────────────────────────────────────────────────
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o-mini",

  // ── Gemini (Image Generation) ──────────────────────────────────────────────
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",

  // ── SerpApi ────────────────────────────────────────────────────────────────
  SERPAPI_KEY: process.env.SERPAPI_KEY || "",

  // ── Dashboard ──────────────────────────────────────────────────────────────
  DASHBOARD_PORT: parseInt(process.env.PORT) || parseInt(process.env.DASHBOARD_PORT) || 3001,

  // Model — llama-3.1-8b-instant has a higher rate limit on the free tier
  AI_MODEL: process.env.AI_MODEL || "llama-3.1-8b-instant",

  // Max tokens in each AI response
  MAX_TOKENS: parseInt(process.env.MAX_TOKENS) || 1024,

  // ── Conversation Memory ────────────────────────────────────────────────────
  MAX_HISTORY: parseInt(process.env.MAX_HISTORY) || 10,
  SESSION_TIMEOUT_MINUTES: parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 30,

  // ── Bot Persona ────────────────────────────────────────────────────────────
  BOT_NAME: process.env.BOT_NAME || "satya",
  BOT_ROLE: process.env.BOT_ROLE || "a helpful AI assistant",
  BOT_LANGUAGE: process.env.BOT_LANGUAGE || ["English", "Hindi"]
};
