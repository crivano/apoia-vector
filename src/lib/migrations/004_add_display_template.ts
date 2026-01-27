import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Add display_template column to data_sources table
  await knex.schema.table("data_sources", (table) => {
    table.text("display_template").comment("HTML template for displaying search results");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table("data_sources", (table) => {
    table.dropColumn("display_template");
  });
}
