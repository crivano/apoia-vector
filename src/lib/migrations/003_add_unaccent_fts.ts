import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Enable unaccent extension for accent-insensitive text search
  await knex.raw(`
    CREATE EXTENSION IF NOT EXISTS unaccent;
  `);

  // Create a text search configuration that uses unaccent
  // This allows searching "coabitacao" to match "coabitação"
  await knex.raw(`
    DROP TEXT SEARCH CONFIGURATION IF EXISTS portuguese_unaccent CASCADE;
    CREATE TEXT SEARCH CONFIGURATION portuguese_unaccent (COPY = portuguese);
    ALTER TEXT SEARCH CONFIGURATION portuguese_unaccent
      ALTER MAPPING FOR hword, hword_part, word
      WITH unaccent, portuguese_stem;
  `);

  // Update trigger function to use unaccent configuration
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_fts_tokens()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.fts_tokens := to_tsvector('portuguese_unaccent', COALESCE(NEW.content, ''));
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Re-populate fts_tokens for all records using the new unaccent configuration
  await knex.raw(`
    UPDATE vector_items 
    SET fts_tokens = to_tsvector('portuguese_unaccent', COALESCE(content, ''));
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Revert to standard portuguese configuration
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_fts_tokens()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.fts_tokens := to_tsvector('portuguese', COALESCE(NEW.content, ''));
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Re-populate with standard portuguese
  await knex.raw(`
    UPDATE vector_items 
    SET fts_tokens = to_tsvector('portuguese', COALESCE(content, ''));
  `);

  // Drop the custom configuration
  await knex.raw(`
    DROP TEXT SEARCH CONFIGURATION IF EXISTS portuguese_unaccent CASCADE;
  `);
}
