import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { generateEmbedding } from "@/lib/embeddings";

// GET /api/debug - Debug search scoring
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "coabitação separação judicial casais";
    const externalId = searchParams.get("id") || "stf-rg-560";

    const db = getDb();
    const queryEmbedding = await generateEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    // OR-based tsquery for partial matching
    const orTsQuery = `to_tsquery('portuguese', 
      array_to_string(
        array(SELECT lexeme FROM unnest(to_tsvector('portuguese', $1)) AS t(lexeme)),
        ' | '
      )
    )`;

    // Check specific item with OR-based matching
    const item = await db.raw(`
      SELECT 
        external_id,
        LEFT(content, 100) as content_preview,
        fts_tokens IS NOT NULL as has_fts,
        (1 - (embedding <=> $2::vector)) as vector_score,
        ts_rank_cd(fts_tokens, ${orTsQuery}) as raw_text_rank,
        to_tsvector('portuguese', $1)::text as query_tokens,
        array_to_string(
          array(SELECT lexeme FROM unnest(to_tsvector('portuguese', $1)) AS t(lexeme)),
          ' | '
        ) as or_query
      FROM vector_items 
      WHERE external_id = $3
    `, [query, embeddingStr, externalId]);

    // Check top 5 by vector only
    const topByVector = await db("vector_items")
      .select(
        "external_id",
        db.raw("LEFT(content, 80) as content"),
        db.raw("(1 - (embedding <=> ?::vector)) as vector_score", [embeddingStr])
      )
      .orderByRaw("embedding <=> ?::vector", [embeddingStr])
      .limit(5);

    // Check top 5 by text only (OR-based)
    const topByText = await db.raw(`
      SELECT 
        external_id,
        LEFT(content, 80) as content,
        ts_rank_cd(fts_tokens, ${orTsQuery}) as text_score
      FROM vector_items
      WHERE fts_tokens @@ ${orTsQuery}
      ORDER BY ts_rank_cd(fts_tokens, ${orTsQuery}) DESC
      LIMIT 5
    `, [query, query, query]);

    // Count items with fts_tokens
    const ftsCount = await db("vector_items")
      .whereNotNull("fts_tokens")
      .count("id as count")
      .first();

    return NextResponse.json({
      query,
      targetItem: item.rows[0],
      ftsPopulatedCount: ftsCount?.count,
      topByVector,
      topByText: topByText.rows,
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
