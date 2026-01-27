import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mark Knex and pg as external packages for server-side
  serverExternalPackages: [
    "knex",
    "pg",
    "better-sqlite3",
    "mysql",
    "mysql2",
    "oracledb",
    "pg-native",
    "sqlite3",
    "tedious",
  ],
  // Empty turbopack config to use Turbopack (Next.js 16 default)
  turbopack: {},
};

export default nextConfig;
