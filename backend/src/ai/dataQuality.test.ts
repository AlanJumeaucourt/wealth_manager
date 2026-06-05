import { describe, expect, test } from "bun:test";

// Unit-test heuristics via internal logic mirrors (no DB).
const WEAK = new Set(["Autres dépenses", "Autres rentrées"]);
const PLACEHOLDER = /^(unknown|unnamed|compte|account)(\s*\d*)?$/i;

function isWeakCategory(category: string): boolean {
  return WEAK.has(category) || category === "Not A Real Category";
}

function isPlaceholder(name: string, type: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 3) return true;
  if (PLACEHOLDER.test(trimmed)) return true;
  if (trimmed.toLowerCase() === type.toLowerCase()) return true;
  return false;
}

describe("dataQuality heuristics", () => {
  test("weak categories", () => {
    expect(isWeakCategory("Autres dépenses")).toBe(true);
    expect(isWeakCategory("Alimentation & Restauration")).toBe(false);
  });

  test("placeholder account names", () => {
    expect(isPlaceholder("unknown", "checking")).toBe(true);
    expect(isPlaceholder("checking", "checking")).toBe(true);
    expect(isPlaceholder("Main Checking", "checking")).toBe(false);
  });
});
