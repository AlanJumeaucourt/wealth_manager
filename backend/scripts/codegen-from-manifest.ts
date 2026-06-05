#!/usr/bin/env bun
/**
 * Single source of truth codegen.
 * Reads src/db/manifest.ts and emits:
 *   - src/db/schema.generated.ts (Kysely table interfaces)
 *   - src/schemas/typebox.generated.ts (Elysia t create/update + list/query schemas from listDefaults)
 *   - docs/schema-reference.sql (optional SQL reference with NOT NULL)
 *
 * Run: bun run scripts/codegen-from-manifest.ts
 */

import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  AGENT_LIST_ENDPOINTS,
  CUSTOM_LIST_QUERY_SCHEMAS,
  TABLE_MANIFEST,
  type ColumnDef,
  type CustomListQuerySchemaDef,
  type CustomQueryPropDef,
  type TableDef,
} from "../src/db/manifest.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function tsType(col: ColumnDef): string {
  if (col.sqlType === "INTEGER") return "number";
  if (col.sqlType === "REAL" || col.sqlType === "NUMERIC") return "number";
  return "string";
}

function tsNullable(col: ColumnDef): boolean {
  return col.nullable === true || (!col.required && !col.kind);
}

function kyselyType(col: ColumnDef): string {
  if (col.kind === "generated" && col.name === "id") return "Generated<number>";
  const base = col.enumValues?.length
    ? col.enumValues.map((v) => `"${v}"`).join(" | ")
    : tsType(col);
  return col.nullable ? `${base} | null` : base;
}

function emitKyselyInterface(table: TableDef): string {
  const lines: string[] = [];
  const ifaceName =
    table.tableName
      .split("_")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("") + "Table";
  lines.push(`export interface ${ifaceName} {`);
  for (const col of table.columns) {
    const optional = tsNullable(col) ? "?" : "";
    lines.push(`  ${col.name}${optional}: ${kyselyType(col)};`);
  }
  lines.push("}");
  return lines.join("\n");
}

function singularizeTableName(tableName: string): string {
  const parts = tableName.split("_").map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  const last = parts[parts.length - 1];
  if (last === "ies") return parts.slice(0, -1).join("") + "y";
  if (last?.endsWith("s") && last !== "ss") return parts.join("").slice(0, -1);
  return parts.join("");
}

function typeboxBaseName(table: TableDef): string {
  return table.typeboxName ?? singularizeTableName(table.tableName);
}

function emitTypeBoxCreate(table: TableDef): string {
  const createCols = table.columns.filter((c) => c.kind !== "generated" && c.kind !== "server");
  const parts: string[] = [];
  for (const col of createCols) {
    const optional = Boolean(col.optionalInCreate || !col.required || col.nullable);
    const tExpr = typeboxExpr(col, optional);
    parts.push(`  ${col.name}: ${tExpr},`);
  }
  const base = typeboxBaseName(table);
  return `export const tCreate${base}Schema = t.Object({\n${parts.join("\n")}\n});`;
}

function typeboxExpr(col: ColumnDef, wrapOptional: boolean): string {
  let inner: string;
  if (col.enumValues?.length) {
    inner = `t.Union([${col.enumValues.map((v) => `t.Literal("${v}")`).join(", ")}])`;
  } else if (col.format === "email") {
    inner = `t.String({ format: "email" })`;
  } else if (col.apiUnionStringNumber) {
    inner = "t.Union([t.String(), t.Number()])";
  } else if (
    col.sqlType === "INTEGER" ||
    col.sqlType === "REAL" ||
    col.sqlType === "NUMERIC" ||
    col.apiNumber
  ) {
    const opts: string[] = [];
    if (col.min != null) opts.push(`minimum: ${col.min}`);
    if (col.max != null) opts.push(`maximum: ${col.max}`);
    inner = opts.length ? `t.Number({ ${opts.join(", ")} })` : "t.Number()";
  } else {
    const opts: string[] = [];
    if (col.minLength != null) opts.push(`minLength: ${col.minLength}`);
    inner = opts.length ? `t.String({ ${opts.join(", ")} })` : "t.String()";
  }
  if (col.nullable && !col.required) {
    if (col.typeboxExplicitJsonNull) {
      inner = `t.Optional(t.Union([t.Null(), ${inner}]))`;
    } else {
      inner = `t.Optional(t.Nullable(${inner}))`;
    }
  } else if (wrapOptional) {
    inner = `t.Optional(${inner})`;
  }
  return inner;
}

function emitTypeBoxUpdate(table: TableDef): string {
  const createCols = table.columns.filter((c) => c.kind !== "generated" && c.kind !== "server");
  const parts: string[] = [];
  for (const col of createCols) {
    const tExpr = typeboxExpr(col, true);
    parts.push(`  ${col.name}: ${tExpr},`);
  }
  const base = typeboxBaseName(table);
  return `export const tUpdate${base}Schema = t.Object({\n${parts.join("\n")}\n});`;
}

function tableListQueryExportName(tableName: string): string {
  const pascal = tableName
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  return `t${pascal}ListQuerySchema`;
}

function emitCustomQueryProp(prop: CustomQueryPropDef): string {
  if (prop.kind === "string") {
    const inner =
      prop.minLength != null ? `t.String({ minLength: ${prop.minLength} })` : `t.String()`;
    return prop.required ? inner : `t.Optional(${inner})`;
  }
  const opts: string[] = [];
  if (prop.min != null) opts.push(`minimum: ${prop.min}`);
  if (prop.max != null) opts.push(`maximum: ${prop.max}`);
  const inner = opts.length > 0 ? `t.Number({ ${opts.join(", ")} })` : "t.Number()";
  return prop.required ? inner : `t.Optional(${inner})`;
}

function emitTableListQuerySchema(table: TableDef): string | null {
  const ld = table.listDefaults;
  if (!ld) return null;
  const keys = [
    ...new Set([...(ld.defaultFilters ?? []), ...(ld.listQueryExtraKeys ?? [])]),
  ].sort();
  if (keys.length === 0) return null;
  const exportName = tableListQueryExportName(table.tableName);
  const filterLines = keys.map((k) => `    ${k}: F,`).join("\n");
  return [
    `export const ${exportName} = t.Object(`,
    `  {`,
    `    ...tListQueryBaseProps,`,
    filterLines,
    `  },`,
    `  { additionalProperties: false },`,
    `);`,
  ].join("\n");
}

function emitCustomListQuerySchema(def: CustomListQuerySchemaDef): string {
  const innerLines: string[] = [];
  innerLines.push("  {");
  if (def.includeListBase) {
    innerLines.push(`    ...tListQueryBaseProps,`);
  }
  for (const k of def.filterKeys ?? []) {
    innerLines.push(`    ${k}: F,`);
  }
  if (def.properties) {
    for (const [name, prop] of Object.entries(def.properties)) {
      innerLines.push(`    ${name}: ${emitCustomQueryProp(prop)},`);
    }
  }
  innerLines.push("  }");
  return `export const ${def.exportName} = t.Object(
${innerLines.join("\n")},
  { additionalProperties: false },
);`;
}

function emitListQueryPreamble(): string[] {
  return [
    ``,
    `/** --- List query (from manifest listDefaults + CUSTOM_LIST_QUERY_SCHEMAS) --- */`,
    `export const tListQueryBaseProps = {`,
    `  page: t.Optional(t.Number({ minimum: 1 })),`,
    `  per_page: t.Optional(t.Number({ minimum: 1, maximum: LIST_QUERY_PER_PAGE_MAX })),`,
    `  sort_by: t.Optional(t.String()),`,
    `  sort_order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),`,
    `  search: t.Optional(t.String()),`,
    `  search_fields: t.Optional(t.String()),`,
    `  fields: t.Optional(t.String()),`,
    `} as const;`,
    ``,
    `export const tListFilterValueSchema = t.Union([`,
    `  t.String(),`,
    `  t.Number(),`,
    `  t.Array(t.String()),`,
    `  t.Array(t.Number()),`,
    `]);`,
    ``,
    `const F = t.Optional(tListFilterValueSchema);`,
    ``,
    `export const tBaseListQuerySchema = t.Object(`,
    `  { ...tListQueryBaseProps },`,
    `  { additionalProperties: false },`,
    `);`,
    ``,
    `export const tListQuerySchema = tBaseListQuerySchema;`,
    ``,
  ];
}

function emitSqlReference(table: TableDef): string {
  const lines: string[] = [];
  lines.push(`-- ${table.tableName}`);
  lines.push(
    `-- Columns: ${table.columns.map((c) => `${c.name} ${c.sqlType}${c.required && !c.kind ? " NOT NULL" : ""}`).join(", ")}`,
  );
  lines.push("");
  return lines.join("\n");
}

function sqliteTypeLiteral(sqlType: ColumnDef["sqlType"]): string {
  switch (sqlType) {
    case "INTEGER":
      return "integer";
    case "TEXT":
      return "text";
    case "REAL":
      return "real";
    case "NUMERIC":
      return "numeric";
    case "BLOB":
      return "blob";
    default:
      return "text";
  }
}

function emitMigrationColumns(table: TableDef): string[] {
  const lines: string[] = [];
  const pk = table.primaryKey;
  for (const col of table.columns) {
    const sqliteType = sqliteTypeLiteral(col.sqlType);
    const parts: string[] = ["col"];

    const isSingleColumnPk = pk && pk.columns.length === 1 && pk.columns[0] === col.name;
    if (isSingleColumnPk) {
      if (col.autoIncrement && col.sqlType === "INTEGER") {
        parts.push("primaryKey()", "autoIncrement()");
      } else {
        parts.push("primaryKey()");
      }
    }

    if (col.required && !col.nullable && !col.kind) {
      parts.push("notNull()");
    }

    const body = parts.join(".");
    lines.push(`    .addColumn("${col.name}", "${sqliteType}", (col) => ${body})`);
  }
  return lines;
}

function emitMigrationConstraints(table: TableDef): string[] {
  const lines: string[] = [];
  const pk = table.primaryKey;
  if (pk && pk.columns.length > 1) {
    const cols = pk.columns.map((c) => `"${c}"`).join(", ");
    const namePart = pk.name ? `"${pk.name}", ` : "";
    lines.push(`    .addPrimaryKeyConstraint(${namePart}[${cols}])`);
  }

  if (table.foreignKeys) {
    for (const fk of table.foreignKeys) {
      const cols = fk.columns.map((c) => `"${c}"`).join(", ");
      const refCols = fk.refColumns.map((c) => `"${c}"`).join(", ");
      const name = fk.name ?? `fk_${table.tableName}_${fk.refTable}`;
      if (fk.onDelete) {
        lines.push(
          `    .addForeignKeyConstraint(` +
            `"${name}", [` +
            `${cols}], "${fk.refTable}", [` +
            `${refCols}], (fb) => fb.onDelete("${fk.onDelete}"))`,
        );
      } else {
        lines.push(
          `    .addForeignKeyConstraint(` +
            `"${name}", [` +
            `${cols}], "${fk.refTable}", [` +
            `${refCols}], (fb) => fb)`,
        );
      }
    }
  }

  return lines;
}

function emitMigrationForTable(table: TableDef): string[] {
  const lines: string[] = [];
  if (table.apiOnly) return lines;
  lines.push(`  await kdb.schema`);
  lines.push(`    .createTable("${table.tableName}")`);
  lines.push(`    .ifNotExists()`);
  lines.push(...emitMigrationColumns(table));
  lines.push(...emitMigrationConstraints(table));
  lines.push(`    .execute();`);
  lines.push("");
  return lines;
}

/** Create order: referenced tables before referencing tables (SQLite FK enforcement). Self-FKs skipped. */
function sortTablesByForeignKeyDependencies(tables: TableDef[]): TableDef[] {
  const nameSet = new Set(tables.map((t) => t.tableName));
  const tableByName = new Map(tables.map((t) => [t.tableName, t] as const));

  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const t of tables) {
    inDegree.set(t.tableName, 0);
  }

  for (const t of tables) {
    const deps = new Set<string>();
    if (t.foreignKeys) {
      for (const fk of t.foreignKeys) {
        if (fk.refTable === t.tableName) continue;
        if (nameSet.has(fk.refTable)) deps.add(fk.refTable);
      }
    }
    inDegree.set(t.tableName, deps.size);
    for (const r of deps) {
      const list = adj.get(r);
      if (list) list.push(t.tableName);
      else adj.set(r, [t.tableName]);
    }
  }

  const queue = [...inDegree.entries()]
    .filter(([, d]) => d === 0)
    .map(([n]) => n)
    .sort();
  const order: string[] = [];

  while (queue.length) {
    const n = queue.shift()!;
    order.push(n);
    for (const m of adj.get(n) ?? []) {
      const next = (inDegree.get(m) ?? 0) - 1;
      inDegree.set(m, next);
      if (next === 0) {
        queue.push(m);
        queue.sort();
      }
    }
  }

  if (order.length !== tables.length) {
    throw new Error(
      "FK cycle in TABLE_MANIFEST: cannot order tables for migrations. Check foreignKeys.",
    );
  }

  return order.map((name) => tableByName.get(name)!);
}

const tablesForKysely = sortTablesByForeignKeyDependencies(
  TABLE_MANIFEST.filter((t) => !t.apiOnly),
);

// --- Generate schema.generated.ts (only tables that are not apiOnly)
const schemaLines: string[] = [
  `/** Generated from src/db/manifest.ts - do not edit by hand. */`,
  `import type { Generated } from "kysely";`,
  ``,
  ...tablesForKysely.map(emitKyselyInterface),
];
const schemaPath = join(ROOT, "src/db/schema.generated.ts");
writeFileSync(schemaPath, schemaLines.join("\n\n") + "\n", "utf-8");
console.log("Wrote", schemaPath);

// --- Generate typebox.generated.ts (all tables, including apiOnly + list/query schemas)
const typeboxHeader = [
  `/** Generated from src/db/manifest.ts - do not edit by hand. */`,
  `import { t } from "elysia";`,
  `import { LIST_QUERY_PER_PAGE_MAX } from "./common.js";`,
  ``,
];
const typeboxLines: string[] = [...typeboxHeader];
for (const table of TABLE_MANIFEST) {
  typeboxLines.push(emitTypeBoxCreate(table));
  typeboxLines.push("");
  typeboxLines.push(emitTypeBoxUpdate(table));
  typeboxLines.push("");
}
typeboxLines.push(...emitListQueryPreamble());
for (const table of TABLE_MANIFEST) {
  const listBlock = emitTableListQuerySchema(table);
  if (listBlock) {
    typeboxLines.push(listBlock);
    typeboxLines.push("");
  }
}
for (const def of CUSTOM_LIST_QUERY_SCHEMAS) {
  typeboxLines.push(emitCustomListQuerySchema(def));
  typeboxLines.push("");
}
if (CUSTOM_LIST_QUERY_SCHEMAS.some((d) => d.exportName === "tDateRangeQuerySchema")) {
  typeboxLines.push("export const tBudgetsDateRangeQuerySchema = tDateRangeQuerySchema;");
  typeboxLines.push("");
}
const typeboxPath = join(ROOT, "src/schemas/typebox.generated.ts");
writeFileSync(typeboxPath, typeboxLines.join("\n") + "\n", "utf-8");
console.log("Wrote", typeboxPath);

// --- Optional: SQL reference (only real tables)
try {
  mkdirSync(join(ROOT, "docs"), { recursive: true });
} catch {}
const sqlLines = [
  "-- Schema reference (NOT NULL from manifest). Generated from src/db/manifest.ts",
  "-- Use for documentation or to compare with migrations.",
  "",
  ...tablesForKysely.map(emitSqlReference),
];
const sqlPath = join(ROOT, "docs/schema-reference.sql");
writeFileSync(sqlPath, sqlLines.join("\n"), "utf-8");
console.log("Wrote", sqlPath);

// --- Generate migrations.generated.ts (Kysely schema builder from manifest)
const migrationsLines: string[] = [
  `/** Generated from src/db/manifest.ts - do not edit by hand. */`,
  `import type { Kysely } from "kysely";`,
  `import type { Database as DBSchema } from "./schema.js";`,
  ``,
  `export async function runBaseSchemaMigrations(kdb: Kysely<DBSchema>): Promise<void> {`,
];
for (const table of tablesForKysely) {
  migrationsLines.push(...emitMigrationForTable(table));
}
migrationsLines.push("}");
const migrationsPath = join(ROOT, "src/db/migrations.generated.ts");
writeFileSync(migrationsPath, migrationsLines.join("\n") + "\n", "utf-8");
console.log("Wrote", migrationsPath);

// --- Agent list tool names (from AGENT_LIST_ENDPOINTS)
const agentToolsDir = join(ROOT, "src/ai/tools/generated");
mkdirSync(agentToolsDir, { recursive: true });
const toolNames = AGENT_LIST_ENDPOINTS.map((e) => e.toolName);
const listTypesContent = [
  `/** Generated from AGENT_LIST_ENDPOINTS — do not edit by hand. */`,
  `export type ListToolName =`,
  toolNames.map((n) => `  | "${n}"`).join("\n"),
  `;`,
  ``,
  `export const LIST_TOOL_NAMES = [`,
  ...toolNames.map((n) => `  "${n}",`),
  `] as const satisfies readonly ListToolName[];`,
  ``,
].join("\n");
const listTypesPath = join(agentToolsDir, "listTools.types.ts");
writeFileSync(listTypesPath, listTypesContent, "utf-8");
console.log("Wrote", listTypesPath);

console.log(
  "Done. Generated Kysely schema, TypeBox schemas, SQL reference, migrations, and agent list tool types.",
);
