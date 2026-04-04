/**
 * Get a string message from an unknown error (e.g. from catch).
 * Keeps DRY the common pattern: e instanceof Error ? e.message : String(e)
 */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export type AppErrorCode = "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "UNAUTHORIZED" | "FORBIDDEN";

export class AppError extends Error {
  readonly status: number;
  readonly code: AppErrorCode;
  readonly details?: unknown;

  constructor(
    message: string,
    options: { status: number; code: AppErrorCode; cause?: unknown; details?: unknown },
  ) {
    const { status, code, cause, details } = options;
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found", details?: unknown) {
    super(message, { status: 404, code: "NOT_FOUND", details });
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(message, { status: 400, code: "VALIDATION", details });
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", details?: unknown) {
    super(message, { status: 409, code: "CONFLICT", details });
    this.name = "ConflictError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details?: unknown) {
    super(message, { status: 401, code: "UNAUTHORIZED", details });
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", details?: unknown) {
    super(message, { status: 403, code: "FORBIDDEN", details });
    this.name = "ForbiddenError";
  }
}
