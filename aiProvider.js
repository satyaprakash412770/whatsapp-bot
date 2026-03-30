"use strict";

const Groq = require("groq-sdk");
const OpenAI = require("openai");
const config = require("./config");

let _groq = null;
let _openai = null;

function getProvider() {
  return config.AI_PROVIDER === "openai" && config.OPENAI_API_KEY
    ? "openai"
    : "groq";
}

function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: config.GROQ_API_KEY });
  return _groq;
}

function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  return _openai;
}

/**
 * Unified chat completion call.
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Promise<string>} The assistant's reply text
 */
async function chat(messages) {
  const provider = getProvider();

  if (provider === "openai") {
    const response = await getOpenAI().chat.completions.create({
      model: config.OPENAI_MODEL,
      messages,
      max_tokens: config.MAX_TOKENS,
      temperature: 0.7,
    });
    return response.choices[0].message.content;
  }

  // Default: Groq (with failover)
  const models = [config.AI_MODEL, "llama-3.1-8b-instant", "gemma2-9b-it"];
  let lastError = null;

  for (const model of models) {
    try {
      const response = await getGroq().chat.completions.create({
        model,
        messages,
        max_tokens: config.MAX_TOKENS,
        temperature: 0.7,
      });
      return response.choices[0].message.content;
    } catch (err) {
      console.warn(`⚠️ Groq model ${model} failed: ${err.message}`);
      lastError = err;
      // If it's auth/invalid key, fail immediately. If rate limit, try next model.
      if (err.status !== 429) throw err;
    }
  }
  throw lastError || new Error("All Groq models failed.");
}

function getProviderName() {
  return getProvider() === "openai"
    ? `OpenAI (${config.OPENAI_MODEL})`
    : `Groq (${config.AI_MODEL})`;
}

module.exports = { chat, getProviderName };
