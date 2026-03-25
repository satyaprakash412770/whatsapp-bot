const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const Groq = require("groq-sdk");
const config = require("./config");
const { buildSystemPrompt } = require("./agentPrompt");
const conversationStore = require("./conversationStore");

// ─── Init Clients ────────────────────────────────────────────────────────────
const groq = new Groq({ apiKey: config.GROQ_API_KEY });
const SYSTEM_PROMPT = buildSystemPrompt();

const whatsapp = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-features=site-per-process",
    ],
  },
});

// ─── WhatsApp Events ─────────────────────────────────────────────────────────
whatsapp.on("qr", (qr) => {
  console.log("\n📱 Scan this QR code with WhatsApp:\n");
  qrcode.generate(qr, { small: true });
});

whatsapp.on("ready", () => {
  console.log("✅ WhatsApp bot is live and ready!");
  console.log(`🤖 AI Model: ${config.AI_MODEL}`);
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

// ─── Message Handler ─────────────────────────────────────────────────────────
whatsapp.on("message", async (msg) => {
  if (msg.isGroupMsg) return;
  if (msg.from === "status@broadcast") return;

  const userPhone = msg.from;
  const userText = msg.body?.trim();
  if (!userText) return;

  console.log(`📩 [${userPhone}] ${userText}`);

  const chat = await msg.getChat();
  await chat.sendStateTyping();

  try {
    const aiResponse = await askAI(userPhone, userText);
    await msg.reply(aiResponse);
    console.log(`✅ [${userPhone}] Replied`);
  } catch (err) {
    console.error(`❌ Error for ${userPhone}:`, err.message);
    await msg.reply(
      "Sorry, I ran into an issue processing your message. Please try again! 🙏"
    );
  } finally {
    await chat.clearState();
  }
});

// ─── Groq AI Call ─────────────────────────────────────────────────────────────
async function askAI(userId, userMessage) {
  // Get prior conversation history (role: user/assistant, content: string)
  const history = conversationStore.getHistory(userId);

  const response = await groq.chat.completions.create({
    model: config.AI_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: userMessage },
    ],
    max_tokens: config.MAX_TOKENS,
    temperature: 0.7,
  });

  const reply = response.choices[0].message.content;

  // Save both turns to conversation store
  conversationStore.addMessage(userId, "user", userMessage);
  conversationStore.addMessage(userId, "assistant", reply);

  return reply;
}

// ─── Start ────────────────────────────────────────────────────────────────────
whatsapp.initialize();
