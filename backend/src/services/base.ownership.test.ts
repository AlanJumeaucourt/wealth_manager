import { describe, expect, test } from "bun:test";
import { ForbiddenError } from "../utils/error.js";
import { requireSelfAccess } from "../middleware/auth.js";

describe("ownership helpers", () => {
  test("requireSelfAccess throws ForbiddenError on mismatch", () => {
    expect(() => requireSelfAccess(1, 2)).toThrow(ForbiddenError);
  });

  test("requireSelfAccess allows matching user", () => {
    expect(() => requireSelfAccess(5, 5)).not.toThrow();
  });
});
