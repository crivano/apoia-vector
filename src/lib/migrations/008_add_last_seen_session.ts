import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Add last_seen_session_id column to track which items were seen in each sync
  await knex.schema.table("vector_items", (table) => {
    table.uuid("last_seen_session_id").nullable().references("id").inTable("sync_sessions").onDelete("SET NULL");
    table.index("last_seen_session_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table("vector_items", (table) => {
    table.dropColumn("last_seen_session_id");
  });
}
