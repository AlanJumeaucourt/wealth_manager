import { describe, expect, test } from "bun:test";
import { convertAmount } from "./currencyConversion.js";

describe("convertAmount (live FX wrapper)", () => {
  test("same currency returns rounded amount", async () => {
    expect(await convertAmount(12.345, "EUR", "EUR")).toBe(12.35);
  });

  test("case-insensitive currency codes", async () => {
    expect(await convertAmount(10, "eur", "EUR")).toBe(10);
  });
});
