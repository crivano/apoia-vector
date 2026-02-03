import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Add index on external_id for faster ID-based searches
  await knex.schema.table("vector_items", (table) => {
    table.index("external_id", "idx_vector_items_external_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table("vector_items", (table) => {
    table.dropIndex("external_id", "idx_vector_items_external_id");
  });
}
