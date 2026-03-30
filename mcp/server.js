#!/usr/bin/env node
"use strict";

/**
 * MCP (Model Context Protocol) Server for the WhatsApp Bot.
 * Exposes all bot tools so any MCP-compatible client (Claude Desktop, Cursor, etc.)
 * can use them directly.
 *
 * Run standalone: node mcp/server.js
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

// ─── Load bot modules ─────────────────────────────────────────────────────────
// Adjust paths relative to mcp/ directory
const path = require("path");
const root = path.join(__dirname, "..");
process.chdir(root);

const { getJson } = require("serpapi");
const config = require("../config");
const ragStore = require("../ragStore");
const { generateImage } = require("../imageGenerator");
const { handleFile } = require("../dataAnalyzer");

// ─── Tool definitions ─────────────────────────────────────────────────────────
const TOOL_DEFS = [
  {
    name: "web_search",
    description: "Search the internet using Google (SerpApi). Use for live data, news, prices, events.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "generate_image",
    description: "Generate an image using Gemini AI from a text prompt.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Description of the image to generate" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "search_knowledge",
    description: "Search the bot's local RAG knowledge base for past Q&A pairs.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Topic or question to look up" },
      },
      required: ["query"],
    },
  },
  {
    name: "add_knowledge",
    description: "Add a new Q&A entry to the bot's knowledge base for future retrieval.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "The question or topic" },
        answer: { type: "string", description: "The answer to store" },
      },
      required: ["question", "answer"],
    },
  },
  {
    name: "knowledge_stats",
    description: "Get statistics about the bot's knowledge base.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ─── Server ───────────────────────────────────────────────────────────────────
const server = new Server(
  { name: "whatsapp-bot-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "web_search": {
        if (!config.SERPAPI_KEY || config.SERPAPI_KEY === "your_serpapi_key_here") {
          return { content: [{ type: "text", text: "⚠️ SERPAPI_KEY not configured." }] };
        }
        const results = await getJson({
          engine: "google",
          q: args.query,
          api_key: config.SERPAPI_KEY,
          num: 5,
        });
        const organic = (results.organic_results || []).slice(0, 5);
        const text = organic
          .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet || ""}`)
          .join("\n\n");
        return { content: [{ type: "text", text: text || "No results found." }] };
      }

      case "generate_image": {
        const { imageBuffer, mimeType } = await generateImage(args.prompt);
        return {
          content: [
            { type: "text", text: `Image generated for: "${args.prompt}"` },
            { type: "image", data: imageBuffer.toString("base64"), mimeType },
          ],
        };
      }

      case "search_knowledge": {
        const entries = ragStore.search(args.query);
        if (entries.length === 0) {
          return { content: [{ type: "text", text: "No relevant entries found in knowledge base." }] };
        }
        const text = entries
          .map((e, i) => `[${i + 1}] Q: ${e.question}\n    A: ${e.answer}`)
          .join("\n\n");
        return { content: [{ type: "text", text }] };
      }

      case "add_knowledge": {
        ragStore.addEntry(args.question, args.answer);
        return { content: [{ type: "text", text: `✅ Saved to knowledge base.` }] };
      }

      case "knowledge_stats": {
        const stats = ragStore.getStats();
        const text = `Knowledge Base Stats:\n- Total entries: ${stats.totalEntries}\n- Newest: ${stats.newestEntry || "none"}\n- Top entries:\n${stats.topEntries.map((e) => `  • "${e.question}" (used ${e.useCount}x)`).join("\n")}`;
        return { content: [{ type: "text", text }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🔌 WhatsApp Bot MCP Server running (stdio)");
}

main().catch((e) => {
  console.error("MCP server error:", e);
  process.exit(1);
});
