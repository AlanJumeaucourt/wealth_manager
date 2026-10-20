import { describe, expect, test } from "bun:test";
import { ApiError, getApiErrorMessage, isApiError, unwrapEden } from "./edenUnwrap";

describe("unwrapEden / ApiError", () => {
  test("returns data on success", async () => {
    const data = await unwrapEden<{ id: number }>(
      Promise.resolve({ data: { id: 1 }, error: null, status: 200 }),
    );
    expect(data).toEqual({ id: 1 });
  });

  test("throws ApiError with status and code", async () => {
    try {
      await unwrapEden(
        Promise.resolve({
          data: null,
          error: { value: { error: "Bank not found", code: "NOT_FOUND" } },
          status: 404,
        }),
      );
      expect.unreachable("should throw");
    } catch (e) {
      expect(isApiError(e)).toBe(true);
      const err = e as ApiError;
      expect(err.status).toBe(404);
      expect(err.code).toBe("NOT_FOUND");
      expect(err.message).toBe("Bank not found");
    }
  });

  test("404 empty data throws ApiError not empty object", async () => {
    try {
      await unwrapEden(Promise.resolve({ data: null, error: null, status: 404 }));
      expect.unreachable("should throw");
    } catch (e) {
      expect(isApiError(e)).toBe(true);
      expect((e as ApiError).status).toBe(404);
    }
  });

  test("getApiErrorMessage", () => {
    expect(getApiErrorMessage(new ApiError("x", { status: 400 }))).toBe("x");
    expect(getApiErrorMessage(new Error("y"))).toBe("y");
    expect(getApiErrorMessage("z")).toBe("Request failed");
  });
});
