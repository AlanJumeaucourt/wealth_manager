import { describe, expect, test } from "bun:test";
import { addMoney, fromCents, round2, toCents } from "./money.js";

describe("money helpers", () => {
  test("toCents / fromCents round-trip", () => {
    expect(toCents(12.34)).toBe(1234);
    expect(fromCents(1234)).toBe(12.34);
    expect(fromCents(toCents(0.1 + 0.2))).toBe(round2(0.1 + 0.2));
  });

  test("addMoney avoids float drift", () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(addMoney(10.55, -0.05, 1)).toBe(11.5);
  });
});
