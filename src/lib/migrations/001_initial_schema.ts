import type { Knex } from "knex";

// Vector dimensions: 1536 for both OpenAI and Gemini (with outputDimensionality)
// This provides the best quality (MTEB 68.17) and consistency between providers
const VECTOR_DIMENSIONS = 1536;

export async function up(knex: Knex): Promise<void> {
  // Enable pgvector extension
  await knex.raw("CREATE EXTENSION IF NOT EXISTS vector");

  // Create data_sources table
  await knex.schema.createTable("data_sources", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("name").notNullable();
    table.text("description");
    table.string("endpoint").notNullable();
    table.enum("method", ["GET", "POST"]).defaultTo("GET");
    table.jsonb("headers").defaultTo("{}");
    table.jsonb("body").defaultTo("{}");
    table.jsonb("query_params").defaultTo("{}");
    
    // JSONPath mappings
    table.string("array_path").notNullable();
    table.string("id_path").notNullable();
    table.string("content_path").notNullable();
    table.text("content_template");
    
    // Pagination config
    table.jsonb("pagination");
    
    // Transform
    table.text("transform_script");
    
    // Sync settings
    table.integer("sync_interval").defaultTo(60); // minutes
    table.boolean("is_active").defaultTo(true);
    table.timestamp("last_sync");
    table.text("last_error");
    table.integer("item_count").defaultTo(0);
    
    table.timestamps(true, true);
  });

  // Create vector_items table
  await knex.schema.createTable("vector_items", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("source_id").notNullable().references("id").inTable("data_sources").onDelete("CASCADE");
    table.string("external_id").notNullable();
    table.text("content").notNullable();
    table.jsonb("original_data").notNullable();
    table.jsonb("transformed_data");
    table.timestamps(true, true);
    
    // Unique constraint on source + external_id
    table.unique(["source_id", "external_id"]);
    
    // Index for faster lookups
    table.index(["source_id"]);
  });

  // Add vector column separately (Knex doesn't support vector type natively)
  await knex.raw(`
    ALTER TABLE vector_items 
    ADD COLUMN embedding vector(${VECTOR_DIMENSIONS})
  `);

  // Create index for vector similarity search
  await knex.raw(`
    CREATE INDEX vector_items_embedding_idx 
    ON vector_items 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
  `);

  // Create sync_logs table for tracking sync history
  await knex.schema.createTable("sync_logs", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("source_id").notNullable().references("id").inTable("data_sources").onDelete("CASCADE");
    table.integer("added").defaultTo(0);
    table.integer("updated").defaultTo(0);
    table.integer("deleted").defaultTo(0);
    table.jsonb("errors").defaultTo("[]");
    table.integer("duration").defaultTo(0); // milliseconds
    table.enum("status", ["success", "partial", "failed"]).defaultTo("success");
    table.timestamps(true, true);
    
    table.index(["source_id", "created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("sync_logs");
  await knex.schema.dropTableIfExists("vector_items");
  await knex.schema.dropTableIfExists("data_sources");
  await knex.raw("DROP EXTENSION IF EXISTS vector");
}
