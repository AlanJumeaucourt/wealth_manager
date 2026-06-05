import { z } from "zod";

/** Fields the LLM must pass on each propose_changes tool call (surfaced in the tool JSON schema). */
const zTransactionPatch = z.object({
  category: z.string().describe("French parent category from list_category_catalog"),
  subcategory: z
    .union([z.string(), z.null()])
    .optional()
    .describe("French subcategory from catalog, or null if none"),
  description: z.string().optional().describe("Optional description override"),
});

const zUpdateTransactionProposal = z.object({
  kind: z.literal("update_transaction"),
  transactionId: z
    .number()
    .int()
    .describe("Transaction id from find_data_quality_issues or list_transactions"),
  patch: zTransactionPatch,
  reason: z.string().min(1).describe("Why this change is correct (shown to the user)"),
  evidence: z.string().optional().describe("Optional snippet from the transaction description"),
});

const zUpdateAccountProposal = z.object({
  kind: z.literal("update_account"),
  accountId: z.number().int().describe("Account id from list_accounts"),
  patch: z.object({
    name: z.string().min(1).describe("New display name for the account"),
  }),
  reason: z.string().min(1),
  evidence: z.string().optional(),
});

const zBatchUpdateProposal = z.object({
  kind: z.literal("batch_update_transactions"),
  updates: z
    .array(
      z.object({
        id: z.number().int(),
        category: z.string().optional(),
        subcategory: z.union([z.string(), z.null()]).optional(),
      }),
    )
    .min(1),
  reason: z.string().min(1),
  evidence: z.string().optional(),
});

const zProposal = z.discriminatedUnion("kind", [
  zUpdateTransactionProposal,
  zUpdateAccountProposal,
  zBatchUpdateProposal,
]);

/** Tool parameters declaration sent to the model — must match validateProposals / TypeBox. */
export const zProposeChangesParameters = z.object({
  proposals: z
    .array(zProposal)
    .min(1)
    .max(25)
    .describe(
      "Required tool argument. Submit category/account fixes here — not in chat text. Max 25 items per call.",
    ),
});
