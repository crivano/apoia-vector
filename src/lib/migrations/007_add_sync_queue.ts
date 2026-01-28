import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Create sync_queue table for chunked synchronization
  await knex.schema.createTable("sync_queue", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("source_id").notNullable().references("id").inTable("data_sources").onDelete("CASCADE");
    
    // Pagination state
    table.integer("page_number").notNullable(); // Current page number (for page/offset pagination)
    table.text("page_type").notNullable(); // 'page', 'offset', 'cursor', or 'initial'
    table.text("cursor_value").nullable(); // Cursor value for cursor-based pagination
    
    // Processing state
    table.text("status").notNullable().defaultTo("pending"); // 'pending', 'processing', 'completed', 'failed'
    table.text("error_message").nullable();
    table.integer("items_processed").defaultTo(0);
    
    // Sync session tracking
    table.uuid("sync_session_id").notNullable(); // Groups all chunks from same sync run
    
    // Timestamps
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("started_at").nullable();
    table.timestamp("completed_at").nullable();
    
    // Indexes
    table.index(["status", "created_at"]); // For fetching next pending task
    table.index(["sync_session_id"]); // For tracking session progress
    table.index(["source_id", "sync_session_id"]); // For per-source tracking
  });

  // Create sync_sessions table to track overall sync progress
  await knex.schema.createTable("sync_sessions", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.text("status").notNullable().defaultTo("running"); // 'running', 'completed', 'failed', 'partial'
    table.integer("total_chunks").defaultTo(0);
    table.integer("completed_chunks").defaultTo(0);
    table.integer("failed_chunks").defaultTo(0);
    table.integer("total_items_added").defaultTo(0);
    table.integer("total_items_updated").defaultTo(0);
    table.integer("total_items_deleted").defaultTo(0);
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("completed_at").nullable();
    
    table.index(["status", "created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("sync_queue");
  await knex.schema.dropTableIfExists("sync_sessions");
}
