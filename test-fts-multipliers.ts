import * as dotenv from "dotenv";
import knex from "knex";

// Load environment variables FIRST
dotenv.config({ path: ".env.local" });

async function testSearchModes() {
  const db = knex({
    client: "pg",
    connection: process.env.DATABASE_URL,
    pool: { min: 0, max: 1 },
  });

  const testQueries = [
    "casamento união",
    "direito consumidor",
    "processo civil"
  ];

  console.log("\n🧪 Testando diferentes queries e métodos de normalização\n");
  console.log("=".repeat(80));

  for (const query of testQueries) {
    console.log(`\n\n📝 Query: "${query}"`);
    console.log("-".repeat(80));

    // Test with different multipliers
    const multipliers = [3, 5, 10, 20];
    
    for (const mult of multipliers) {
      const results = await db.raw(`
        SELECT 
          external_id,
          SUBSTRING(content, 1, 60) as preview,
          ts_rank(fts_tokens, plainto_tsquery('portuguese_unaccent', ?), 1) as raw_score,
          ts_rank(fts_tokens, plainto_tsquery('portuguese_unaccent', ?), 1) * ? as multiplied,
          LEAST(ts_rank(fts_tokens, plainto_tsquery('portuguese_unaccent', ?), 1) * ?, 1.0) as capped
        FROM vector_items
        WHERE fts_tokens @@ plainto_tsquery('portuguese_unaccent', ?)
        ORDER BY capped DESC
        LIMIT 3
      `, [query, query, mult, query, mult, query]);

      if (results.rows.length > 0) {
        console.log(`\n  ✅ Multiplicador x${mult}:`);
        results.rows.forEach((row: any, i: number) => {
          console.log(`     ${i + 1}. ${row.external_id} - ${(row.capped * 100).toFixed(1)}% (raw: ${(row.raw_score * 100).toFixed(2)}%)`);
        });
      } else {
        console.log(`\n  ❌ Multiplicador x${mult}: Nenhum resultado`);
      }
    }

    // Check total matches
    const totalMatches = await db.raw(`
      SELECT COUNT(*) as total
      FROM vector_items
      WHERE fts_tokens @@ plainto_tsquery('portuguese_unaccent', ?)
    `, [query]);
    
    console.log(`\n  📊 Total de documentos com match: ${totalMatches.rows[0].total}`);
  }

  console.log("\n\n" + "=".repeat(80));
  console.log("✅ Teste concluído!\n");
  
  await db.destroy();
  process.exit(0);
}

testSearchModes().catch((error) => {
  console.error("❌ Erro:", error);
  process.exit(1);
});
