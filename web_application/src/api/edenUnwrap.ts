import { handleTokenExpiration } from "@/utils/auth";

export type TreatyResult<T> = {
  data: T | null;
  error: unknown;
  status: number;
};

function errorPayload(err: unknown): Record<string, unknown> | null {
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if ("value" in o && o.value && typeof o.value === "object") {
      return o.value as Record<string, unknown>;
    }
    return o;
  }
  return null;
}

/** Unwrap Eden Treaty `{ data, error }` into data or throw (mirrors legacy fetchWithAuth errors). */
export async function unwrapEden<T>(promise: Promise<unknown>): Promise<T> {
  const r = (await promise) as TreatyResult<T>;
  if (r.error) {
    const payload = errorPayload(r.error);
    if (payload && handleTokenExpiration(payload)) {
      throw new Error("Token expired");
    }
    const msg =
      (payload?.message as string | undefined) ||
      (payload?.error as string | undefined) ||
      (typeof r.error === "string" ? r.error : "Request failed");
    throw new Error(msg);
  }
  if (r.data === null) {
    if (r.status === 204 || r.status === 404) {
      return {} as T;
    }
    throw new Error("Empty response");
  }
  return r.data;
}
