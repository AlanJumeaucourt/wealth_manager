import { Value } from "@sinclair/typebox/value";
import type { ListResponse } from "../../types/index.js";
import type { ListToolName } from "./generated/listTools.types.js";
import { LIST_TOOL_REGISTRY } from "./generated/listTools.registry.js";
import { LIST_TOOL_SCHEMA_BY_EXPORT } from "./listToolSchemas.js";
import type { ListHandlerContext } from "../../utils/crudHandlers.js";

export type ListToolContext = {
  userId: number;
  request: Request;
  set: { status?: number | string };
};

export function isListToolName(name: string): name is ListToolName {
  return name in LIST_TOOL_REGISTRY;
}

export async function executeListTool(
  toolName: ListToolName,
  rawParams: unknown,
  ctx: ListToolContext,
): Promise<ListResponse<unknown> | { error: string } | Record<string, unknown>> {
  const entry = LIST_TOOL_REGISTRY[toolName];
  const schema = LIST_TOOL_SCHEMA_BY_EXPORT[entry.querySchemaExport];
  if (!schema) {
    return { error: `Unknown query schema ${entry.querySchemaExport}` };
  }

  const params = typeof rawParams === "string" ? (JSON.parse(rawParams) as unknown) : rawParams;

  if (!Value.Check(schema, params)) {
    const errors = [...Value.Errors(schema, params)];
    return {
      error: `Invalid parameters: ${errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
    };
  }

  const query = Value.Decode(schema, params) as Record<string, unknown>;
  const handlerCtx: ListHandlerContext = {
    query,
    request: ctx.request,
    userId: ctx.userId,
    set: ctx.set,
  };

  const result = await entry.handler(handlerCtx);
  if (result && typeof result === "object" && "error" in result) {
    return result as { error: string };
  }
  return result as ListResponse<unknown>;
}

export function summarizeListToolResult(toolName: ListToolName, result: unknown): string {
  if (result && typeof result === "object" && "error" in result) {
    return `Error: ${String((result as { error: string }).error)}`;
  }
  if (Array.isArray(result)) {
    return `${toolName}: ${result.length} rows`;
  }
  if (result && typeof result === "object" && "items" in result) {
    const r = result as { items: unknown[]; total?: number };
    const total = r.total ?? r.items.length;
    return `${toolName}: ${r.items.length} items (total ${total})`;
  }
  return `${toolName}: result received`;
}
