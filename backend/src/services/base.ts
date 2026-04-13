import type { Selectable } from "kysely";
import { db } from "../db/client.js";
import { LISTABLE_FIELDS, USER_UPDATABLE_FIELDS } from "../db/manifest.js";
import type { Database } from "../db/schema.js";
import type { BatchResult, ListParams, ListResponse } from "../types/index.js";
import { errorMessage, ValidationError } from "../utils/error.js";
import { coerceNumericJsonFields, coerceNumericJsonFieldsMany } from "../utils/jsonNumeric.js";

type TableName = keyof Database;

const RESERVED_UPDATE_FIELDS = new Set(["id", "user_id", "created_at", "updated_at"]);

function sanitizeUpdateData<T extends Record<string, unknown>>(
  table: TableName,
  data: Partial<T>,
): Partial<T> {
  const allowedFields = USER_UPDATABLE_FIELDS[table];
  if (!allowedFields) {
    throw new ValidationError(`Updates are not supported for table ${String(table)}`);
  }
  const allowed = new Set(allowedFields);
  const sanitizedEntries = Object.entries(data).filter(
    ([key, value]) => allowed.has(key) && !RESERVED_UPDATE_FIELDS.has(key) && value !== undefined,
  );
  return Object.fromEntries(sanitizedEntries) as Partial<T>;
}

function getListableFieldSet(table: TableName): Set<string> {
  const allowed = LISTABLE_FIELDS[table];
  if (!allowed) {
    throw new ValidationError(`List is not supported for table ${String(table)}`);
  }
  return new Set(allowed);
}

function assertAllowedIdentifiers(
  table: TableName,
  identifiers: Array<{ kind: string; values: readonly string[] }>,
) {
  const allowed = getListableFieldSet(table);
  const invalid = new Map<string, string[]>();
  for (const { kind, values } of identifiers) {
    for (const v of values) {
      if (!v) continue;
      if (!allowed.has(v)) {
        const list = invalid.get(kind) ?? [];
        list.push(v);
        invalid.set(kind, list);
      }
    }
  }
  if (invalid.size > 0) {
    const parts = [...invalid.entries()].map(([kind, vals]) => `${kind}: ${vals.join(", ")}`);
    throw new ValidationError(`Unknown identifiers for ${String(table)} (${parts.join("; ")})`);
  }
}

export async function listAll<T extends Record<string, unknown>, TTable extends TableName>(
  table: TTable,
  userId: number,
  params: ListParams,
): Promise<ListResponse<T>> {
  const page = params.page ?? 1;
  const perPage = params.per_page ?? 20;
  const sortBy = params.sort_by;
  const sortOrder = params.sort_order ?? "asc";
  const search = params.search;
  const searchFields = params.search_fields ?? [];
  const fields = params.fields;
  const filters = params.filters ?? {};

  const filterKeys = Object.keys(filters);
  assertAllowedIdentifiers(table, [
    ...(sortBy ? [{ kind: "sort_by", values: [sortBy] as const }] : []),
    { kind: "fields", values: fields ?? [] },
    { kind: "search_fields", values: searchFields },
    { kind: "filters", values: filterKeys },
  ]);

  const database = db();
  const dyn = database.dynamic;
  let countQ = database
    .selectFrom(table)
    .select((eb) => eb.fn.countAll().as("total"))
    .where(dyn.ref("user_id"), "=", userId);
  let dataBaseQ = database.selectFrom(table).where(dyn.ref("user_id"), "=", userId);

  // filters: exact match or IN for comma-separated
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;
    const v = value as string | number;
    if (typeof v === "string" && v.includes(",")) {
      const vals = v.split(",").map((x) => x.trim());
      const ref = dyn.ref(key);
      countQ = countQ.where(ref, "in", vals as unknown as readonly unknown[]);
      dataBaseQ = dataBaseQ.where(ref, "in", vals as unknown as readonly unknown[]);
    } else {
      const ref = dyn.ref(key);
      countQ = countQ.where(ref, "=", v as unknown);
      dataBaseQ = dataBaseQ.where(ref, "=", v as unknown);
    }
  }

  // search: LIKE %search% on search_fields
  if (search && searchFields.length > 0) {
    const like = `%${search}%`;
    countQ = countQ.where((eb) =>
      eb.or(searchFields.map((f: string) => eb(dyn.ref(f), "like", like))),
    );
    dataBaseQ = dataBaseQ.where((eb) =>
      eb.or(searchFields.map((f: string) => eb(dyn.ref(f), "like", like))),
    );
  }

  let dataQ = dataBaseQ;
  if (fields && fields.length) {
    const selected = Array.from(new Set(fields.filter((f) => f && f !== "user_id")));
    if (selected.length > 0) {
      dataQ = dataQ.select(selected.map((f) => dyn.ref(f)));
    } else {
      dataQ = dataQ.selectAll();
    }
  } else {
    dataQ = dataQ.selectAll();
  }

  if (sortBy) {
    dataQ = dataQ.orderBy(dyn.ref(sortBy), sortOrder);
  }
  const dataQuery = dataQ.limit(perPage).offset((page - 1) * perPage);

  const [countRows, rows] = await Promise.all([
    countQ.execute() as Promise<Array<{ total: bigint | number }>>,
    dataQuery.execute(),
  ]);
  const totalCount = Number(countRows[0]?.total ?? 0);
  const items = coerceNumericJsonFieldsMany(rows as T[], table);

  return { items, total: totalCount, page, per_page: perPage };
}

export async function getById<T extends Record<string, unknown>>(
  table: TableName,
  id: number,
  userId: number,
): Promise<T | null> {
  const database = db();
  const row = await database
    .selectFrom(table)
    .selectAll()
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!row) return null;
  return coerceNumericJsonFields(row as Record<string, unknown>, table) as T;
}

export async function createOne<T extends Record<string, unknown>>(
  table: TableName,
  data: T,
): Promise<Selectable<Database[typeof table]> | undefined> {
  const database = db();
  const row = await database
    .insertInto(table)
    .values(data as unknown as Database[typeof table])
    .returningAll()
    .executeTakeFirst();
  if (!row) return row;
  return coerceNumericJsonFields(row as Record<string, unknown>, table) as Selectable<
    Database[typeof table]
  >;
}

export async function updateOne<T extends Record<string, unknown>>(
  table: TableName,
  id: number,
  userId: number,
  data: Partial<T>,
): Promise<Selectable<Database[typeof table]> | undefined> {
  const database = db();
  const sanitized = sanitizeUpdateData(table, data);
  if (Object.keys(sanitized).length === 0) {
    const r = await database
      .selectFrom(table)
      .selectAll()
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    if (!r) return r;
    return coerceNumericJsonFields(r as Record<string, unknown>, table) as Selectable<
      Database[typeof table]
    >;
  }
  const row = await database
    .updateTable(table)
    .set(sanitized)
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .returningAll()
    .executeTakeFirst();
  if (!row) return row;
  return coerceNumericJsonFields(row as Record<string, unknown>, table) as Selectable<
    Database[typeof table]
  >;
}

export async function deleteOne(table: TableName, id: number, userId: number): Promise<boolean> {
  const database = db();
  const r = await database
    .deleteFrom(table)
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return Number((r as { numDeletedRows: bigint }).numDeletedRows) > 0;
}

export async function batchCreate<T extends Record<string, unknown>>(
  table: TableName,
  items: T[],
): Promise<BatchResult<Selectable<Database[typeof table]>>> {
  if (items.length === 0) {
    return { successful: [], failed: [], total_successful: 0, total_failed: 0 };
  }
  const database = db();

  // Try multi-row insert first (Kysely: https://kysely.dev/docs/examples/insert/multiple-rows)
  try {
    const rows = await database
      .insertInto(table)
      .values(items as unknown as Database[typeof table][])
      .returningAll()
      .execute();
    const successfulRaw = Array.isArray(rows) ? rows : [rows];
    if (successfulRaw.length === items.length) {
      const successful = coerceNumericJsonFieldsMany(
        successfulRaw as Record<string, unknown>[],
        table,
      ) as Selectable<Database[typeof table]>[];
      return {
        successful,
        failed: [],
        total_successful: successful.length,
        total_failed: 0,
      };
    }
    // Dialect returned fewer rows (e.g. only last); fall back to per-item for full result
  } catch {
    // Constraint / unique / NOT NULL etc.; fall back to per-item for detailed errors
  }

  const successful: Selectable<Database[typeof table]>[] = [];
  const failed: Array<{ data: T; error: string }> = [];
  await database.transaction().execute(async (trx) => {
    for (const item of items) {
      try {
        const row = await trx
          .insertInto(table)
          .values(item as unknown as Database[typeof table])
          .returningAll()
          .executeTakeFirst();
        if (row)
          successful.push(
            coerceNumericJsonFields(row as Record<string, unknown>, table) as Selectable<
              Database[typeof table]
            >,
          );
        else failed.push({ data: item, error: "Insert returned no row" });
      } catch (e) {
        failed.push({ data: item, error: errorMessage(e) });
      }
    }
  });
  return {
    successful,
    failed,
    total_successful: successful.length,
    total_failed: failed.length,
  };
}

export async function batchUpdate<T extends Record<string, unknown> & { id: number }>(
  table: TableName,
  userId: number,
  items: T[],
): Promise<BatchResult<Selectable<Database[typeof table]>>> {
  const successful: Selectable<Database[typeof table]>[] = [];
  const failed: Array<{ id?: number; error: string; data?: T }> = [];
  for (const item of items) {
    const { id, ...rest } = item;
    try {
      const row = await updateOne(table, id, userId, rest as Partial<T>);
      if (row) successful.push(row);
      else failed.push({ id, error: "Not found or unauthorized", data: item });
    } catch (e) {
      failed.push({ id, error: errorMessage(e), data: item });
    }
  }
  return {
    successful,
    failed,
    total_successful: successful.length,
    total_failed: failed.length,
  };
}

export async function batchDelete(
  table: TableName,
  userId: number,
  ids: number[],
): Promise<BatchResult<number>> {
  const successful: number[] = [];
  const failed: Array<{ id: number; error: string }> = [];
  for (const id of ids) {
    try {
      const ok = await deleteOne(table, id, userId);
      if (ok) successful.push(id);
      else failed.push({ id, error: "Not found or unauthorized" });
    } catch (e) {
      failed.push({ id, error: errorMessage(e) });
    }
  }
  return {
    successful,
    failed,
    total_successful: successful.length,
    total_failed: failed.length,
  };
}
