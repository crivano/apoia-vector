import knex, { Knex } from "knex";

const config: Knex.Config = {
  client: "pg",
  connection: process.env.DATABASE_URL,
  pool: {
    min: 0,
    max: 10,
  },
  migrations: {
    tableName: "knex_migrations",
    directory: "./src/lib/migrations",
  },
};

// Singleton pattern for database connection
let db: Knex | null = null;

export function getDb(): Knex {
  if (!db) {
    db = knex(config);
  }
  return db;
}

export default getDb;
