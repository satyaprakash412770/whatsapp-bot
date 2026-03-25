const config = require("./config");

/**
 * In-memory conversation store.
 * Keeps per-user message history so Claude has context across messages.
 * Automatically expires sessions after SESSION_TIMEOUT_MINUTES of inactivity.
 */

const store = new Map(); // { phone: { messages: [], lastActive: Date } }

function getOrCreate(phone) {
  if (!store.has(phone)) {
    store.set(phone, { messages: [], lastActive: new Date() });
  }
  return store.get(phone);
}

/**
 * Add a message to a user's conversation history.
 * Automatically trims to MAX_HISTORY messages (pairs).
 */
function addMessage(phone, role, content) {
  const session = getOrCreate(phone);

  // Check session timeout — reset if user was inactive too long
  const timeoutMs = config.SESSION_TIMEOUT_MINUTES * 60 * 1000;
  if (new Date() - session.lastActive > timeoutMs) {
    console.log(`🔄 Session expired for ${phone} — starting fresh`);
    session.messages = [];
  }

  session.messages.push({ role, content });
  session.lastActive = new Date();

  // Keep only the last MAX_HISTORY messages to control token usage
  if (session.messages.length > config.MAX_HISTORY) {
    session.messages = session.messages.slice(-config.MAX_HISTORY);
  }
}

/**
 * Get the conversation history for a user (Claude-compatible format).
 */
function getHistory(phone) {
  const session = store.get(phone);
  return session ? [...session.messages] : [];
}

/**
 * Manually clear a user's history (e.g. if they type "reset").
 */
function clearHistory(phone) {
  store.delete(phone);
}

/**
 * Periodically clean up stale sessions from memory.
 */
setInterval(() => {
  const timeoutMs = config.SESSION_TIMEOUT_MINUTES * 60 * 1000 * 2;
  const now = new Date();
  let cleared = 0;
  for (const [phone, session] of store.entries()) {
    if (now - session.lastActive > timeoutMs) {
      store.delete(phone);
      cleared++;
    }
  }
  if (cleared > 0) console.log(`🧹 Cleared ${cleared} stale session(s)`);
}, 15 * 60 * 1000); // Run every 15 minutes

module.exports = { addMessage, getHistory, clearHistory };
