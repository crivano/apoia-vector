import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Create embedding_usage table to track daily embedding generation
  await knex.schema.createTable("embedding_usage", (table) => {
    table.date("usage_date").primary();
    table.integer("count").defaultTo(0).notNullable();
    table.timestamps(true, true);
    
    table.index("usage_date");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("embedding_usage");
}
