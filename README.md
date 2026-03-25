# 🤖 WhatsApp AI Bot — Powered by Claude (Anthropic)

A WhatsApp bot that uses `whatsapp-web.js` to listen to incoming messages and
replies using Claude AI. No ML training needed — just the Anthropic API.

---

## ✨ Features

- 📱 Connects to your real WhatsApp number via QR scan
- 🧠 Claude AI answers every incoming message intelligently
- 💬 Remembers conversation context per user (configurable history)
- ⏱️ Auto-expires inactive sessions
- 🎭 Customizable bot name, role, and language
- 🔁 Handles multiple users simultaneously

---

## 🚀 Setup

### 1. Prerequisites

- Node.js **v18+** (check: `node -v`)
- A WhatsApp account (personal or business)
- An Anthropic API key → https://console.anthropic.com/

### 2. Install

```bash
git clone <your-repo-url>
cd whatsapp-ai-bot
npm install
```

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env` and fill in your `ANTHROPIC_API_KEY`. Customize `BOT_NAME`, `BOT_ROLE`, etc.

### 4. Run

```bash
npm start
```

A **QR code** will appear in the terminal. Open WhatsApp on your phone:
`Settings → Linked Devices → Link a Device` → scan the QR code.

Once connected, the bot is live! Anyone who messages your number will get an AI-powered reply.

---

## 📁 Project Structure

```
whatsapp-ai-bot/
├── index.js            # Entry point — WhatsApp client + message handler
├── agentPrompt.js      # System prompt builder (edit to change AI persona)
├── conversationStore.js# Per-user conversation memory with session timeout
├── config.js           # Centralized config loaded from .env
├── package.json
└── .env.example        # Copy to .env and fill in your keys
```

---

## ⚙️ Configuration Options

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | **Required.** Your API key |
| `AI_MODEL` | `claude-sonnet-4-5-20251022` | Claude model to use |
| `MAX_TOKENS` | `1024` | Max tokens per AI reply |
| `MAX_HISTORY` | `10` | Messages remembered per user |
| `SESSION_TIMEOUT_MINUTES` | `30` | Inactivity before session reset |
| `BOT_NAME` | `Aria` | Bot's display name |
| `BOT_ROLE` | `a helpful AI assistant` | Bot's role (used in system prompt) |
| `BOT_LANGUAGE` | `English` | Default reply language |

---

## 🎨 Customizing the AI Persona

Edit `agentPrompt.js` to change:
- **Personality** — make it formal, funny, or domain-specific
- **Capabilities** — restrict to only answering about your product/service
- **Rules** — add brand guidelines, off-topic rejections, etc.

Example: turn it into a customer support bot for your store:

```js
return `You are ${config.BOT_NAME}, the support assistant for AcmeCorp.
Only answer questions about our products and services.
For billing issues, direct users to support@acmecorp.com.
...`;
```

---

## 🛡️ Important Notes

- `whatsapp-web.js` uses your real WhatsApp account. Use a **dedicated number** for production.
- The `.wwebjs_auth/` folder stores your session — keep it safe, add it to `.gitignore`.
- WhatsApp's ToS restricts automated messaging. For production/business use, consider the **WhatsApp Business API** (via Meta) instead.
- Group messages are ignored by default. To enable, remove the `if (msg.isGroupMsg) return;` check in `index.js`.

---

## 🔧 Troubleshooting

**QR code not showing?**
→ Make sure `puppeteer` installed correctly. On Linux you may need:
```bash
sudo apt-get install -y libgbm-dev libxshmfence-dev
```

**Auth keeps expiring?**
→ The `.wwebjs_auth/` folder persists your session. Don't delete it between restarts.

**AI not replying?**
→ Check your `ANTHROPIC_API_KEY` in `.env` is correct and has credits.
