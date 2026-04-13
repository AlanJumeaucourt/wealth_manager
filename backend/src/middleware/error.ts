import type { Context } from "elysia";
import type { ErrorMessageRef } from "./log.js";
import { AppError } from "../utils/error.js";

export interface ErrorResponse {
  error?: string;
  errors?: Record<string, unknown>;
  msg?: string;
}

const GENERIC_OWNERSHIP_ERROR = "Invalid related record reference";

/** Map error message substrings to HTTP status. First match wins. responseMessage overrides error message when set. */
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
  { status: 400, patterns: ["Validation", "Invalid", "required"] },
  { status: 422, patterns: ["Unsupported", "already exists"] },
];

function requestLine(request: Request): string {
  const url = new URL(request.url);
  return `${request.method} ${url.pathname}`;
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

  // Prefer explicit AppError instances when available.
  if (error instanceof AppError) {
    const message = error.message ?? "Internal server error";
    if (_errorRef) _errorRef.current = message;
    set.status = error.status;
    logErrorResponse(request, error.status, message, error.stack, error.code);
    return {
      error: message,
      code: error.code,
      ...(error.details !== undefined && { details: error.details }),
    } as ErrorResponse & { code: string };
  }

  const message = error.message ?? "Internal server error";
  if (_errorRef) _errorRef.current = message;

  const lower = message.toLowerCase();
  for (const { status, patterns, responseMessage } of ERROR_STATUS_MAP) {
    if (patterns.some((p) => lower.includes(p.toLowerCase()))) {
      const bodyMessage = responseMessage ?? message;
      set.status = status;
      logErrorResponse(request, status, message);
      return (
        status === 401 ? { error: message, msg: message } : { error: bodyMessage }
      ) as ErrorResponse;
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
  } as ErrorResponse;
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
