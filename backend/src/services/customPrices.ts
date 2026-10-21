import type { Insertable } from "kysely";
import { db } from "../db/client.js";
import type { Database } from "../db/schema.js";
import { NotFoundError, ValidationError } from "../utils/error.js";

export interface CustomPriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CustomPriceInput {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface CustomPriceMutationResult {
  message: string;
  price: CustomPriceBar;
}

export interface CustomPriceBatchDetails {
  successful: unknown[];
  failed: Array<{ data?: unknown; error: string }>;
  total_successful: number;
  total_failed: number;
}

export interface CustomPriceBatchResult {
  message: string;
  details: CustomPriceBatchDetails;
}

type CustomPriceRow = {
  date: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: number;
};

function normalizeSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    throw new ValidationError("Symbol is required");
  }
  return normalized;
}

function normalizeDate(date: string): string {
  const trimmed = date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new ValidationError("date must be YYYY-MM-DD");
  }
  return trimmed;
}

function toNumber(value: string | number, field: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new ValidationError(`${field} must be a finite number`);
  }
  return n;
}

function parseInput(raw: CustomPriceInput): {
  date: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: number;
} {
  const date = normalizeDate(raw.date);
  const close = toNumber(raw.close, "close");
  const open = raw.open === undefined ? close : toNumber(raw.open, "open");
  const high = raw.high === undefined ? close : toNumber(raw.high, "high");
  const low = raw.low === undefined ? close : toNumber(raw.low, "low");
  const volume = raw.volume === undefined ? 0 : Math.trunc(toNumber(raw.volume, "volume"));
  if (volume < 0) {
    throw new ValidationError("volume must be >= 0");
  }
  return {
    date,
    open: String(open),
    high: String(high),
    low: String(low),
    close: String(close),
    volume,
  };
}

function rowToBar(row: CustomPriceRow): CustomPriceBar {
  return {
    date: row.date,
    open: toNumber(row.open, "open"),
    high: toNumber(row.high, "high"),
    low: toNumber(row.low, "low"),
    close: toNumber(row.close, "close"),
    volume: row.volume,
  };
}

export async function listCustomPrices(userId: number, symbol: string): Promise<CustomPriceBar[]> {
  const sym = normalizeSymbol(symbol);
  const rows = await db()
    .selectFrom("custom_prices")
    .select(["date", "open", "high", "low", "close", "volume"])
    .where("user_id", "=", userId)
    .where("symbol", "=", sym)
    .orderBy("date", "desc")
    .execute();
  return rows.map(rowToBar);
}

async function findExisting(
  userId: number,
  symbol: string,
  date: string,
): Promise<{ id: number } | undefined> {
  return db()
    .selectFrom("custom_prices")
    .select("id")
    .where("user_id", "=", userId)
    .where("symbol", "=", symbol)
    .where("date", "=", date)
    .executeTakeFirst();
}

export async function upsertCustomPrice(
  userId: number,
  symbol: string,
  input: CustomPriceInput,
): Promise<CustomPriceMutationResult> {
  const sym = normalizeSymbol(symbol);
  const parsed = parseInput(input);
  const now = new Date().toISOString();
  const existing = await findExisting(userId, sym, parsed.date);

  let row: CustomPriceRow | undefined;
  if (existing) {
    row = await db()
      .updateTable("custom_prices")
      .set({
        open: parsed.open,
        high: parsed.high,
        low: parsed.low,
        close: parsed.close,
        volume: parsed.volume,
        updated_at: now,
      })
      .where("id", "=", existing.id)
      .where("user_id", "=", userId)
      .returning(["date", "open", "high", "low", "close", "volume"])
      .executeTakeFirst();
  } else {
    const values: Insertable<Database["custom_prices"]> = {
      user_id: userId,
      symbol: sym,
      date: parsed.date,
      open: parsed.open,
      high: parsed.high,
      low: parsed.low,
      close: parsed.close,
      volume: parsed.volume,
      created_at: now,
      updated_at: now,
    };
    row = await db()
      .insertInto("custom_prices")
      .values(values)
      .returning(["date", "open", "high", "low", "close", "volume"])
      .executeTakeFirst();
  }

  if (!row) {
    throw new ValidationError("Failed to save custom price");
  }

  return {
    message: existing ? "Custom price updated" : "Custom price created",
    price: rowToBar(row),
  };
}

export async function batchUpsertCustomPrices(
  userId: number,
  symbol: string,
  prices: CustomPriceInput[],
): Promise<CustomPriceBatchResult> {
  const successful: CustomPriceBar[] = [];
  const failed: Array<{ data?: unknown; error: string }> = [];

  for (const item of prices) {
    try {
      const result = await upsertCustomPrice(userId, symbol, item);
      successful.push(result.price);
    } catch (e) {
      failed.push({
        data: item,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    message: `Processed ${prices.length} custom price(s)`,
    details: {
      successful,
      failed,
      total_successful: successful.length,
      total_failed: failed.length,
    },
  };
}

export async function deleteCustomPrice(
  userId: number,
  symbol: string,
  date: string,
): Promise<{ message: string }> {
  const sym = normalizeSymbol(symbol);
  const normalizedDate = normalizeDate(date);
  const result = await db()
    .deleteFrom("custom_prices")
    .where("user_id", "=", userId)
    .where("symbol", "=", sym)
    .where("date", "=", normalizedDate)
    .executeTakeFirst();

  const deleted =
    typeof result.numDeletedRows === "bigint"
      ? Number(result.numDeletedRows)
      : Number(result.numDeletedRows ?? 0);

  if (deleted < 1) {
    throw new NotFoundError("Custom price not found");
  }

  return { message: "Custom price deleted" };
}

export async function batchDeleteCustomPrices(
  userId: number,
  symbol: string,
  dates: string[],
): Promise<CustomPriceBatchResult> {
  const successful: string[] = [];
  const failed: Array<{ data?: unknown; error: string }> = [];

  for (const date of dates) {
    try {
      await deleteCustomPrice(userId, symbol, date);
      successful.push(normalizeDate(date));
    } catch (e) {
      failed.push({
        data: { date },
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    message: `Deleted ${successful.length} custom price(s)`,
    details: {
      successful,
      failed,
      total_successful: successful.length,
      total_failed: failed.length,
    },
  };
}
