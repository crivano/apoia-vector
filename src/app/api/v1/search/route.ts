import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { generateEmbedding } from "@/lib/embeddings";
import type { SearchResponse, SearchMode } from "@/types";
import nunjucks from "nunjucks";

// Configure nunjucks
nunjucks.configure({ autoescape: false });

// Helper function to detect ID patterns and extract components
function parseIdQuery(query: string): { type: 'full' | 'number' | 'compact' | null, pattern?: string, number?: string } {
  const trimmed = query.trim();
  
  // Full ID pattern: stf-rg-123, stj-rr-456, etc.
  const fullIdMatch = trimmed.match(/^([a-z]+)-([a-z]+)-(\d+)$/i);
  if (fullIdMatch) {
    return { type: 'full', pattern: trimmed.toLowerCase() };
  }
  
  // Just number: 123, 456
  const numberMatch = trimmed.match(/^\d+$/);
  if (numberMatch) {
    return { type: 'number', number: trimmed };
  }
  
  // Compact format: stf123, stj456
  const compactMatch = trimmed.match(/^([a-z]+)(\d+)$/i);
  if (compactMatch) {
    return { type: 'compact', pattern: compactMatch[1].toLowerCase(), number: compactMatch[2] };
  }
  
  return { type: null };
}

// Search by external_id patterns
async function searchByExternalId(
  db: ReturnType<typeof getDb>,
  query: string,
  sourceIds?: string[]
) {
  const parsed = parseIdQuery(query);
  
  if (!parsed.type) return null;
  
  let queryBuilder = db("vector_items as v")
    .select("v.*")
    .orderBy("v.updated_at", "desc")
    .limit(50); // Reasonable limit for ID searches
  
  if (sourceIds && sourceIds.length > 0) {
    queryBuilder = queryBuilder.whereIn("v.data_source_id", sourceIds);
  }
  
  if (parsed.type === 'full') {
    // Exact match on external_id
    queryBuilder = queryBuilder.whereRaw('v.external_id = ?', [parsed.pattern]);
  } else if (parsed.type === 'number') {
    // Match any ID ending with the number
    queryBuilder = queryBuilder.whereRaw('v.external_id LIKE ?', [`%-${parsed.number}`]);
  } else if (parsed.type === 'compact') {
    // Match pattern starting with prefix and containing the number
    queryBuilder = queryBuilder
      .whereRaw('v.external_id LIKE ?', [`${parsed.pattern}-%${parsed.number}`])
      .orWhereRaw('v.external_id LIKE ?', [`${parsed.pattern}-%${parsed.number}-%`]);
  }
  
  const results = await queryBuilder;
  return results.length > 0 ? results : null;
}

// POST /api/search - Perform vector, fulltext, or hybrid search
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      query, 
      sourceSlugs, 
      limit = 10, 
      offset = 0, 
      threshold = 0.3,
      mode = "hybrid" as SearchMode,
      vectorWeight = 0.7,
      debug = false
    } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const db = getDb();
    
    // Convert sourceSlugs to sourceIds if provided
    let sourceIds: string[] | undefined;
    if (sourceSlugs && Array.isArray(sourceSlugs) && sourceSlugs.length > 0) {
      const sources = await db("data_sources")
        .whereIn("slug", sourceSlugs)
        .select("id");
      sourceIds = sources.map(s => s.id);
      
      if (sourceIds.length === 0) {
        return NextResponse.json(
          { error: "No sources found with the provided slugs" },
          { status: 404 }
        );
      }
    }
    
    const textWeight = 1 - vectorWeight;

    let results: Record<string, unknown>[];
    let total: number;
    let searchMethod: string = mode;

    // Try ID-based search first
    const idResults = await searchByExternalId(db, query, sourceIds);
    
    if (idResults && idResults.length > 0) {
      // Found results by ID, return them directly
      results = idResults;
      total = results.length;
      searchMethod = "id";
    } else if (mode === "fulltext") {
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
    const sourcesMap = new Map(sources.map((s: Record<string, unknown>) => [s.id, s]));

    // Format results with rendered templates
    const formattedResults = results.map((item: Record<string, unknown>) => {
      const source = sourcesMap.get(item.source_id as string);
      const originalData = typeof item.original_data === "string" 
        ? JSON.parse(item.original_data) 
        : item.original_data;
      const transformedData = item.transformed_data 
        ? (typeof item.transformed_data === "string" 
          ? JSON.parse(item.transformed_data) 
          : item.transformed_data)
        : null;

      // Render title template if available
      let renderedTitle: string | null = null;
      if (source?.title_template) {
        try {
          renderedTitle = nunjucks.renderString(String(source.title_template), originalData);
        } catch (error) {
          console.error("Error rendering title template:", error);
        }
      }

      // Render display template if available
      let renderedDisplay: string | null = null;
      if (source?.display_template) {
        try {
          renderedDisplay = nunjucks.renderString(String(source.display_template), originalData);
        } catch (error) {
          console.error("Error rendering display template:", error);
        }
      }

      return {
        item: {
          id: String(item.id),
          sourceId: String(item.source_id),
          externalId: String(item.external_id),
          content: String(item.content),
          originalData,
          transformedData,
          createdAt: String(item.created_at),
          updatedAt: String(item.updated_at),
        },
        renderedTitle,
        renderedDisplay,
        similarity: Number(item.combined_score ?? item.vector_score ?? item.text_score ?? 0),
        vectorScore: item.vector_score !== undefined ? Number(item.vector_score) : undefined,
        textScore: item.text_score !== undefined ? Number(item.text_score) : undefined,
        source: source ? transformSource(source) : null,
      };
    });

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
      ...(searchMethod === "id" && { searchMethod: "id" as const }),
    };

    // Add debug info if requested
    if (debug && mode === "vector") {
      const queryEmbedding = await generateEmbedding(query);
      (response as unknown as Record<string, unknown>).debugEmbedding = `[${queryEmbedding.slice(0, 5).join(",")}...]`;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error performing search:", error);
    return NextResponse.json(
      { error: "Failed to perform search", details: String(error) },
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
  // Build OR query for text search (any word matches instead of all words)
  const orQueryStr = `(
    SELECT to_tsquery('portuguese_unaccent', string_agg(lexeme, ' | '))
    FROM unnest(to_tsvector('portuguese_unaccent', ?))
  )`;
  
  let searchQuery = db("vector_items")
    .select(
      "vector_items.*",
      db.raw(`LEAST(ts_rank(fts_tokens, ${orQueryStr}, 1) * 10, 1.0) as text_score`, [query])
    )
    .whereRaw(`fts_tokens @@ ${orQueryStr}`, [query])
    .orderByRaw("text_score DESC");

  if (sourceIds && Array.isArray(sourceIds) && sourceIds.length > 0) {
    searchQuery = searchQuery.whereIn("source_id", sourceIds);
  }

  // Count query with OR logic
  const orQueryStrCount = `(
    SELECT to_tsquery('portuguese_unaccent', string_agg(lexeme, ' | '))
    FROM unnest(to_tsvector('portuguese_unaccent', ?))
  )`;
  
  let countQuery = db("vector_items")
    .whereRaw(`fts_tokens @@ ${orQueryStrCount}`, [query]);
  
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

  // Build params for CTE approach - single embedding reference
  const params: (string | number)[] = [embeddingStr];
  
  let sourceFilterCTE = "";
  if (sourceIds && Array.isArray(sourceIds) && sourceIds.length > 0) {
    sourceFilterCTE = `WHERE source_id IN (${sourceIds.map(() => "?").join(",")})`;
    params.push(...sourceIds);
  }
  
  params.push(threshold, limit, offset);

  // Use CTE for consistent embedding - only one embedding reference
  const results = await db.raw(`
    WITH scored AS (
      SELECT 
        *,
        (1 - (embedding <=> ?::vector)) as vector_score
      FROM vector_items
      ${sourceFilterCTE}
    )
    SELECT * FROM scored
    WHERE vector_score >= ?
    ORDER BY vector_score DESC
    LIMIT ? OFFSET ?
  `, params);

  // Count query with same CTE approach
  const countParams: (string | number)[] = [embeddingStr];
  if (sourceIds && Array.isArray(sourceIds) && sourceIds.length > 0) {
    countParams.push(...sourceIds);
  }
  countParams.push(threshold);

  const totalResult = await db.raw(`
    WITH scored AS (
      SELECT 
        id,
        (1 - (embedding <=> ?::vector)) as vector_score
      FROM vector_items
      ${sourceFilterCTE}
    )
    SELECT COUNT(*) as count FROM scored
    WHERE vector_score >= ?
  `, countParams);

  const total = Number(totalResult.rows[0]?.count) || 0;

  return { results: results.rows, total };
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
  const hasSourceFilter = sourceIds && Array.isArray(sourceIds) && sourceIds.length > 0;

  // Build params for query execution
  const queryParams: (string | number)[] = [query, embeddingStr];
  
  let sourceFilterCTE = "";
  if (hasSourceFilter) {
    sourceFilterCTE = `WHERE v.source_id IN (${sourceIds!.map(() => "?").join(",")})`;
    queryParams.push(...sourceIds!);
  }
  
  queryParams.push(vectorWeight, textWeight, threshold, limit, offset);

  // Use CTE for consistent scores - calculate once, use everywhere
  // OR query allows matching any word instead of requiring all words
  const results = await db.raw(`
    WITH or_query AS (
      SELECT to_tsquery('portuguese_unaccent', string_agg(lexeme, ' | ')) as tsq
      FROM unnest(to_tsvector('portuguese_unaccent', ?))
    ),
    scored AS (
      SELECT 
        v.*,
        (1 - (v.embedding <=> ?::vector)) as vector_score,
        LEAST(COALESCE(ts_rank(v.fts_tokens, oq.tsq, 1), 0) * 10, 1.0) as text_score
      FROM vector_items v
      CROSS JOIN or_query oq
      ${sourceFilterCTE}
    )
    SELECT 
      *,
      (vector_score * ?) + (text_score * ?) as combined_score
    FROM scored
    WHERE vector_score >= ? OR fts_tokens @@ (SELECT tsq FROM or_query)
    ORDER BY (vector_score * ${vectorWeight}) + (text_score * ${textWeight}) DESC
    LIMIT ? OFFSET ?
  `, queryParams);

  // Count query with same CTE approach
  const countParams: (string | number)[] = [query, embeddingStr];
  if (hasSourceFilter) {
    countParams.push(...sourceIds!);
  }
  countParams.push(threshold);

  let countSourceFilterCTE = "";
  if (hasSourceFilter) {
    countSourceFilterCTE = `WHERE source_id IN (${sourceIds!.map(() => "?").join(",")})`;
  }

  const totalResult = await db.raw(`
    WITH or_query AS (
      SELECT to_tsquery('portuguese_unaccent', string_agg(lexeme, ' | ')) as tsq
      FROM unnest(to_tsvector('portuguese_unaccent', ?))
    ),
    scored AS (
      SELECT 
        id,
        (1 - (embedding <=> ?::vector)) as vector_score,
        fts_tokens
      FROM vector_items
      ${countSourceFilterCTE}
    )
    SELECT COUNT(*) as count FROM scored
    WHERE vector_score >= ? OR fts_tokens @@ (SELECT tsq FROM or_query)
  `, countParams);

  const total = Number(totalResult.rows[0]?.count) || 0;

  return { results: results.rows, total };
}

function transformSource(source: Record<string, unknown>) {
  return {
    id: String(source.id),
    slug: String(source.slug),
    name: String(source.name),
    description: source.description ? String(source.description) : undefined,
    endpoint: String(source.endpoint),
    method: source.method as "GET" | "POST",
    displayTemplate: source.display_template ? String(source.display_template) : undefined,
  };
}
