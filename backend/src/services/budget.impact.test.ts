import { describe, expect, test } from "bun:test";
import { computeBudgetImpact } from "./budget.js";

const txBase = {
  id: 1,
  date: "2024-01-15",
  date_accountability: "2024-01-15",
  type: "income" as const,
  category: "Test",
  subcategory: null,
  amount: 1000,
  to_amount: 1000,
  from_account_id: 1,
  to_account_id: 2,
};

describe("computeBudgetImpact loan financing", () => {
  test("excludes expense originating from a loan account", () => {
    const result = computeBudgetImpact({
      tx: { ...txBase, type: "expense", amount: 50, to_amount: null },
      fromAccount: { type: "loan", currency: "EUR" },
      toAccount: { type: "expense", currency: "EUR" },
      refunded: 0,
    });
    expect(result.include).toBe(false);
  });

  test("excludes income originating from a loan account (disbursement)", () => {
    const result = computeBudgetImpact({
      tx: { ...txBase, type: "income" },
      fromAccount: { type: "loan", currency: "EUR" },
      toAccount: { type: "checking", currency: "EUR" },
      refunded: 0,
    });
    expect(result.include).toBe(false);
  });

  test("keeps earned income and subtracts refunds on net", () => {
    const result = computeBudgetImpact({
      tx: { ...txBase, type: "income", to_amount: 2000 },
      fromAccount: { type: "income", currency: "EUR" },
      toAccount: { type: "checking", currency: "EUR" },
      refunded: 200,
    });
    expect(result.include).toBe(true);
    expect(result.originalAmount).toBe(2000);
    expect(result.netAmount).toBe(1800);
  });
});
