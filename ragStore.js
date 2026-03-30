"use strict";

const fs = require("fs");
const path = require("path");
const natural = require("natural");

const KB_DIR = path.join(__dirname, "knowledge");
const KB_FILE = path.join(KB_DIR, "index.json");

// ─── Init ─────────────────────────────────────────────────────────────────────
/** @type {{ id: number, question: string, answer: string, keywords: string[], timestamp: string, useCount: number }[]} */
let kb = [];

function ensureDir() {
  if (!fs.existsSync(KB_DIR)) fs.mkdirSync(KB_DIR, { recursive: true });
}

function load() {
  ensureDir();
  try {
    if (fs.existsSync(KB_FILE)) {
      kb = JSON.parse(fs.readFileSync(KB_FILE, "utf8"));
      console.log(`📚 RAG: Loaded ${kb.length} knowledge entries`);
    } else {
      kb = [];
      console.log("📚 RAG: Starting with empty knowledge base");
    }
  } catch {
    kb = [];
  }
}

function save() {
  ensureDir();
  fs.writeFileSync(KB_FILE, JSON.stringify(kb, null, 2), "utf8");
}

load();

// ─── TF-IDF Tokenizer ─────────────────────────────────────────────────────────
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

function tokenize(text) {
  return tokenizer.tokenize(text.toLowerCase()).map((w) => stemmer.stem(w));
}

function score(entry, queryTokens) {
  const entryTokens = new Set(tokenize(entry.question + " " + entry.keywords.join(" ")));
  let hits = 0;
  for (const qt of queryTokens) {
    if (entryTokens.has(qt)) hits++;
  }
  return queryTokens.length > 0 ? hits / queryTokens.length : 0;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search the knowledge base for entries relevant to the query.
 * Returns top 3 results scoring above a threshold.
 */
function search(query) {
  if (kb.length === 0) return [];
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  return kb
    .map((entry) => ({ entry, score: score(entry, queryTokens) }))
    .filter(({ score }) => score > 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ entry }) => entry);
}

/**
 * Add a new entry to the knowledge base, avoiding near-duplicates.
 */
function addEntry(question, answer) {
  if (!question || !answer || answer.length < 20) return;

  // Deduplicate: skip if a very similar question already exists
  const queryTokens = tokenize(question);
  const existing = kb
    .map((e) => ({ e, s: score(e, queryTokens) }))
    .filter(({ s }) => s > 0.8);
  if (existing.length > 0) {
    // Update use count instead
    existing[0].e.useCount = (existing[0].e.useCount || 0) + 1;
    save();
    return;
  }

  const entry = {
    id: Date.now(),
    question: question.slice(0, 300),
    answer: answer.slice(0, 1000),
    keywords: tokenize(question),
    timestamp: new Date().toISOString(),
    useCount: 0,
  };

  kb.push(entry);
  // Keep KB manageable (max 5000 entries, remove oldest least-used)
  if (kb.length > 5000) {
    kb.sort((a, b) => (a.useCount || 0) - (b.useCount || 0));
    kb = kb.slice(500);
  }
  save();
}

/**
 * Auto-learn from a conversation turn.
 * Only stores if the answer is substantive (not a clarification question).
 */
function autoLearn(question, answer) {
  // Skip vague/short replies and clarification questions
  if (!answer || answer.length < 40) return;
  if (answer.includes("?") && answer.length < 80) return;
  if (answer.startsWith("Sorry")) return;

  addEntry(question, answer);
}

/**
 * Format retrieved entries as context string for the AI.
 */
function formatContext(entries) {
  if (entries.length === 0) return "";
  return entries
    .map((e, i) => `[Memory ${i + 1}]\nQ: ${e.question}\nA: ${e.answer}`)
    .join("\n\n");
}

function getStats() {
  return {
    totalEntries: kb.length,
    newestEntry: kb.length > 0 ? kb[kb.length - 1].timestamp : null,
    topEntries: kb
      .slice()
      .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
      .slice(0, 5)
      .map((e) => ({ question: e.question.slice(0, 60), useCount: e.useCount || 0 })),
  };
}

module.exports = { search, addEntry, autoLearn, formatContext, getStats };
