import { describe, expect, test } from "bun:test";
import { validateProposals } from "./proposals.js";

describe("validateProposals", () => {
  test("accepts update_transaction", () => {
    const result = validateProposals({
      proposals: [
        {
          kind: "update_transaction",
          transactionId: 1,
          patch: { category: "Alimentation & Restauration" },
          reason: "Grocery store description",
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.proposals).toHaveLength(1);
    }
  });

  test("rejects invalid kind", () => {
    const result = validateProposals({
      proposals: [{ kind: "delete_all", reason: "nope" }],
    });
    expect(result.ok).toBe(false);
  });

  test("normalizes snake_case flat transaction proposal", () => {
    const result = validateProposals({
      proposals: [
        {
          kind: "update_transaction",
          transaction_id: 99,
          category: "Banque",
          subcategory: "Frais bancaires",
          reason: "Bank fee miscategorized",
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.proposals[0]).toEqual({
        kind: "update_transaction",
        transactionId: 99,
        patch: { category: "Banque", subcategory: "Frais bancaires" },
        reason: "Bank fee miscategorized",
      });
    }
  });
});
