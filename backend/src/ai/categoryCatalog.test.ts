import { describe, expect, test } from "bun:test";
import { getAgentCategoryCatalog } from "./categoryCatalog.js";

describe("getAgentCategoryCatalog", () => {
  test("returns French names only without icons or English", () => {
    const catalog = getAgentCategoryCatalog();
    const expense = catalog.expense;
    expect(expense?.length).toBeGreaterThan(0);
    const first = expense![0]!;
    expect(typeof first.name).toBe("string");
    expect(first.name.length).toBeGreaterThan(0);
    expect(Array.isArray(first.subcategories)).toBe(true);
    expect(JSON.stringify(catalog)).not.toContain('"en"');
    expect(JSON.stringify(catalog)).not.toContain("iconName");
    expect(JSON.stringify(catalog)).not.toContain("color");
  });
});
