/**
 * SQLite stores many monetary values as TEXT for precision; the driver returns them as strings.
 * TypeBox/API expect JSON numbers. Coerce known numeric columns when serializing responses.
 */
import { TABLE_MANIFEST } from "../db/manifest.js";
import type { Database } from "../db/schema.js";

export type TableName = keyof Database;

/** TEXT columns that hold decimals but are not yet flagged apiNumber in manifest. */
const EXTRA_TEXT_NUMERIC_COLUMNS = new Set([
  "principal_amount",
  "interest_rate",
  "payment_amount",
  "quantity",
  "unit_price",
  "fee",
  "tax",
  "total_paid",
  "extra_payment",
  "capitalized_interest",
  "remaining_principal",
  "gain_loss_override",
  "gain_loss_calculated",
  "open",
  "high",
  "low",
  "close",
]);

function buildTableJsonNumericKeys(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const t of TABLE_MANIFEST) {
    if (t.apiOnly) continue;
    for (const c of t.columns) {
      if (c.sqlType !== "TEXT") continue;
      if (c.apiNumber || c.apiUnionStringNumber || EXTRA_TEXT_NUMERIC_COLUMNS.has(c.name)) {
        if (!map.has(t.tableName)) map.set(t.tableName, new Set());
        map.get(t.tableName)!.add(c.name);
      }
    }
  }
  return map;
}

const TABLE_JSON_NUMERIC_KEYS = buildTableJsonNumericKeys();

/** Enrichment / computed fields not tied to a single manifest column. */
const RESPONSE_NUMERIC_KEYS = new Set([
  "refunded_amount",
  "refunded_amount_preferred",
  "amount_preferred",
  "net_amount_preferred",
  "balance",
  "balance_preferred",
  "market_value",
  "current_balance",
  "market_value",
  "investment_gain",
  "investment_gain_unrealized",
  "investment_gain_realized",
  "principal_paid",
  "interest_paid",
  "remaining_balance",
  "missed_payments_count",
]);

function collectKeysForTables(tables: TableName[]): Set<string> {
  const keys = new Set<string>(RESPONSE_NUMERIC_KEYS);
  for (const t of tables) {
    const k = TABLE_JSON_NUMERIC_KEYS.get(t);
    if (k) for (const x of k) keys.add(x);
  }
  return keys;
}

function coerceValue(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v === "string" || typeof v === "number") {
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  return v;
}

/**
 * Coerce string amounts to JSON numbers for API responses.
 * @param tableOrTables One table or several (e.g. joined `transactions` + `investment_details`).
 */
export function coerceNumericJsonFields(
  row: Record<string, unknown>,
  tableOrTables?: TableName | TableName[],
): Record<string, unknown> {
  const tables = tableOrTables
    ? Array.isArray(tableOrTables)
      ? tableOrTables
      : [tableOrTables]
    : [];
  const keySet = tables.length > 0 ? collectKeysForTables(tables) : new Set(RESPONSE_NUMERIC_KEYS);

  const out: Record<string, unknown> = { ...row };
  for (const key of Object.keys(out)) {
    if (!keySet.has(key)) continue;
    const v = out[key];
    if (v == null) continue;
    out[key] = coerceValue(v);
  }

  // Nested refund line items (amount is REAL in DB but may still arrive as string in edge cases)
  if (Array.isArray(out.refund_items)) {
    out.refund_items = out.refund_items.map((ri) => {
      if (ri && typeof ri === "object" && "amount" in (ri as object)) {
        const item = { ...(ri as Record<string, unknown>) };
        if (item.amount != null) item.amount = coerceValue(item.amount);
        return item;
      }
      return ri;
    });
  }

  return out;
}

export function coerceNumericJsonFieldsMany<T extends Record<string, unknown>>(
  rows: T[],
  tableOrTables?: TableName | TableName[],
): T[] {
  return rows.map((r) => coerceNumericJsonFields(r as Record<string, unknown>, tableOrTables) as T);
}
