"use strict";

// lib/db/migrate.ts
var import_libsql = require("drizzle-orm/libsql");
var import_migrator = require("drizzle-orm/libsql/migrator");
var import_client = require("@libsql/client");
async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL || "file:/app/config/db.sqlite";
  const client = (0, import_client.createClient)({
    url: databaseUrl
  });
  const db = (0, import_libsql.drizzle)(client);
  console.log("Running migrations...");
  await (0, import_migrator.migrate)(db, { migrationsFolder: "./lib/db/migrations" });
  console.log("Migrations completed successfully");
  process.exit(0);
}
runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
