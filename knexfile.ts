import type { Knex } from "knex";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "pg",
    connection: process.env.DATABASE_URL,
    pool: {
      min: 0,
      max: 10,
    },
    migrations: {
      tableName: "knex_migrations",
      directory: "./src/lib/migrations",
      extension: "ts",
    },
  },

  production: {
    client: "pg",
    connection: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: "knex_migrations",
      directory: "./src/lib/migrations",
      extension: "ts",
    },
  },
};

export default config;
