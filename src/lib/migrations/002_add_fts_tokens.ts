import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Add full-text search column for hybrid search
  await knex.raw(`
    ALTER TABLE vector_items 
    ADD COLUMN IF NOT EXISTS fts_tokens tsvector;
  `);

  // Create GIN index for fast full-text search
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_vector_items_fts 
    ON vector_items USING GIN (fts_tokens);
  `);

  // Create trigger function to auto-update fts_tokens when content changes
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_fts_tokens()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.fts_tokens := to_tsvector('portuguese', COALESCE(NEW.content, ''));
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Create trigger on insert/update
  await knex.raw(`
    DROP TRIGGER IF EXISTS trigger_update_fts_tokens ON vector_items;
    CREATE TRIGGER trigger_update_fts_tokens
    BEFORE INSERT OR UPDATE OF content ON vector_items
    FOR EACH ROW
    EXECUTE FUNCTION update_fts_tokens();
  `);

  // Populate fts_tokens for existing records
  await knex.raw(`
    UPDATE vector_items 
    SET fts_tokens = to_tsvector('portuguese', COALESCE(content, ''))
    WHERE fts_tokens IS NULL;
  `);

  // Optional: Create HNSW index for better vector search performance (if supported)
  // HNSW is faster than IVFFlat for large datasets
  try {
    await knex.raw(`
      DROP INDEX IF EXISTS idx_vector_items_embedding;
      CREATE INDEX idx_vector_items_embedding_hnsw 
      ON vector_items USING hnsw (embedding vector_cosine_ops);
    `);
  } catch {
    // Fall back to IVFFlat if HNSW is not available
    console.log("HNSW not available, keeping IVFFlat index");
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TRIGGER IF EXISTS trigger_update_fts_tokens ON vector_items;`);
  await knex.raw(`DROP FUNCTION IF EXISTS update_fts_tokens;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_vector_items_fts;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_vector_items_embedding_hnsw;`);
  await knex.raw(`ALTER TABLE vector_items DROP COLUMN IF EXISTS fts_tokens;`);
}
