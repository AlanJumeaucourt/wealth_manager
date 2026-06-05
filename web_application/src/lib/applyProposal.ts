import { unwrapEden } from "@/api/edenUnwrap";
import { QueryKeys } from "@/api/queryKeys";
import { wealthApi } from "@/api/wealthApi";
import type { Proposal } from "@/types/assistant";
import type { QueryClient } from "@tanstack/react-query";

export async function applyProposal(proposal: Proposal, queryClient: QueryClient): Promise<void> {
  switch (proposal.kind) {
    case "update_transaction": {
      await unwrapEden(wealthApi.transactions({ id: proposal.transactionId }).put(proposal.patch));
      break;
    }
    case "update_account": {
      await unwrapEden(wealthApi.accounts({ id: proposal.accountId }).put(proposal.patch));
      break;
    }
    case "batch_update_transactions": {
      await unwrapEden(
        wealthApi.transactions.batch.update.post({
          items: proposal.updates.map((u) => ({
            id: u.id,
            ...(u.category !== undefined ? { category: u.category } : {}),
            ...(u.subcategory !== undefined ? { subcategory: u.subcategory } : {}),
          })),
        }),
      );
      break;
    }
    default: {
      const _exhaustive: never = proposal;
      throw new Error(`Unknown proposal kind: ${(_exhaustive as Proposal).kind}`);
    }
  }

  await queryClient.invalidateQueries({ queryKey: QueryKeys.transactions });
  await queryClient.invalidateQueries({ queryKey: QueryKeys.accounts });
  await queryClient.invalidateQueries({ queryKey: QueryKeys.categories });
  await queryClient.invalidateQueries({ queryKey: QueryKeys.budgetSummary });
  await queryClient.invalidateQueries({ queryKey: QueryKeys.wealthOverTime });
}
