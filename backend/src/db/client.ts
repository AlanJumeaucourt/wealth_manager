import type { Kysely } from "kysely";
import { getDb } from "./connection.js";
import type { Database } from "./schema.js";

/**
 * Shared typed database accessor for services.
 *
 * Prefer this over calling `getDb()` directly so that:
 * - all queries are strongly typed against `Database`
 * - we avoid repeated `as any` casts throughout the codebase
 */
export const db = (): Kysely<Database> => getDb();
