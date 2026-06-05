import { applyProposal } from "@/lib/applyProposal";
import type { Proposal } from "@/types/assistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type ProposalCardProps = {
  proposal: Proposal;
  onDismiss: () => void;
};

function proposalTitle(proposal: Proposal): string {
  if (proposal.kind === "update_transaction") {
    return `Update transaction #${proposal.transactionId}`;
  }
  if (proposal.kind === "update_account") {
    return `Rename account #${proposal.accountId}`;
  }
  return `Batch update ${proposal.updates.length} transactions`;
}

function successDescription(proposal: Proposal): string {
  if (proposal.kind === "update_transaction") {
    const { category, subcategory } = proposal.patch;
    const cat = [category, subcategory].filter(Boolean).join(" › ");
    return cat ? `Category set to ${cat}` : "Transaction updated";
  }
  if (proposal.kind === "update_account") {
    return `Renamed to “${proposal.patch.name}”`;
  }
  return `${proposal.updates.length} transactions updated`;
}

export function ProposalCard({ proposal, onDismiss }: ProposalCardProps) {
  const queryClient = useQueryClient();
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{proposalTitle(proposal)}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <p className="text-muted-foreground">{proposal.reason}</p>
        <pre className="rounded bg-muted p-2 text-xs overflow-x-auto">
          {JSON.stringify(
            proposal.kind === "update_transaction"
              ? proposal.patch
              : proposal.kind === "update_account"
                ? proposal.patch
                : proposal.updates,
            null,
            2,
          )}
        </pre>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          size="sm"
          disabled={applying}
          onClick={async () => {
            setApplying(true);
            setError(null);
            try {
              await applyProposal(proposal, queryClient);
              toast({
                title: "Change applied",
                description: successDescription(proposal),
              });
              onDismiss();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
              toast({
                variant: "destructive",
                title: "Could not apply",
                description: e instanceof Error ? e.message : String(e),
              });
            } finally {
              setApplying(false);
            }
          }}
        >
          {applying ? "Applying…" : "Apply"}
        </Button>
        <Button size="sm" variant="outline" onClick={onDismiss} disabled={applying}>
          Dismiss
        </Button>
      </CardFooter>
    </Card>
  );
}
