/**
 * Build list query description including allowed filter params (for OpenAPI detail.description).
 */
export function listQueryDescription(allowedFilters: string[], searchFields: string[]): string {
  const parts: string[] = [
    "Pagination: page, per_page. Sort: sort_by, sort_order. Optional: search, search_fields, fields.",
  ];
  if (allowedFilters.length) parts.push(`Filters (query params): ${allowedFilters.join(", ")}.`);
  if (searchFields.length) parts.push(`Search fields: ${searchFields.join(", ")}.`);
  return parts.join(" ");
}
