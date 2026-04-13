import type { ListParams } from "../types/index.js";

export const LIST_QUERY_PER_PAGE_MAX = 999999;

export interface ListQuery {
  page: number;
  per_page: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  search?: string;
  search_fields?: string;
  fields?: string;
  [key: string]: unknown;
}

/**
 * Apply defaults to a partial list query (e.g. from TypeBox-validated ctx.query).
 */
export function normalizeListQuery(
  partial: Partial<ListQuery> & Record<string, unknown>,
): ListQuery {
  const rawPerPage = partial.per_page ?? 20;
  const per_page = Math.min(
    Math.max(1, typeof rawPerPage === "number" ? rawPerPage : 20),
    LIST_QUERY_PER_PAGE_MAX,
  );
  return {
    ...partial,
    page: partial.page ?? 1,
    per_page,
    sort_by: partial.sort_by,
    sort_order: partial.sort_order,
    search: partial.search,
    search_fields: partial.search_fields,
    fields: partial.fields,
  } as ListQuery;
}

export type ValidationErrorDetail = { path: string; message: string };

/**
 * Standard validation error response shape.
 */
export function validationErrorResponse(parsed: {
  error?: string;
  details?: unknown;
  fieldErrors?: unknown;
  formErrors?: unknown;
}): { error: string; details?: unknown; fieldErrors?: unknown; formErrors?: unknown } {
  return {
    error: parsed.error ?? "Validation failed",
    ...(parsed.details != null && { details: parsed.details }),
    ...(parsed.fieldErrors != null && { fieldErrors: parsed.fieldErrors }),
    ...(parsed.formErrors != null && { formErrors: parsed.formErrors }),
  };
}

export type BuildListParamsOptions = {
  defaultSearchFields: string[];
  filters?: Record<string, unknown>;
  fields?: string[];
};

export function buildListParams(q: ListQuery, options: BuildListParamsOptions): ListParams {
  const searchFields = q.search_fields?.trim()
    ? q.search_fields.split(",").map((s) => s.trim())
    : options.defaultSearchFields;
  const fields =
    options.fields !== undefined
      ? options.fields
      : q.fields?.trim()
        ? q.fields.split(",").map((s) => s.trim())
        : undefined;
  return {
    page: q.page,
    per_page: q.per_page,
    sort_by: q.sort_by,
    sort_order: q.sort_order as "asc" | "desc" | undefined,
    search: q.search,
    search_fields: searchFields,
    ...(fields !== undefined && { fields }),
    ...(options.filters !== undefined && { filters: options.filters }),
  };
}
