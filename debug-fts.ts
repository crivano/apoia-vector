// Quick debug script to check FTS and vector scores
import knex from "knex";
import config from "./knexfile";

async function debug() {
  const db = knex(config.development);
  
  try {
    // Check if fts_tokens is populated
    const ftsCheck = await db.raw(`
      SELECT 
        COUNT(*) as total,
        COUNT(fts_tokens) as with_fts,
        COUNT(*) FILTER (WHERE fts_tokens IS NOT NULL) as not_null_fts
      FROM vector_items
    `);
    console.log("FTS Check:", ftsCheck.rows[0]);

    // Check a specific item
    const item = await db.raw(`
      SELECT 
        external_id,
        LEFT(content, 80) as content,
        fts_tokens IS NOT NULL as has_fts,
        LEFT(fts_tokens::text, 200) as fts_preview
      FROM vector_items 
      WHERE external_id = 'stf-rg-560'
    `);
    console.log("\nItem stf-rg-560:", item.rows[0]);

    // Test the tsquery
    const queryTest = await db.raw(`
      SELECT 
        plainto_tsquery('portuguese', 'coabitação separação judicial casais')::text as query,
        to_tsvector('portuguese', 'Ausência de coabitação dos cônjuges como prova da separação de fato')::text as tsvector
    `);
    console.log("\nQuery Test:", queryTest.rows[0]);

    // Test ranking for this item
    const rankTest = await db.raw(`
      SELECT 
        ts_rank_cd(
          to_tsvector('portuguese', 'Ausência de coabitação dos cônjuges como prova da separação de fato'),
          plainto_tsquery('portuguese', 'coabitação separação judicial casais')
        ) as rank,
        to_tsvector('portuguese', 'Ausência de coabitação dos cônjuges como prova da separação de fato') @@ 
        plainto_tsquery('portuguese', 'coabitação separação judicial casais') as matches
    `);
    console.log("\nRank Test:", rankTest.rows[0]);

  } finally {
    await db.destroy();
  }
}

debug().catch(console.error);
