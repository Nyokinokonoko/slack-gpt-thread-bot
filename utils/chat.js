import OpenAI from "openai";
import { getDb } from "./db.js";
import dotenv from "dotenv";
dotenv.config();

let openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function setOpenAIInstance(instance) {
  openai = instance;
}

const MAX_MESSAGES = 50;

async function callOpenAIWithRetry(request, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log("Sending request to OpenAI API:", request);

      const response = await openai.chat.completions.create(request);

      return response;
    } catch (error) {
      if (error.status === 429 && i < retries - 1) {
        console.warn("Rate limit hit, retrying...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        console.error("OpenAI API error:", error);
        throw error;
      }
    }
  }
}

export async function processImage(imageUrl) {
  try {
    console.log("Processing image URL:", imageUrl);
    
    // Extract file ID from Slack URL
    // Slack URLs typically look like: https://files.slack.com/files-pri/TXXXXXX-FXXXXXX/download/example.png
    const urlParts = imageUrl.split('/');
    console.log("URL parts:", urlParts);
    
    // Try different URL patterns
    let fileId;
    if (urlParts.includes('files-pri')) {
      fileId = urlParts[urlParts.indexOf('files-pri') + 1];
    } else if (urlParts.includes('files')) {
      fileId = urlParts[urlParts.indexOf('files') + 1];
    } else {
      // Try to extract from the last part of the URL
      const lastPart = urlParts[urlParts.length - 1];
      fileId = lastPart.split('?')[0];
    }
    
    console.log("Extracted file ID:", fileId);
    
    if (!fileId) {
      throw new Error("Could not extract file ID from URL");
    }

    // Try to directly fetch the image from the original URL
    console.log("Attempting to fetch image directly from URL");
    const directResponse = await fetch(imageUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
    });

    if (directResponse.ok) {
      console.log("Successfully fetched image directly");
      const contentType = directResponse.headers.get("content-type");
      if (!contentType || !contentType.startsWith("image/")) {
        throw new Error(`Invalid image format: ${contentType}`);
      }

      const buffer = await directResponse.arrayBuffer();
      const base64Image = Buffer.from(buffer).toString("base64");
      return `data:${contentType};base64,${base64Image}`;
    }

    console.log("Direct fetch failed, trying files.info API");
    
    // If direct fetch fails, try the files.info API
    const fileInfoUrl = `https://slack.com/api/files.info?file=${fileId}`;
    console.log("Requesting file info from:", fileInfoUrl);
    
    const fileInfoResponse = await fetch(fileInfoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    
    const fileInfo = await fileInfoResponse.json();
    console.log("File info response:", fileInfo);
    
    if (!fileInfo.ok) {
      // If files.info fails, try to use the original URL with a different approach
      console.log("Files.info API failed, trying alternative approach");
      
      // Try to fetch the image with a different URL format
      const altUrl = `https://files.slack.com/files-pri/${fileId}/download`;
      console.log("Trying alternative URL:", altUrl);
      
      const altResponse = await fetch(altUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        },
      });
      
      if (!altResponse.ok) {
        throw new Error(`Failed to fetch image: ${altResponse.status} ${altResponse.statusText}`);
      }
      
      const contentType = altResponse.headers.get("content-type");
      if (!contentType || !contentType.startsWith("image/")) {
        throw new Error(`Invalid image format: ${contentType}`);
      }
      
      const buffer = await altResponse.arrayBuffer();
      const base64Image = Buffer.from(buffer).toString("base64");
      return `data:${contentType};base64,${base64Image}`;
    }

    // Get the actual image URL from the file info
    const actualImageUrl = fileInfo.file.url_private;
    if (!actualImageUrl) {
      throw new Error("No image URL found in file info");
    }

    console.log("Found actual image URL:", actualImageUrl);

    // Now fetch the actual image
    const response = await fetch(actualImageUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.startsWith("image/")) {
      throw new Error(`Invalid image format: ${contentType}`);
    }

    // Extract the file extension from the URL or content type
    const fileExtension = fileInfo.file.filetype.split('/')[1]?.toLowerCase() || 
                         actualImageUrl.split(".").pop().toLowerCase();
    const supportedFormats = ["png", "jpeg", "jpg", "gif", "webp"];

    if (!supportedFormats.includes(fileExtension)) {
      throw new Error(
        `Unsupported image format. Supported formats are: ${supportedFormats.join(", ")}`
      );
    }

    const buffer = await response.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString("base64");

    // Return the base64 image with the correct MIME type prefix
    return `data:${contentType};base64,${base64Image}`;
  } catch (error) {
    console.error("Error processing image:", error);
    throw new Error(`Failed to process image: ${error.message}`);
  }
}

export async function buildAndSendReply(
  channel,
  thread_ts,
  userMessage,
  images = []
) {
  const db = await getDb();
  const conversations = db.collection("conversations");

  let convo;
  try {
    convo = await conversations.findOne({ thread_ts });
    if (!convo) {
      convo = { thread_ts, channel, messages: [], created_at: new Date() };
    }

    // Process images if present
    let content = [];
    if (images.length > 0) {
      const processedImages = await Promise.all(
        images.map(async (imageUrl) => ({
          type: "image_url",
          image_url: {
            url: await processImage(imageUrl),
          },
        }))
      );
      content = [...processedImages];
    }

    // Add text content if present
    if (userMessage) {
      content.push({ type: "text", text: userMessage });
    }

    convo.messages.push({ role: "user", content });

    if (convo.messages.length > MAX_MESSAGES) {
      convo.messages = convo.messages.slice(-MAX_MESSAGES);
    }
  } catch (error) {
    console.error(
      "Error fetching or initializing conversation:",
      error.message
    );
    throw new Error("Failed to process conversation");
  }

  let assistantReply;
  try {
    const response = await callOpenAIWithRetry({
      model: "gpt-4.1",
      messages: convo.messages,
      max_tokens: 4096,
      temperature: 0.7,
    });

    assistantReply = response.choices[0].message.content.trim();
    convo.messages.push({ role: "assistant", content: assistantReply });
    convo.updated_at = new Date();
  } catch (error) {
    console.error("Error from OpenAI API:", error.message);
    throw new Error("Failed to generate reply");
  }

  try {
    await conversations.updateOne(
      { thread_ts },
      { $set: convo },
      { upsert: true }
    );
  } catch (error) {
    console.error("Error updating conversation in database:", error.message);
    throw new Error("Failed to save conversation");
  }

  return assistantReply;
}
