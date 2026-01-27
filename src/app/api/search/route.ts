import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { generateEmbedding } from "@/lib/embeddings";
import type { SearchResponse, SearchMode } from "@/types";

// POST /api/search - Perform vector, fulltext, or hybrid search
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      query, 
      sourceIds, 
      limit = 10, 
      offset = 0, 
      threshold = 0.3,
      mode = "hybrid" as SearchMode,
      vectorWeight = 0.7 
    } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const textWeight = 1 - vectorWeight;

    let results: Record<string, unknown>[];
    let total: number;

    if (mode === "fulltext") {
      // Full-text search only (BM25-style)
      const searchResults = await buildFullTextQuery(db, query, sourceIds, limit, offset);
      results = searchResults.results;
      total = searchResults.total;
    } else if (mode === "vector") {
      // Vector search only
      const queryEmbedding = await generateEmbedding(query);
      const searchResults = await buildVectorQuery(db, queryEmbedding, sourceIds, limit, offset, threshold);
      results = searchResults.results;
      total = searchResults.total;
    } else {
      // Hybrid search - combine vector and fulltext
      const queryEmbedding = await generateEmbedding(query);
      const searchResults = await buildHybridQuery(
        db, query, queryEmbedding, sourceIds, limit, offset, threshold, vectorWeight, textWeight
      );
      results = searchResults.results;
      total = searchResults.total;
    }

    // Get source information for each result
    const sourceIdsFromResults = [...new Set(results.map((r) => r.source_id as string))];
    const sources = sourceIdsFromResults.length > 0 
      ? await db("data_sources").whereIn("id", sourceIdsFromResults)
      : [];
    const sourcesMap = new Map(sources.map((s: { id: string }) => [s.id, s]));

    // Format results
    const formattedResults = results.map((item: Record<string, unknown>) => ({
      item: {
        id: String(item.id),
        sourceId: String(item.source_id),
        externalId: String(item.external_id),
        content: String(item.content),
        originalData: typeof item.original_data === "string" 
          ? JSON.parse(item.original_data) 
          : item.original_data,
        transformedData: item.transformed_data 
          ? (typeof item.transformed_data === "string" 
            ? JSON.parse(item.transformed_data) 
            : item.transformed_data)
          : null,
        createdAt: String(item.created_at),
        updatedAt: String(item.updated_at),
      },
      similarity: Number(item.combined_score ?? item.vector_score ?? item.text_score ?? 0),
      vectorScore: item.vector_score !== undefined ? Number(item.vector_score) : undefined,
      textScore: item.text_score !== undefined ? Number(item.text_score) : undefined,
      source: sourcesMap.get(item.source_id as string) 
        ? transformSource(sourcesMap.get(item.source_id as string)!) 
        : null,
    }));

    const pageSize = limit;
    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    const response: SearchResponse = {
      results: formattedResults,
      total,
      query,
      page,
      pageSize,
      totalPages,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error performing search:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}

// Full-text search using PostgreSQL's built-in FTS
async function buildFullTextQuery(
  db: ReturnType<typeof getDb>,
  query: string,
  sourceIds: string[] | undefined,
  limit: number,
  offset: number
) {
  let searchQuery = db("vector_items")
    .select(
      "vector_items.*",
      db.raw("ts_rank_cd(fts_tokens, plainto_tsquery('portuguese', ?)) as text_score", [query])
    )
    .whereRaw("fts_tokens @@ plainto_tsquery('portuguese', ?)", [query])
    .orderByRaw("text_score DESC");

  if (sourceIds && Array.isArray(sourceIds) && sourceIds.length > 0) {
    searchQuery = searchQuery.whereIn("source_id", sourceIds);
  }

  // Count query
  let countQuery = db("vector_items")
    .whereRaw("fts_tokens @@ plainto_tsquery('portuguese', ?)", [query]);
  
  if (sourceIds && Array.isArray(sourceIds) && sourceIds.length > 0) {
    countQuery = countQuery.whereIn("source_id", sourceIds);
  }

  const totalResult = await countQuery.count("id as count").first();
  const total = Number(totalResult?.count) || 0;
  const results = await searchQuery.limit(limit).offset(offset);

  return { results, total };
}

// Vector search using pgvector
async function buildVectorQuery(
  db: ReturnType<typeof getDb>,
  queryEmbedding: number[],
  sourceIds: string[] | undefined,
  limit: number,
  offset: number,
  threshold: number
) {
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  let searchQuery = db("vector_items")
    .select(
      "vector_items.*",
      db.raw("1 - (embedding <=> ?::vector) as vector_score", [embeddingStr])
    )
    .whereRaw("1 - (embedding <=> ?::vector) >= ?", [embeddingStr, threshold])
    .orderByRaw("embedding <=> ?::vector", [embeddingStr]);

  if (sourceIds && Array.isArray(sourceIds) && sourceIds.length > 0) {
    searchQuery = searchQuery.whereIn("source_id", sourceIds);
  }

  // Count query
  let countQuery = db("vector_items")
    .whereRaw("1 - (embedding <=> ?::vector) >= ?", [embeddingStr, threshold]);
  
  if (sourceIds && Array.isArray(sourceIds) && sourceIds.length > 0) {
    countQuery = countQuery.whereIn("source_id", sourceIds);
  }

  const totalResult = await countQuery.count("id as count").first();
  const total = Number(totalResult?.count) || 0;
  const results = await searchQuery.limit(limit).offset(offset);

  return { results, total };
}

// Hybrid search combining vector and full-text
async function buildHybridQuery(
  db: ReturnType<typeof getDb>,
  query: string,
  queryEmbedding: number[],
  sourceIds: string[] | undefined,
  limit: number,
  offset: number,
  threshold: number,
  vectorWeight: number,
  textWeight: number
) {
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  // ts_rank_cd typically returns values between 0 and ~0.1
  // We normalize it to 0-1 range for fair comparison with vector score
  // Using a multiplier of 10 and capping at 1.0
  const normalizedTextScore = `LEAST(COALESCE(ts_rank_cd(fts_tokens, plainto_tsquery('portuguese', ?)), 0) * 10, 1.0)`;

  // Use a CTE (Common Table Expression) for better performance with RRF-style scoring
  let searchQuery = db("vector_items")
    .select(
      "vector_items.*",
      // Vector score: cosine similarity (0-1)
      db.raw("(1 - (embedding <=> ?::vector)) as vector_score", [embeddingStr]),
      // Text score: normalized to 0-1 range
      db.raw(`${normalizedTextScore} as text_score`, [query]),
      // Combined score with weights
      db.raw(`
        ((1 - (embedding <=> ?::vector)) * ?) + 
        (${normalizedTextScore} * ?) as combined_score
      `, [embeddingStr, vectorWeight, query, textWeight])
    )
    .where(function() {
      // Match if vector similarity passes threshold OR text matches
      this.whereRaw("1 - (embedding <=> ?::vector) >= ?", [embeddingStr, threshold])
        .orWhereRaw("fts_tokens @@ plainto_tsquery('portuguese', ?)", [query]);
    })
    .orderByRaw("combined_score DESC");

  if (sourceIds && Array.isArray(sourceIds) && sourceIds.length > 0) {
    searchQuery = searchQuery.whereIn("source_id", sourceIds);
  }

  // Count query
  let countQuery = db("vector_items")
    .where(function() {
      this.whereRaw("1 - (embedding <=> ?::vector) >= ?", [embeddingStr, threshold])
        .orWhereRaw("fts_tokens @@ plainto_tsquery('portuguese', ?)", [query]);
    });
  
  if (sourceIds && Array.isArray(sourceIds) && sourceIds.length > 0) {
    countQuery = countQuery.whereIn("source_id", sourceIds);
  }

  const totalResult = await countQuery.count("id as count").first();
  const total = Number(totalResult?.count) || 0;
  const results = await searchQuery.limit(limit).offset(offset);

  return { results, total };
}

function transformSource(source: Record<string, unknown>) {
  return {
    id: String(source.id),
    name: String(source.name),
    description: source.description ? String(source.description) : undefined,
    endpoint: String(source.endpoint),
    method: source.method as "GET" | "POST",
  };
}
