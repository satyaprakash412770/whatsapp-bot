# 🤖 Advanced WhatsApp AI Bot

A powerful, feature-rich WhatsApp bot that uses `whatsapp-web.js` to listen to incoming messages and replies using a multi-provider AI system (Groq/OpenAI).

---

## ✨ Features

- 📱 **Real WhatsApp Connection:** Connects to your real WhatsApp number via QR scan.
- 🧠 **Multi-Provider AI:** Uses Groq (Llama 3.3, Gemma) for blazing fast responses or OpenAI as fallback.
- 🎨 **Image Generation:** Generates images directly in chat (supports Gemini/Placeholder).
- 📚 **Self-Learning RAG:** Automatically learns from conversations and builds a local Knowledge Base.
- 📊 **File Analysis:** Upload CSV or JSON files for instant data analysis and chart generation.
- 🔍 **Live Web Search:** Integrated with SerpApi to search the web for real-time answers.
- 💻 **Local Dashboard:** Monitor bot statistics, active sessions, and live logs locally.
- 💬 **Conversation Context:** Remembers history per user with auto-expiring sessions.

---

## 🚀 Setup

### 1. Prerequisites

- Node.js **v18+**
- A WhatsApp account (personal or business)
- API Keys:
  - **Groq API Key** (Required for primary AI) -> https://console.groq.com/
  - **OpenAI API Key** (Optional fallback) -> https://platform.openai.com/
  - **SerpApi Key** (Optional for web search) -> https://serpapi.com/

### 2. Install

```bash
git clone https://github.com/satyaprakash412770/whatsapp-bot.git
cd whatsapp-bot
npm install
```

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env` and fill in your keys (e.g., `GROQ_API_KEY`, `SERPAPI_KEY`, etc.). Customize `BOT_NAME` and `BOT_ROLE` to adjust the bot's persona.

### 4. Run

```bash
npm start
```

A **QR code** will appear in the terminal. Open WhatsApp on your phone:
`Settings → Linked Devices → Link a Device` → scan the QR code.

The local dashboard will also be available at `http://localhost:3001`.

---

## 📁 Core Structure

```
whatsapp-bot/
├── index.js            # Entry point — WhatsApp client + message handler
├── aiProvider.js       # Multi-provider AI router (Groq / OpenAI)
├── ragStore.js         # Local Knowledge Base & Semantic Search memory
├── imageGenerator.js   # Image generation triggers
├── dataAnalyzer.js     # Parses incoming CSV/JSON files
├── dashboard/          # Local server for live bot statistics
├── conversationStore.js# Per-user conversation memory
├── config.js           # Centralized configuration
└── .env                # Environment variables
```

---

## ⚙️ Configuration Options

| Variable | Default | Description |
|---|---|---|
| `AI_PROVIDER` | `groq` | Primary AI provider (`groq` or `openai`) |
| `GROQ_API_KEY` | — | **Required.** Your Groq API key |
| `OPENAI_API_KEY` | — | Fallback OpenAI API key |
| `SERPAPI_KEY` | — | SerpApi Key for live web search |
| `AI_MODEL` | `llama-3.1-8b-instant` | Groq model to use |
| `MAX_TOKENS` | `1024` | Max tokens per AI reply |
| `MAX_HISTORY` | `10` | Messages remembered per user |
| `DASHBOARD_PORT`| `3001` | Port for the local dashboard |
| `BOT_NAME` | `satya` | Bot's display name |
| `BOT_ROLE` | `a helpful AI assistant` | Bot's role |

---

## 🛡️ Important Notes

- `whatsapp-web.js` uses your real WhatsApp account. Use a **dedicated number** for production.
- The `.wwebjs_auth/` folder stores your session — keep it safe. If the bot stops answering, delete this folder and re-scan the QR code.
- By default, the bot **ignores group messages**.
- Self-messages (texting the bot from its own number) won't trigger the `.on("message")` event. Test from a different number.
