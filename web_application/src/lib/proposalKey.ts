import type { Proposal } from "@/types/assistant";

/** Stable key for proposal list / dismiss state (not array index). */
export function proposalStableKey(proposal: Proposal): string {
  switch (proposal.kind) {
    case "update_transaction":
      return `update_transaction:${proposal.transactionId}`;
    case "update_account":
      return `update_account:${proposal.accountId}`;
    case "batch_update_transactions":
      return `batch_update_transactions:${proposal.updates.map((u) => u.id).join(",")}`;
    default: {
      const _exhaustive: never = proposal;
      return String(_exhaustive);
    }
  }
}
