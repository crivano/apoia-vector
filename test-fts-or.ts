import * as dotenv from "dotenv";
import knex from "knex";

dotenv.config({ path: ".env.local" });

async function testFTSOperators() {
  const db = knex({
    client: "pg",
    connection: process.env.DATABASE_URL,
    pool: { min: 0, max: 1 },
  });

  const testQuery = "previdência tributário";

  console.log(`\n🔍 Testando FTS com query: "${testQuery}"\n`);
  console.log("=".repeat(80));

  // Test 1: plainto_tsquery (AND - comportamento padrão)
  console.log("\n1️⃣ plainto_tsquery (AND - padrão):");
  console.log("   Query: 'casament' & 'unia' (ambas palavras devem estar presentes)\n");
  
  const andResults = await db.raw(`
    SELECT 
      external_id,
      SUBSTRING(content, 1, 100) as preview,
      plainto_tsquery('portuguese_unaccent', ?) as tsquery,
      ts_rank(fts_tokens, plainto_tsquery('portuguese_unaccent', ?), 1) * 10 as score
    FROM vector_items
    WHERE fts_tokens @@ plainto_tsquery('portuguese_unaccent', ?)
    ORDER BY score DESC
    LIMIT 5
  `, [testQuery, testQuery, testQuery]);

  console.log(`   Resultados encontrados: ${andResults.rows.length}`);
  andResults.rows.forEach((row: any, i: number) => {
    console.log(`   ${i + 1}. ${row.external_id} - Score: ${(row.score * 100).toFixed(1)}%`);
    console.log(`      ${row.preview}...`);
  });

  // Test 2: OR query usando to_tsquery
  console.log("\n\n2️⃣ OR query (pelo menos uma palavra deve estar presente):");
  console.log("   Query: 'casament' | 'unia' (qualquer uma das palavras)\n");
  
  const orResults = await db.raw(`
    SELECT 
      external_id,
      SUBSTRING(content, 1, 100) as preview,
      (
        SELECT to_tsquery('portuguese_unaccent', string_agg(lexeme, ' | '))
        FROM unnest(to_tsvector('portuguese_unaccent', ?))
      ) as tsquery,
      ts_rank(
        fts_tokens, 
        (
          SELECT to_tsquery('portuguese_unaccent', string_agg(lexeme, ' | '))
          FROM unnest(to_tsvector('portuguese_unaccent', ?))
        ),
        1
      ) * 10 as score
    FROM vector_items
    WHERE fts_tokens @@ (
      SELECT to_tsquery('portuguese_unaccent', string_agg(lexeme, ' | '))
      FROM unnest(to_tsvector('portuguese_unaccent', ?))
    )
    ORDER BY score DESC
    LIMIT 5
  `, [testQuery, testQuery, testQuery]);

  console.log(`   Resultados encontrados: ${orResults.rows.length}`);
  orResults.rows.forEach((row: any, i: number) => {
    console.log(`   ${i + 1}. ${row.external_id} - Score: ${(row.score * 100).toFixed(1)}%`);
    console.log(`      ${row.preview}...`);
  });

  console.log("\n\n" + "=".repeat(80));
  
  // Test 3: Compare counts
  const andCount = await db.raw(`
    SELECT COUNT(*) as total
    FROM vector_items
    WHERE fts_tokens @@ plainto_tsquery('portuguese_unaccent', ?)
  `, [testQuery]);

  const orCount = await db.raw(`
    SELECT COUNT(*) as total
    FROM vector_items
    WHERE fts_tokens @@ (
      SELECT to_tsquery('portuguese_unaccent', string_agg(lexeme, ' | '))
      FROM unnest(to_tsvector('portuguese_unaccent', ?))
    )
  `, [testQuery]);

  console.log("\n📊 Comparação de totais:");
  console.log(`   AND (ambas palavras): ${andCount.rows[0].total} documentos`);
  console.log(`   OR (qualquer palavra): ${orCount.rows[0].total} documentos`);
  console.log(`   Diferença: +${orCount.rows[0].total - andCount.rows[0].total} documentos com OR\n`);

  console.log("✅ Teste concluído!\n");
  
  await db.destroy();
  process.exit(0);
}

testFTSOperators().catch((error) => {
  console.error("❌ Erro:", error);
  process.exit(1);
});
