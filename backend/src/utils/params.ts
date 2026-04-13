import { requireAuth } from "../middleware/auth.js";

/**
 * Parse numeric id from route params. Returns null if invalid.
 */
export function parseIdParam(value: string): number | null {
  const id = parseInt(value, 10);
  if (Number.isNaN(id) || id <= 0) return null;
  return id;
}

export type ParseIdParamOr400Result = number | { error: string };

/**
 * Parse numeric id from route params. On invalid value, sets status=400 and returns error object.
 * Use in handlers: const id = parseIdParamOr400(params.id, set); if (typeof id === "object") return id;
 */
export function parseIdParamOr400(
  value: string,
  set: { status?: number | string },
  paramName = "id",
): ParseIdParamOr400Result {
  const id = parseIdParam(value);
  if (id == null) {
    set.status = 400;
    return { error: `Invalid ${paramName}` };
  }
  return id;
}

/** Accepts Elysia's set (status can be number or HTTP status string). */
export type WithIdParamContext = {
  params: { id: string };
  userId: number | null;
  set: { status?: number | string; [k: string]: unknown };
};

/**
 * Run a handler that needs a valid numeric id param. Handles requireAuth + parseIdParamOr400.
 * Returns the handler result, or the error object if id is invalid.
 */
export async function withIdParam<T>(
  ctx: WithIdParamContext,
  fn: (id: number) => Promise<T>,
): Promise<T | { error: string }> {
  requireAuth({ userId: ctx.userId });
  const id = parseIdParamOr400(ctx.params.id, ctx.set);
  if (typeof id === "object") return id;
  return fn(id);
}
