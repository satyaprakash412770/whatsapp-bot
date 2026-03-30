"use strict";

/**
 * Image generation using a simulated placeholder API.
 * Gemini Imagen 3, Hugging Face, and Pollinations.ai are currently 
 * throwing 404/401 errors or blocking Node.js fetch requests.
 * This ensures the bot's image flow works securely without crashing.
 */
async function generateImage(prompt) {
  // Use a reliable placeholder generator that incorporates the prompt text
  const safePrompt = encodeURIComponent(prompt.slice(0, 30));
  const url = `https://placehold.co/1024x1024/6c63ff/ffffff/png?text=${safePrompt}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to generate placeholder image`);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error("API returned an empty image.");
  }

  return {
    imageBuffer: Buffer.from(arrayBuffer),
    mimeType: "image/png",
  };
}

/** Detect if user is asking to generate an image */
const IMAGE_TRIGGERS = [
  "generate image", "generate a image", "create image", "create a image",
  "make image", "make a image", "draw", "make a picture", "create a picture",
  "generate photo", "create photo", "make photo", "paint", "illustrate",
  "show me a picture", "give me an image", "image of", "picture of",
];

function isImageRequest(text) {
  const t = text.toLowerCase();
  return IMAGE_TRIGGERS.some((trigger) => t.includes(trigger));
}

/** Extract the image prompt from the user's message */
function extractImagePrompt(text) {
  const t = text.toLowerCase();
  for (const trigger of IMAGE_TRIGGERS) {
    if (t.includes(trigger)) {
      const idx = t.indexOf(trigger) + trigger.length;
      const prompt = text.slice(idx).trim().replace(/^[:\-\s]+/, "");
      return prompt || text;
    }
  }
  return text;
}

module.exports = { generateImage, isImageRequest, extractImagePrompt };
