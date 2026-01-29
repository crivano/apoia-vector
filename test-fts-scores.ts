import * as dotenv from "dotenv";
import knex from "knex";

// Load environment variables FIRST
dotenv.config({ path: ".env.local" });

async function testFTSScores() {
  // Create direct connection
  const db = knex({
    client: "pg",
    connection: process.env.DATABASE_URL,
    pool: { min: 0, max: 1 },
  });
  
  // Test query
  const testQuery = "casamento união";
  
  console.log(`\n🔍 Testando busca FTS com query: "${testQuery}"\n`);
  
  // Query 1: Check raw ts_rank_cd values
  console.log("1️⃣ Valores RAW do ts_rank_cd:");
  const rawScores = await db.raw(`
    SELECT 
      external_id,
      SUBSTRING(content, 1, 100) as content_preview,
      ts_rank_cd(fts_tokens, plainto_tsquery('portuguese_unaccent', ?)) as raw_score,
      ts_rank_cd(fts_tokens, plainto_tsquery('portuguese_unaccent', ?)) * 10 as score_x10,
      LEAST(ts_rank_cd(fts_tokens, plainto_tsquery('portuguese_unaccent', ?)) * 10, 1.0) as capped_score
    FROM vector_items
    WHERE fts_tokens @@ plainto_tsquery('portuguese_unaccent', ?)
    ORDER BY raw_score DESC
    LIMIT 10
  `, [testQuery, testQuery, testQuery, testQuery]);

  rawScores.rows.forEach((row: any, i: number) => {
    console.log(`\n  ${i + 1}. ${row.external_id}`);
    console.log(`     Content: ${row.content_preview}...`);
    console.log(`     Raw score: ${row.raw_score}`);
    console.log(`     Score x10: ${row.score_x10}`);
    console.log(`     Capped: ${row.capped_score}`);
  });

  // Query 2: Check ts_rank with different normalization
  console.log("\n\n2️⃣ Comparação de métodos de ranking:");
  const rankComparison = await db.raw(`
    SELECT 
      external_id,
      SUBSTRING(content, 1, 80) as content_preview,
      ts_rank(fts_tokens, plainto_tsquery('portuguese_unaccent', ?)) as ts_rank_default,
      ts_rank(fts_tokens, plainto_tsquery('portuguese_unaccent', ?), 1) as ts_rank_norm1,
      ts_rank(fts_tokens, plainto_tsquery('portuguese_unaccent', ?), 1) * 5 as ts_rank_x5,
      LEAST(ts_rank(fts_tokens, plainto_tsquery('portuguese_unaccent', ?), 1) * 5, 1.0) as final_score,
      ts_rank_cd(fts_tokens, plainto_tsquery('portuguese_unaccent', ?), 32) as ts_rank_cd_normalized
    FROM vector_items
    WHERE fts_tokens @@ plainto_tsquery('portuguese_unaccent', ?)
    ORDER BY final_score DESC
    LIMIT 5
  `, [testQuery, testQuery, testQuery, testQuery, testQuery, testQuery]);

  rankComparison.rows.forEach((row: any, i: number) => {
    console.log(`\n  ${i + 1}. ${row.external_id}`);
    console.log(`     Content: ${row.content_preview}...`);
    console.log(`     ts_rank (default): ${row.ts_rank_default} (${(row.ts_rank_default * 100).toFixed(1)}%)`);
    console.log(`     ts_rank (norm=1): ${row.ts_rank_norm1} (${(row.ts_rank_norm1 * 100).toFixed(1)}%)`);
    console.log(`     ts_rank x5: ${row.ts_rank_x5} (${(row.ts_rank_x5 * 100).toFixed(1)}%)`);
    console.log(`     🎯 Final score: ${row.final_score} (${(row.final_score * 100).toFixed(1)}%)`);
  });

  // Query 3: Test plainto_tsquery output
  console.log("\n\n3️⃣ Tokens gerados pela query:");
  const queryTokens = await db.raw(`
    SELECT plainto_tsquery('portuguese_unaccent', ?) as query_tokens
  `, [testQuery]);
  console.log(`   Query tokens: ${queryTokens.rows[0].query_tokens}`);

  // Query 4: Check if any documents match
  console.log("\n\n4️⃣ Total de documentos que fazem match:");
  const matchCount = await db.raw(`
    SELECT COUNT(*) as total
    FROM vector_items
    WHERE fts_tokens @@ plainto_tsquery('portuguese_unaccent', ?)
  `, [testQuery]);
  console.log(`   Total matches: ${matchCount.rows[0].total}`);

  console.log("\n✅ Teste concluído!\n");
  
  await db.destroy();
  process.exit(0);
}

testFTSScores().catch((error) => {
  console.error("❌ Erro:", error);
  process.exit(1);
});
