import { describe, expect, test } from "bun:test";
import { errorHandler } from "./error.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../utils/error.js";

function runHandler(error: unknown) {
  const set: { status?: number | string } = {};
  const body = errorHandler({ set, error });
  return { status: set.status, body };
}

describe("errorHandler", () => {
  test("AppError NotFound → 404 + code", () => {
    const { status, body } = runHandler(new NotFoundError("Bank not found"));
    expect(status).toBe(404);
    expect(body).toEqual({ error: "Bank not found", code: "NOT_FOUND" });
  });

  test("AppError Conflict → 409", () => {
    const { status, body } = runHandler(new ConflictError("already exists"));
    expect(status).toBe(409);
    expect(body).toEqual({ error: "already exists", code: "CONFLICT" });
  });

  test("AppError Unauthorized → 401", () => {
    const { status, body } = runHandler(new UnauthorizedError("Unauthorized: missing token"));
    expect(status).toBe(401);
    expect(body).toEqual({
      error: "Unauthorized: missing token",
      code: "UNAUTHORIZED",
    });
  });

  test("AppError Forbidden → 403", () => {
    const { status, body } = runHandler(new ForbiddenError("cannot access"));
    expect(status).toBe(403);
    expect(body).toEqual({ error: "cannot access", code: "FORBIDDEN" });
  });

  test("AppError Validation with details", () => {
    const { status, body } = runHandler(new ValidationError("bad field", { field: "name" }));
    expect(status).toBe(400);
    expect(body).toEqual({
      error: "bad field",
      code: "VALIDATION",
      details: { field: "name" },
    });
  });

  test("Elysia VALIDATION code → 422 + details", () => {
    const err = new Error("Expected string") as Error & { code: string; all: unknown };
    err.code = "VALIDATION";
    err.all = [{ path: "/name", message: "Expected string" }];
    const { status, body } = runHandler(err);
    expect(status).toBe(422);
    expect(body).toMatchObject({
      error: "Expected string",
      code: "VALIDATION",
      details: [{ path: "/name", message: "Expected string" }],
    });
  });

  test("Elysia NOT_FOUND code → 404", () => {
    const err = new Error("NOT_FOUND") as Error & { code: string };
    err.code = "NOT_FOUND";
    const { status, body } = runHandler(err);
    expect(status).toBe(404);
    expect(body).toEqual({ error: "NOT_FOUND", code: "NOT_FOUND" });
  });

  test("plain Error with ownership phrase → 403 generic message", () => {
    const { status, body } = runHandler(new Error("owned by different user"));
    expect(status).toBe(403);
    expect(body).toEqual({
      error: "Invalid related record reference",
      code: "FORBIDDEN",
    });
  });

  test("unknown Error → 500", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const { status, body } = runHandler(new Error("boom unexpected"));
      expect(status).toBe(500);
      expect(body).toEqual({ error: "boom unexpected" });
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
