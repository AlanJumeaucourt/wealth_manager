import { Database } from "bun:sqlite";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { runBaseSchemaMigrations } from "./migrations.generated.js";
import type { Database as DBSchema } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "migrations");

export async function runMigrations(): Promise<void> {
  const dbPath = config.sqliteDbPath;
  if (!dbPath) {
    console.error("SQLITE_DB_PATH must be set to run migrations.");
    process.exit(1);
  }

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log("Running migrations against:", dbPath);
  const nativeDb = new Database(dbPath);
  nativeDb.exec("PRAGMA foreign_keys = ON;");

  const kdb = new Kysely<DBSchema>({
    dialect: new BunSqliteDialect({ database: nativeDb }),
  });

  try {
    // Base schema via generated Kysely migrations.
    await runBaseSchemaMigrations(kdb);

    // Legacy/extra tables, views, indexes, triggers via raw SQL files.
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sqlText = fs.readFileSync(filePath, "utf-8");
      console.log("Applying:", file);
      nativeDb.exec(sqlText);
    }

    console.log("Migrations complete.");
  } catch (e) {
    console.error("Migration failed:", e);
    throw e;
  } finally {
    await kdb.destroy();
    nativeDb.close();
  }
}

async function main(): Promise<void> {
  try {
    await runMigrations();
  } catch {
    process.exit(1);
  }
}

if (import.meta.main) {
  void main();
}
