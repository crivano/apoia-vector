import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { embed, embedMany } from "ai";

// Choose embedding provider based on environment variable
// Options: "openai" or "gemini" - both use 1536 dimensions for best quality
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || "openai";

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
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
    ...(isGemini && { providerOptions: geminiProviderOptions }),
  });
  
  return embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  
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
