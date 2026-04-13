import { Database } from "bun:sqlite";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import type { Database as DBSchema } from "./schema.js";

const dbPath = config.sqliteDbPath || ":memory:";

function validateDbPath(): void {
  if (dbPath === ":memory:") return;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    throw new Error(`Database directory does not exist: ${dir}`);
  }
  try {
    fs.accessSync(dir, fs.constants.W_OK);
  } catch {
    throw new Error(`No write permission in directory: ${dir}`);
  }
  if (fs.existsSync(dbPath)) {
    try {
      fs.accessSync(dbPath, fs.constants.W_OK);
    } catch {
      throw new Error(`No write permission for database file: ${dbPath}`);
    }
  }
}

let _db: Kysely<DBSchema> | null = null;

export function getDb(): Kysely<DBSchema> {
  if (_db) return _db;
  validateDbPath();
  const nativeDb = new Database(dbPath);
  nativeDb.exec("PRAGMA foreign_keys = ON;");
  _db = new Kysely<DBSchema>({
    dialect: new BunSqliteDialect({ database: nativeDb }),
  });
  return _db;
}

export async function closeDb(): Promise<void> {
  if (_db) {
    await _db.destroy();
    _db = null;
  }
}
