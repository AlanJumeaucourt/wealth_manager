import { useDismissPotentialRefund, usePotentialRefunds } from "@/api/queries";
import { CreateRefundModal } from "@/components/refunds/CreateRefundModal";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { PotentialRefund } from "@/types";
import { formatCurrency } from "@/utils/currency";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";

function txCurrency(tx: { to_currency?: string | null }) {
  return (tx.to_currency && String(tx.to_currency)) || "EUR";
}

export function PotentialRefundsPage() {
  const { toast } = useToast();
  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
  } = usePotentialRefunds({ limit: 100 });
  const dismiss = useDismissPotentialRefund();
  const [modalOpen, setModalOpen] = useState(false);
  const [prefillPair, setPrefillPair] = useState<{ incomeId: number; expenseId: number } | null>(
    null,
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setPrefillPair(null);
  }, []);

  const openLinkRefund = useCallback((incomeId: number, expenseId: number) => {
    setPrefillPair({ incomeId, expenseId });
    setModalOpen(true);
  }, []);

  const onDismiss = useCallback(
    (incomeId: number) => {
      dismiss.mutate(incomeId, {
        onSuccess: () => {
          toast({ title: "Suggestion dismissed" });
        },
        onError: (e) => {
          toast({
            title: "Could not dismiss",
            description: e instanceof Error ? e.message : String(e),
            variant: "destructive",
          });
        },
      });
    },
    [dismiss, toast],
  );

  return (
    <PageContainer
      title="Potential refunds"
      description="Income transactions whose description looks like a refund credit, with suggested matching expenses. Dismiss false positives or link a pair to record a refund."
      action={
        <Button variant="outline" asChild>
          <Link to="/refunds">Recorded refunds</Link>
        </Button>
      }
    >
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Failed to load suggestions</p>
          <p className="text-muted-foreground mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !isError && items.length === 0 ? (
        <div className="text-center py-16 max-w-lg mx-auto space-y-3">
          <Sparkles className="w-10 h-10 mx-auto text-muted-foreground" />
          <h3 className="text-lg font-medium">No potential refunds right now</h3>
          <p className="text-sm text-muted-foreground">
            We look for refund-like keywords in income descriptions and suggest expenses that may
            match by amount, date, and account. You can still{" "}
            <Link to="/refunds" className="underline underline-offset-2">
              record a refund manually
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-6">
          {items.map((item: PotentialRefund) => (
            <PotentialRefundCard
              key={item.incomeTransaction.id}
              item={item}
              onDismiss={() => onDismiss(item.incomeTransaction.id)}
              dismissing={dismiss.isPending}
              onLinkRefund={(expenseId) => openLinkRefund(item.incomeTransaction.id, expenseId)}
            />
          ))}
        </ul>
      )}

      <CreateRefundModal isOpen={modalOpen} onClose={closeModal} prefillPair={prefillPair} />
    </PageContainer>
  );
}

function PotentialRefundCard({
  item,
  onDismiss,
  dismissing,
  onLinkRefund,
}: {
  item: PotentialRefund;
  onDismiss: () => void;
  dismissing: boolean;
  onLinkRefund: (expenseId: number) => void;
}) {
  const inc = item.incomeTransaction;
  const top = item.suggestedExpenses[0];

  return (
    <li className="rounded-lg border border-border bg-card/50 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Income (possible refund)
          </p>
          <p className="font-medium break-words">{inc.description || "—"}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{inc.date}</span>
            <span className="font-medium text-foreground">
              {formatCurrency(inc.amount, txCurrency(inc))}
            </span>
            <Link
              to="/transactions/$transactionId"
              params={{ transactionId: String(inc.id) }}
              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
            >
              Open transaction <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-2">{item.matchReason}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onDismiss} disabled={dismissing}>
            Dismiss
          </Button>
          {top && (
            <Button
              size="sm"
              onClick={() => onLinkRefund(top.transaction.id)}
              disabled={dismissing}
            >
              Link top match
            </Button>
          )}
        </div>
      </div>

      {item.suggestedExpenses.length > 0 ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Suggested expenses</p>
          <ul className="space-y-2">
            {item.suggestedExpenses.map((s) => {
              const e = s.transaction;
              return (
                <li
                  key={e.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-muted-foreground mr-2">Score {Math.round(s.score)}</span>
                    <span className="break-words">{e.description || "—"}</span>
                    <span className="text-muted-foreground mx-2">·</span>
                    <span>{e.date}</span>
                    <span className="mx-2 font-medium text-foreground">
                      {formatCurrency(Math.abs(e.amount), txCurrency(e))}
                    </span>
                    <Link
                      to="/transactions/$transactionId"
                      params={{ transactionId: String(e.id) }}
                      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline ml-1"
                    >
                      Open
                    </Link>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onLinkRefund(e.id)}
                    disabled={dismissing}
                  >
                    Link refund
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground border-t border-border pt-3">
          No matching expenses found automatically. You can dismiss this suggestion or{" "}
          <Link to="/refunds" className="underline underline-offset-2">
            create a refund manually
          </Link>
          .
        </p>
      )}
    </li>
  );
}
