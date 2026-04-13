/**
 * Extract items array from batch request body.
 */
export function extractBatchItems<T = unknown>(body: unknown): T[] {
  const b = body as { items?: T[] } | undefined;
  return Array.isArray(b?.items) ? b.items : [];
}

/**
 * Extract ids array from batch delete request body.
 */
export function extractBatchIds(body: unknown): number[] {
  const b = body as { ids?: unknown[] } | undefined;
  if (!Array.isArray(b?.ids)) return [];
  return b.ids.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x > 0);
}
