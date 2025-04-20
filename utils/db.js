import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI);
let db;

export async function getDb() {
  if (!db) {
    try {
      await client.connect();
      db = client.db(process.env.MONGODB_DB_NAME || "slack-gpt");
    } catch (error) {
      console.error("Failed to connect to MongoDB:", error.message);
      throw new Error("Database connection failed");
    }
  }
  return db;
}
