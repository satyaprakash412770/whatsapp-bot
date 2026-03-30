"use strict";

const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { getJson } = require("serpapi");
const config = require("./config");
const { buildSystemPrompt } = require("./agentPrompt");
const conversationStore = require("./conversationStore");
const { handleFile } = require("./dataAnalyzer");
const { startDashboard, botEvents } = require("./dashboard/server");
const { chat, getProviderName } = require("./aiProvider");
const ragStore = require("./ragStore");
const { generateImage, isImageRequest, extractImagePrompt } = require("./imageGenerator");

// ─── Global Error Handlers (Prevents Puppeteer crashes) ───────────────────────
process.on("unhandledRejection", (reason, promise) => {
  if (reason?.message?.includes("Target closed") || reason?.message?.includes("Session closed")) {
    console.warn("⚠️ Ignored Puppeteer TargetCloseError:", reason.message);
  } else {
    console.error("❌ Unhandled Rejection:", reason);
  }
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error.message);
});

// ─── Init ─────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = buildSystemPrompt();

// ─── Search Intent Keywords ───────────────────────────────────────────────────
const SEARCH_KEYWORDS = [
  "today", "current", "latest", "right now", "live", "price", "rate", "cost",
  "news", "weather", "score", "result", "stock", "market", "match", "election",
  "breaking", "update", "recent", "who won", "how much", "rupee", "dollar",
  "bitcoin", "crypto", "ipl", "cricket", "gold", "silver", "petrol", "diesel",
  "temperature", "forecast", "trending", "2024", "2025", "2026",
];

function needsSearch(text) {
  const t = text.toLowerCase();
  return SEARCH_KEYWORDS.some((kw) => t.includes(kw));
}

// ─── Web Search (SerpApi) ─────────────────────────────────────────────────────
async function webSearch(query) {
  if (!config.SERPAPI_KEY || config.SERPAPI_KEY === "your_serpapi_key_here") {
    return null; // silently skip — let AI answer from knowledge
  }
  try {
    const results = await getJson({
      engine: "google",
      q: query,
      api_key: config.SERPAPI_KEY,
      num: 5,
    });
    const organic = results.organic_results || [];
    if (organic.length === 0) return null;
    return organic
      .slice(0, 4)
      .map((r, i) => `${i + 1}. ${r.title}: ${r.snippet || ""}`)
      .join("\n");
  } catch (e) {
    console.error("SerpApi error:", e.message);
    return null;
  }
}

// ─── WhatsApp Client ──────────────────────────────────────────────────────────
const whatsapp = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
});

// ─── WhatsApp Events ──────────────────────────────────────────────────────────
whatsapp.on("qr", (qr) => {
  console.log("\n📱 Scan this QR code with WhatsApp:\n");
  qrcode.generate(qr, { small: true });
});

whatsapp.on("ready", () => {
  console.log("✅ WhatsApp bot is live and ready!");
  console.log(`🤖 AI Provider: ${getProviderName()}`);
  console.log(`💬 Max conversation history: ${config.MAX_HISTORY} messages\n`);
});

whatsapp.on("auth_failure", (msg) => {
  console.error("❌ Authentication failed:", msg);
});

whatsapp.on("disconnected", async (reason) => {
  console.warn("⚠️  Bot disconnected:", reason);
  if (reason === "LOGOUT") {
    console.log("🔑 Session logged out. Destroying client and exiting...");
    console.log("   ➜  Delete the .wwebjs_auth folder and run npm start again to re-scan QR.");
    await whatsapp.destroy().catch(() => {});
    process.exit(0);
  }
});

// ─── Message Handler ──────────────────────────────────────────────────────────
whatsapp.on("message", async (msg) => {
  try {
    if (msg.from.endsWith("@g.us")) return;
    if (msg.from === "status@broadcast") return;

    const userPhone = msg.from;
    const userText = msg.body?.trim() || "";

    console.log(`📩 [${userPhone}] hasMedia=${msg.hasMedia} text="${userText.slice(0, 60)}"`);

    // ── 1. File uploads (CSV / JSON) ─────────────────────────────────────────
    if (msg.hasMedia) {
      const media = await msg.downloadMedia().catch((e) => {
        console.error("❌ downloadMedia failed:", e.message);
        return null;
      });
      if (!media) return;

      const mime = media.mimetype?.split(";")[0].trim().toLowerCase();
      const isData =
        mime === "text/csv" ||
        mime === "application/json" ||
        mime === "application/octet-stream" ||
        (media.filename && /\.(csv|json)$/i.test(media.filename));

      console.log(`📂 [${userPhone}] mime=${mime} isData=${isData}`);

      if (!isData) {
        await msg.reply("📎 I can analyse *CSV* and *JSON* data files. Send one and tell me what you'd like to know!");
        return;
      }

      botEvents.emit("message", { phone: userPhone, text: `[File] ${media.filename || mime}`, type: "file" });
      const chat2 = await msg.getChat();
      await chat2.sendStateTyping();

      try {
        const buffer = Buffer.from(media.data, "base64");
        const { text: resultText, imageBuffer } = await handleFile(buffer, mime, userText, userPhone);

        if (imageBuffer) {
          const chartMedia = new MessageMedia("image/png", imageBuffer.toString("base64"), "chart.png");
          await whatsapp.sendMessage(userPhone, chartMedia, { caption: resultText });
        } else {
          await msg.reply(resultText);
        }

        botEvents.emit("reply", { phone: userPhone, text: resultText, type: "file" });
        console.log(`✅ [${userPhone}] File analysed.`);
      } catch (err) {
        console.error(`❌ File error [${userPhone}]:`, err.message);
        await msg.reply("Sorry, I had trouble reading that file. Please make sure it's a valid CSV or JSON. 🙏");
      } finally {
        await chat2.clearState().catch(() => {});
      }
      return;
    }

    if (!userText) return;

    // ── 2. Image generation ──────────────────────────────────────────────────
    if (isImageRequest(userText)) {
      botEvents.emit("message", { phone: userPhone, text: userText, type: "image" });
      const chatObj = await msg.getChat();
      await chatObj.sendStateTyping();

      const prompt = extractImagePrompt(userText);
      console.log(`🎨 [${userPhone}] Generating image: "${prompt}"`);
      await msg.reply(`🎨 Generating image of: *${prompt}*... give me a moment!`);

      try {
        const { imageBuffer, mimeType } = await generateImage(prompt);
        const ext = mimeType.includes("png") ? "png" : "jpg";
        const imgMedia = new MessageMedia(mimeType, imageBuffer.toString("base64"), `image.${ext}`);
        await whatsapp.sendMessage(userPhone, imgMedia, { caption: `✨ Here's your image of: *${prompt}*` });
        botEvents.emit("reply", { phone: userPhone, text: `[Image] ${prompt}`, type: "image" });
        console.log(`✅ [${userPhone}] Image sent.`);
      } catch (err) {
        console.error(`❌ Image gen error [${userPhone}]:`, err.message);
        await msg.reply(`❌ Couldn't generate image: ${err.message}`);
      }
      await chatObj.clearState().catch(() => {});
      return;
    }

    // ── 3. Normal text → AI (with RAG + optional web search) ─────────────────
    botEvents.emit("message", { phone: userPhone, text: userText, type: "text" });
    const chatObj = await msg.getChat();
    await chatObj.sendStateTyping();

    try {
      const { text: aiResponse, usedSearch, usedRag } = await askAI(userPhone, userText);
      await msg.reply(aiResponse);
      botEvents.emit("reply", {
        phone: userPhone,
        text: aiResponse,
        type: usedSearch ? "search" : usedRag ? "rag" : "reply",
      });
      console.log(`✅ [${userPhone}] Replied [search=${usedSearch}, rag=${usedRag}]`);
    } catch (err) {
      console.error(`❌ askAI error [${userPhone}]:`, err.message, err.stack);
      await msg.reply("Sorry, I ran into an issue. Please try again! 🙏");
    } finally {
      await chatObj.clearState().catch(() => {});
    }
  } catch (outerErr) {
    console.error("❌ Unhandled message handler error:", outerErr.message, outerErr.stack);
  }
});

// ─── AI Call with RAG + Web Search Context Injection ─────────────────────────
async function askAI(userId, userMessage) {
  const history = conversationStore.getHistory(userId);
  let usedSearch = false;
  let usedRag = false;
  const contextBlocks = [];

  // ── RAG lookup ──────────────────────────────────────────────────────────────
  const ragHits = ragStore.search(userMessage);
  if (ragHits.length > 0) {
    usedRag = true;
    const ragContext = ragStore.formatContext(ragHits);
    contextBlocks.push(`📚 Relevant past knowledge (use if helpful):\n${ragContext}`);
    console.log(`📚 [${userId}] RAG: ${ragHits.length} hit(s)`);
  }

  // ── Web search (for live data questions) ────────────────────────────────────
  if (needsSearch(userMessage)) {
    const searchResult = await webSearch(userMessage);
    if (searchResult) {
      usedSearch = true;
      contextBlocks.push(`🔍 Live web search results:\n${searchResult}`);
      botEvents.emit("message", { phone: userId, text: `[Search] ${userMessage}`, type: "search" });
      console.log(`🔍 [${userId}] Web search used`);
    }
  }

  // ── Build messages ──────────────────────────────────────────────────────────
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(contextBlocks.length > 0
      ? [{ role: "system", content: contextBlocks.join("\n\n") }]
      : []),
    ...history,
    { role: "user", content: userMessage },
  ];

  const reply = await chat(messages);

  // ── Save to conversation + auto-learn ───────────────────────────────────────
  conversationStore.addMessage(userId, "user", userMessage);
  conversationStore.addMessage(userId, "assistant", reply);
  ragStore.autoLearn(userMessage, reply);

  return { text: reply, usedSearch, usedRag };
}

// ─── Start ────────────────────────────────────────────────────────────────────
startDashboard(config.DASHBOARD_PORT);
whatsapp.initialize();
