import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table("data_sources", (table) => {
    table.text("title_template");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table("data_sources", (table) => {
    table.dropColumn("title_template");
  });
}
