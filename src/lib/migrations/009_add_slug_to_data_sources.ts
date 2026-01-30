import type { Knex } from "knex";

// Helper function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD") // Normalize unicode
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-"); // Remove consecutive hyphens
}

export async function up(knex: Knex): Promise<void> {
  // Add slug column to data_sources table
  await knex.schema.table("data_sources", (table) => {
    table.string("slug");
  });

  // Generate slugs for existing records
  const sources = await knex("data_sources").select("id", "name");
  const slugCounts: Record<string, number> = {};

  for (const source of sources) {
    let slug = generateSlug(source.name);
    
    // Handle duplicates by adding numeric suffix
    if (slugCounts[slug]) {
      slugCounts[slug]++;
      slug = `${slug}-${slugCounts[slug]}`;
    } else {
      slugCounts[slug] = 1;
    }

    await knex("data_sources").where("id", source.id).update({ slug });
  }

  // Make slug not nullable and unique
  await knex.schema.alterTable("data_sources", (table) => {
    table.string("slug").notNullable().unique().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table("data_sources", (table) => {
    table.dropColumn("slug");
  });
}
