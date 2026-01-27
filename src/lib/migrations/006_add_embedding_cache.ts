import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Create embedding_cache table to cache query embeddings
  await knex.schema.createTable("embedding_cache", (table) => {
    table.string("query_hash", 64).primary();
    table.text("query_text").notNullable();
    table.jsonb("embedding").notNullable();
    table.timestamp("expires_at").notNullable();
    table.timestamps(true, true);
    
    table.index("expires_at");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("embedding_cache");
}
