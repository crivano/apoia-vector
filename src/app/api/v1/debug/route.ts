import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { generateEmbedding } from "@/lib/embeddings";

// GET /api/debug - Debug search scoring v3
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "coabitação separação judicial casais";
    const externalId = searchParams.get("id") || "stf-rg-560";

    const db = getDb();
    const queryEmbedding = await generateEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    // Single query to get all info consistently
    const allInOne = await db.raw(`
      WITH vector_ranked AS (
        SELECT 
          external_id,
          content,
          fts_tokens,
          (1 - (embedding <=> ?::vector)) as vector_score,
          ts_rank_cd(fts_tokens, plainto_tsquery('portuguese_unaccent', ?)) as text_score,
          ROW_NUMBER() OVER (ORDER BY embedding <=> ?::vector) as vector_rank
        FROM vector_items
      )
      SELECT 
        external_id,
        LEFT(content, 150) as content,
        vector_score,
        text_score,
        vector_rank,
        fts_tokens IS NOT NULL as has_fts
      FROM vector_ranked
      WHERE vector_rank <= 15 OR external_id = ?
      ORDER BY vector_rank
    `, [embeddingStr, query, embeddingStr, externalId]);

    // Count items with fts_tokens
    const ftsCount = await db("vector_items")
      .whereNotNull("fts_tokens")
      .count("id as count")
      .first();

    // Find the target item in results
    const targetItem = allInOne.rows.find((r: { external_id: string }) => r.external_id === externalId);
    const top15 = allInOne.rows.filter((r: { vector_rank: string }) => parseInt(r.vector_rank) <= 15);

    return NextResponse.json({
      query,
      targetExternalId: externalId,
      targetItem,
      ftsPopulatedCount: ftsCount?.count,
      top15ByVector: top15,
      embeddingPreview: `[${queryEmbedding.slice(0, 5).join(",")}...]`,
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
