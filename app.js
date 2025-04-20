import pkg from "@slack/bolt";
const { App } = pkg;
import dotenv from "dotenv";
import { buildAndSendReply } from "./utils/chat.js";
import { getDb } from "./utils/db.js";

dotenv.config();

function validateEnv() {
  const requiredVars = [
    "SLACK_BOT_TOKEN",
    "SLACK_SIGNING_SECRET",
    "SLACK_APP_TOKEN",
    "OPENAI_API_KEY",
    "MONGODB_URI",
  ];
  const missingVars = requiredVars.filter((key) => !process.env[key]);
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }
}

export { validateEnv };

const allowedChannels = process.env.ALLOWED_CHANNELS
  ? process.env.ALLOWED_CHANNELS.split(",")
  : [];

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

app.event("message", async ({ event, client }) => {
  if (event.subtype === "bot_message") return;

  if (allowedChannels.length > 0 && !allowedChannels.includes(event.channel)) {
    return;
  }

  const threadTs = event.thread_ts || event.ts;
  let imageUrls = [];

  // Handle image attachments
  if (event.files && event.files.length > 0) {
    const hasNonImageFiles = event.files.some(file => !file.mimetype.startsWith('image/'));
    if (hasNonImageFiles) {
      await client.chat.postMessage({
        channel: event.channel,
        text: "Sorry, I can only process image attachments. Please send only image files.",
        thread_ts: threadTs,
      });
      return;
    }
    
    // Log when an image is received
    console.log(`Received ${event.files.length} image(s) in channel: ${event.channel}`);
    
    // Collect image URLs
    imageUrls = event.files.map(file => file.url_private);
  }

  // If there's no text and no images, return
  if (!event.text && imageUrls.length === 0) return;

  // Log the received message
  console.log(
    `Received message from user: "${event.text || ''}" with ${imageUrls.length} image(s) in channel: ${event.channel}`
  );

  try {
    const reply = await buildAndSendReply(event.channel, threadTs, event.text, imageUrls);
    await client.chat.postMessage({
      channel: event.channel,
      text: reply,
      thread_ts: threadTs,
    });
  } catch (error) {
    console.error("Error handling message event:", error.message);
    await client.chat.postMessage({
      channel: event.channel,
      text: "Sorry, I encountered an error while processing your message. Please try again.",
      thread_ts: threadTs,
    });
  }
});

// Only start the app if not being imported for testing
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    validateEnv();
    await app.start();
    console.log(`⚡️ Slack GPT bot is running! Listening for messages...`);
  })();
}

// Export for testing
export { app };
