import { tListQueryBaseProps } from "../../schemas/typebox.generated.js";

/** Build OpenAI-compatible JSON Schema for a list tool from filter keys. */
export function buildListToolParametersSchema(
  allowedFilters: readonly string[],
  extraProperties?: Record<string, unknown>,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    page: { type: "number", description: "Page number (default 1)" },
    per_page: { type: "number", description: "Items per page (default 20)" },
    sort_by: { type: "string", description: "Field to sort by" },
    sort_order: { type: "string", enum: ["asc", "desc"] },
    search: { type: "string", description: "Full-text search" },
    search_fields: { type: "string", description: "Comma-separated fields to search" },
    fields: { type: "string", description: "Comma-separated fields to return" },
  };

  for (const key of allowedFilters) {
    properties[key] = {
      description: `Filter by ${key} (string or number; comma-separated for multiple values)`,
    };
  }

  if (extraProperties) {
    Object.assign(properties, extraProperties);
  }

  return {
    type: "object",
    properties,
    additionalProperties: false,
  };
}

export const LIST_QUERY_BASE_PROP_NAMES = Object.keys(tListQueryBaseProps);
