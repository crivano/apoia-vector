import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { embed, embedMany } from "ai";
import getDb from "./db";
import crypto from "crypto";

// Choose embedding provider based on environment variable
// Options: "openai" or "gemini" - both use 1536 dimensions for best quality
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || "openai";

// Daily embedding generation limit (0 = unlimited)
const DAILY_EMBEDDING_LIMIT = parseInt(process.env.DAILY_EMBEDDING_LIMIT || "10000", 10);

// Cache TTL in hours (default: 24 hours)
const CACHE_TTL_HOURS = parseInt(process.env.EMBEDDING_CACHE_TTL_HOURS || "24", 10);

// Gemini embedding-001 supports up to 3072 dimensions
// We use 1536 to match OpenAI and get better MTEB score (68.17 vs 67.99)
const isGemini = EMBEDDING_PROVIDER === "gemini";
const embeddingModel = isGemini
  ? google.embedding("gemini-embedding-001")
  : openai.embedding("text-embedding-3-small");

// Both providers now use 1536 dimensions for consistency and quality
export const EMBEDDING_DIMENSIONS = 1536;

// Gemini provider options for outputDimensionality
const geminiProviderOptions = {
  google: {
    outputDimensionality: EMBEDDING_DIMENSIONS,
  },
};

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Generate SHA-256 hash of text for cache key
 */
function hashText(text: string): string {
  return crypto.createHash("sha256").update(text.toLowerCase().trim()).digest("hex");
}

/**
 * Get cached embedding if available and not expired
 */
async function getCachedEmbedding(text: string): Promise<number[] | null> {
  const db = getDb();
  const hash = hashText(text);
  const now = new Date();

  const cached = await db("embedding_cache")
    .where("query_hash", hash)
    .where("expires_at", ">", now)
    .first();

  if (cached) {
    const embedding = typeof cached.embedding === "string" 
      ? JSON.parse(cached.embedding) 
      : cached.embedding;
    return embedding;
  }

  return null;
}

/**
 * Store embedding in cache
 */
async function setCachedEmbedding(text: string, embedding: number[]): Promise<void> {
  const db = getDb();
  const hash = hashText(text);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + CACHE_TTL_HOURS);

  await db("embedding_cache")
    .insert({
      query_hash: hash,
      query_text: text,
      embedding: JSON.stringify(embedding),
      expires_at: expiresAt,
    })
    .onConflict("query_hash")
    .merge({
      embedding: JSON.stringify(embedding),
      expires_at: expiresAt,
      updated_at: new Date(),
    });
}

/**
 * Check and increment daily embedding usage
 * Throws error if daily limit is exceeded
 */
async function checkAndIncrementUsage(count: number): Promise<void> {
  // If limit is 0, unlimited usage is allowed
  if (DAILY_EMBEDDING_LIMIT === 0) {
    return;
  }

  const db = getDb();
  const today = getTodayDate();

  // Use a transaction to ensure atomic read-increment-write
  await db.transaction(async (trx) => {
    // Get or create today's usage record
    let usage = await trx("embedding_usage")
      .where("usage_date", today)
      .first();

    if (!usage) {
      // Create today's record
      await trx("embedding_usage").insert({
        usage_date: today,
        count: 0,
      });
      usage = { count: 0 };
    }

    const currentCount = Number(usage.count) || 0;
    const newCount = currentCount + count;

    // Check if we would exceed the limit
    if (newCount > DAILY_EMBEDDING_LIMIT) {
      throw new Error(
        `Daily embedding limit exceeded. Used: ${currentCount}/${DAILY_EMBEDDING_LIMIT}. ` +
        `Requested: ${count}. Please try again tomorrow.`
      );
    }

    // Increment the counter
    await trx("embedding_usage")
      .where("usage_date", today)
      .update({
        count: newCount,
        updated_at: new Date(),
      });
  });
}

/**
 * Get current daily usage statistics
 */
export async function getDailyUsage(): Promise<{ date: string; used: number; limit: number; remaining: number }> {
  const db = getDb();
  const today = getTodayDate();

  const usage = await db("embedding_usage")
    .where("usage_date", today)
    .first();

  const used = usage ? Number(usage.count) : 0;
  const limit = DAILY_EMBEDDING_LIMIT;
  const remaining = limit === 0 ? Infinity : Math.max(0, limit - used);

  return {
    date: today,
    used,
    limit,
    remaining,
  };
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Check cache first
  const cached = await getCachedEmbedding(text);
  if (cached) {
    return cached;
  }

  // Check and increment daily usage (1 embedding)
  await checkAndIncrementUsage(1);

  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
    ...(isGemini && { providerOptions: geminiProviderOptions }),
  });
  
  // Store in cache for future use
  await setCachedEmbedding(text, embedding);
  
  return embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  // Check and increment daily usage (count of texts)
  await checkAndIncrementUsage(texts.length);
  
  // Process in batches of 100 (API limit)
  const batchSize = 100;
  const allEmbeddings: number[][] = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: batch,
      ...(isGemini && { providerOptions: geminiProviderOptions }),
    });
    allEmbeddings.push(...embeddings);
  }
  
  return allEmbeddings;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
