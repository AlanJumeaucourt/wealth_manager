import { t } from "elysia";
import { Value } from "@sinclair/typebox/value";

export const tProposalPatchTransaction = t.Object({
  category: t.Optional(t.String()),
  subcategory: t.Optional(t.Union([t.String(), t.Null()])),
  description: t.Optional(t.String()),
});

export const tProposalUpdateTransaction = t.Object({
  kind: t.Literal("update_transaction"),
  transactionId: t.Number(),
  patch: tProposalPatchTransaction,
  reason: t.String(),
  evidence: t.Optional(t.String()),
});

export const tProposalUpdateAccount = t.Object({
  kind: t.Literal("update_account"),
  accountId: t.Number(),
  patch: t.Object({ name: t.String() }),
  reason: t.String(),
  evidence: t.Optional(t.String()),
});

export const tProposalBatchUpdateTransactions = t.Object({
  kind: t.Literal("batch_update_transactions"),
  updates: t.Array(
    t.Object({
      id: t.Number(),
      category: t.Optional(t.String()),
      subcategory: t.Optional(t.Union([t.String(), t.Null()])),
    }),
  ),
  reason: t.String(),
  evidence: t.Optional(t.String()),
});

export const tProposal = t.Union([
  tProposalUpdateTransaction,
  tProposalUpdateAccount,
  tProposalBatchUpdateTransactions,
]);

export const tProposeChangesBody = t.Object({
  proposals: t.Array(tProposal),
});

export type Proposal = (typeof tProposal)["static"];

export const PROPOSE_CHANGES_EXAMPLE = {
  proposals: [
    {
      kind: "update_transaction",
      transactionId: 84510,
      patch: {
        category: "Scolarité & Enfants",
        subcategory: "Prêt étudiant",
      },
      reason: "Interest accrual should use French student-loan category",
      evidence: "Interest accrual for Prêt Etudiant CE",
    },
  ],
} as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") return value;
  return undefined;
}

function normalizeKind(raw: unknown): string | undefined {
  const k = asString(raw);
  if (!k) return undefined;
  const lower = k.toLowerCase().replace(/-/g, "_");
  if (lower === "update" || lower === "fix_transaction" || lower === "transaction") {
    return "update_transaction";
  }
  if (lower === "account" || lower === "fix_account") {
    return "update_account";
  }
  if (lower === "batch" || lower === "batch_update") {
    return "batch_update_transactions";
  }
  return lower;
}

function normalizePatchTransaction(o: Record<string, unknown>): Record<string, unknown> {
  const patch = asRecord(o.patch) ?? {};
  if (o.category !== undefined) patch.category = o.category;
  if (o.subcategory !== undefined) patch.subcategory = o.subcategory;
  if (o.description !== undefined) patch.description = o.description;
  return patch;
}

/** Coerce common LLM proposal shapes before TypeBox validation. */
export function normalizeProposalItem(item: unknown): unknown {
  const o = asRecord(item);
  if (!o) return item;

  const kind = normalizeKind(o.kind ?? o.type ?? o.action);

  if (kind === "update_transaction") {
    const transactionId = asNumber(o.transactionId ?? o.transaction_id ?? o.id);
    const patch = normalizePatchTransaction(o);
    const reason = asString(o.reason ?? o.rationale ?? o.message) ?? "Category update";
    if (transactionId == null) return item;
    return {
      kind: "update_transaction",
      transactionId,
      patch,
      reason,
      ...(asString(o.evidence) ? { evidence: asString(o.evidence) } : {}),
    };
  }

  if (kind === "update_account") {
    const accountId = asNumber(o.accountId ?? o.account_id ?? o.id);
    const patchRecord = asRecord(o.patch);
    const name = asString(patchRecord?.name ?? o.name);
    const reason = asString(o.reason ?? o.rationale) ?? "Account rename";
    if (accountId == null || !name) return item;
    return {
      kind: "update_account",
      accountId,
      patch: { name },
      reason,
      ...(asString(o.evidence) ? { evidence: asString(o.evidence) } : {}),
    };
  }

  if (kind === "batch_update_transactions" && Array.isArray(o.updates)) {
    const updates = o.updates
      .map((u) => {
        const row = asRecord(u);
        if (!row) return null;
        const id = asNumber(row.id ?? row.transactionId ?? row.transaction_id);
        if (id == null) return null;
        return {
          id,
          ...(row.category !== undefined ? { category: row.category } : {}),
          ...(row.subcategory !== undefined ? { subcategory: row.subcategory } : {}),
        };
      })
      .filter((u): u is NonNullable<typeof u> => u != null);
    const reason = asString(o.reason ?? o.rationale) ?? "Batch category update";
    return {
      kind: "batch_update_transactions",
      updates,
      reason,
      ...(asString(o.evidence) ? { evidence: asString(o.evidence) } : {}),
    };
  }

  return item;
}

export function normalizeProposalsInput(raw: unknown): unknown {
  const body = asRecord(raw);
  if (!body) return raw;
  const proposals = body.proposals;
  if (!Array.isArray(proposals)) return raw;
  return {
    ...body,
    proposals: proposals.map(normalizeProposalItem),
  };
}

export function validateProposals(
  raw: unknown,
): { ok: true; proposals: Proposal[] } | { ok: false; error: string } {
  const normalized = normalizeProposalsInput(raw);
  if (!Value.Check(tProposeChangesBody, normalized)) {
    const errors = [...Value.Errors(tProposeChangesBody, normalized)];
    const detail = errors.map((e) => `${e.path}: ${e.message}`).join("; ");
    return {
      ok: false,
      error: `${detail}. Example: ${JSON.stringify(PROPOSE_CHANGES_EXAMPLE)}`,
    };
  }
  return { ok: true, proposals: Value.Decode(tProposeChangesBody, normalized).proposals };
}
