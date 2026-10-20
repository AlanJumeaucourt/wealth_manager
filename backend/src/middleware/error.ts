import type { Context } from "elysia";
import type { ErrorMessageRef } from "./log.js";
import { AppError } from "../utils/error.js";

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
  errors?: Record<string, unknown>;
  msg?: string;
}

const GENERIC_OWNERSHIP_ERROR = "Invalid related record reference";

/**
 * Temporary bridge for plain Error throws until all call sites use AppError.
 * First match wins. Prefer AppError / Elysia codes over this map.
 */
const ERROR_STATUS_MAP: Array<{ status: number; patterns: string[]; responseMessage?: string }> = [
  { status: 401, patterns: ["Unauthorized", "jwt", "token"] },
  { status: 403, patterns: ["Forbidden", "cannot access"] },
  {
    status: 403,
    patterns: [
      "Invalid related record reference",
      "owned by different user",
      "ownership",
      "Ownership violation:",
      "Cannot dismiss potential refund for transaction",
    ],
    responseMessage: GENERIC_OWNERSHIP_ERROR,
  },
  { status: 404, patterns: ["not found", "Not found"] },
  { status: 409, patterns: ["already exists", "Conflict"] },
  { status: 400, patterns: ["required"] },
];

function requestLine(request: Request): string {
  const url = new URL(request.url);
  return `${request.method} ${url.pathname}`;
}

function elysiaErrorCode(error: Error): string | undefined {
  if ("code" in error && typeof (error as { code: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return undefined;
}

function validationDetails(error: Error): unknown {
  const e = error as Error & { all?: unknown; detail?: unknown };
  if (e.all != null) return e.all;
  if (e.detail != null) return e.detail;
  return undefined;
}

export function errorHandler({
  set,
  error: rawError,
  request,
  _errorRef,
}: {
  set: Context["set"];
  error: unknown;
  request?: Request;
  _errorRef?: ErrorMessageRef;
}) {
  const error = rawError instanceof Error ? rawError : new Error(String(rawError));

  if (error instanceof AppError) {
    const message = error.message ?? "Internal server error";
    if (_errorRef) _errorRef.current = message;
    set.status = error.status;
    logErrorResponse(request, error.status, message, error.stack, error.code);
    return {
      error: message,
      code: error.code,
      ...(error.details !== undefined && { details: error.details }),
    } satisfies ErrorResponse;
  }

  const elysiaCode = elysiaErrorCode(error);

  if (elysiaCode === "VALIDATION") {
    const message = error.message || "Validation failed";
    if (_errorRef) _errorRef.current = message;
    set.status = 422;
    const details = validationDetails(error);
    logErrorResponse(request, 422, message);
    return {
      error: message,
      code: "VALIDATION",
      ...(details !== undefined && { details }),
    } satisfies ErrorResponse;
  }

  if (elysiaCode === "NOT_FOUND") {
    const message = error.message || "Not found";
    if (_errorRef) _errorRef.current = message;
    set.status = 404;
    logErrorResponse(request, 404, message);
    return { error: message, code: "NOT_FOUND" } satisfies ErrorResponse;
  }

  if (elysiaCode === "PARSE" || elysiaCode === "INVALID_COOKIE_SIGNATURE") {
    const message = error.message || "Bad request";
    if (_errorRef) _errorRef.current = message;
    set.status = 400;
    logErrorResponse(request, 400, message);
    return { error: message, code: "VALIDATION" } satisfies ErrorResponse;
  }

  const message = error.message ?? "Internal server error";
  if (_errorRef) _errorRef.current = message;

  const lower = message.toLowerCase();
  for (const { status, patterns, responseMessage } of ERROR_STATUS_MAP) {
    if (patterns.some((p) => lower.includes(p.toLowerCase()))) {
      const bodyMessage = responseMessage ?? message;
      set.status = status;
      logErrorResponse(request, status, message);
      const code =
        status === 401
          ? "UNAUTHORIZED"
          : status === 403
            ? "FORBIDDEN"
            : status === 404
              ? "NOT_FOUND"
              : status === 409
                ? "CONFLICT"
                : "VALIDATION";
      return (
        status === 401 ? { error: message, msg: message, code } : { error: bodyMessage, code }
      ) satisfies ErrorResponse;
    }
  }

  set.status = 500;
  const isProd = process.env.NODE_ENV === "production";
  const cause =
    error.cause instanceof Error
      ? error.cause.message
      : error.cause != null
        ? typeof error.cause === "string"
          ? error.cause
          : JSON.stringify(error.cause)
        : undefined;
  logErrorResponse(request, 500, message, error.stack, cause);
  return {
    error: isProd ? "Internal server error" : message,
  } satisfies ErrorResponse;
}

function logErrorResponse(
  request: Request | undefined,
  status: number,
  message: string,
  stack?: string,
  cause?: string,
): void {
  const prefix = request ? `${requestLine(request)} ` : "";
  if (status >= 500) {
    console.error(`${prefix}${status} - ${message}`);
    if (cause) console.error("Cause:", cause);
    if (stack) console.error(stack);
  } else {
    console.warn(`${prefix}${status} - ${message}`);
  }
}
