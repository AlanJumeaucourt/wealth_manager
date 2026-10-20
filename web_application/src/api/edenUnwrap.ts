import { handleTokenExpiration } from "@/utils/auth";

export type TreatyResult<T> = {
  data: T | null;
  error: unknown;
  status: number;
};

export type ApiErrorBody = {
  error?: string;
  msg?: string;
  message?: string;
  code?: string;
  details?: unknown;
  [key: string]: unknown;
};

/** Structured API failure preserving HTTP status and backend `code` / `details`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly body: ApiErrorBody;

  constructor(
    message: string,
    options: { status: number; code?: string; details?: unknown; body?: ApiErrorBody },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.body = options.body ?? { error: message };
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getApiErrorMessage(error: unknown, fallback = "Request failed"): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function errorPayload(err: unknown): ApiErrorBody | null {
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if ("value" in o && o.value && typeof o.value === "object") {
      return o.value as ApiErrorBody;
    }
    return o as ApiErrorBody;
  }
  return null;
}

function messageFromPayload(payload: ApiErrorBody | null, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload.msg === "string" && payload.msg) return payload.msg;
  if (typeof payload.message === "string" && payload.message) return payload.message;
  if (typeof payload.error === "string" && payload.error) return payload.error;
  return fallback;
}

/** Unwrap Eden Treaty `{ data, error }` into data or throw `ApiError`. */
export async function unwrapEden<T>(promise: Promise<unknown>): Promise<T> {
  const r = (await promise) as TreatyResult<T>;
  if (r.error) {
    const payload = errorPayload(r.error);
    if (payload && handleTokenExpiration(payload, r.status)) {
      throw new ApiError("Token expired", {
        status: r.status || 401,
        code: "UNAUTHORIZED",
        body: payload,
      });
    }
    const msg = messageFromPayload(
      payload,
      typeof r.error === "string" ? r.error : "Request failed",
    );
    throw new ApiError(msg, {
      status: r.status || 500,
      code: typeof payload?.code === "string" ? payload.code : undefined,
      details: payload?.details,
      body: payload ?? { error: msg },
    });
  }
  if (r.data === null) {
    if (r.status === 204) {
      return undefined as T;
    }
    if (r.status === 404) {
      throw new ApiError("Not found", {
        status: 404,
        code: "NOT_FOUND",
        body: { error: "Not found", code: "NOT_FOUND" },
      });
    }
    throw new ApiError("Empty response", {
      status: r.status || 500,
      body: { error: "Empty response" },
    });
  }
  return r.data;
}

/** Like unwrapEden but returns null on 404 instead of throwing. */
export async function unwrapEdenOrNull<T>(promise: Promise<unknown>): Promise<T | null> {
  try {
    return await unwrapEden<T>(promise);
  } catch (e) {
    if (isApiError(e) && e.status === 404) return null;
    throw e;
  }
}
