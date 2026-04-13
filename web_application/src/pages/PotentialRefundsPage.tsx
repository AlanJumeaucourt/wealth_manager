import {
  useDismissPotentialRefund,
  usePotentialRefunds,
  useResetPotentialRefundDismissals,
} from "@/api/queries";
import { PageContainer } from "@/components/layout/PageContainer";
import { CreateRefundModal } from "@/components/refunds/CreateRefundModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatTransactionDateForDisplay, type PotentialRefund } from "@/types";
import { formatCurrency } from "@/utils/currency";
import { Link } from "@tanstack/react-router";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ExternalLink, Loader2, RotateCcw, Sparkles } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";

/** Exit transition duration — must run before optimistic cache removal. */
const DISMISS_EXIT_MS = 320;

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
  const {
    mutate: dismissMutate,
    isPending: dismissIsPending,
    variables: dismissVariables,
  } = useDismissPotentialRefund();
  const { mutate: resetDismissalsMutate, isPending: resetDismissalsPending } =
    useResetPotentialRefundDismissals();
  const [modalOpen, setModalOpen] = useState(false);
  const [prefillPair, setPrefillPair] = useState<{
    incomeId: number;
    expenseId: number;
  } | null>(null);
  /** Cards mid–exit animation; mutation runs after so the row can animate before optimistic removal. */
  const [exitingIncomeIds, setExitingIncomeIds] = useState<number[]>([]);
  const dismissTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      for (const t of dismissTimersRef.current.values()) {
        clearTimeout(t);
      }
      dismissTimersRef.current.clear();
    };
  }, []);

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
      if (dismissTimersRef.current.has(incomeId)) return;
      setExitingIncomeIds((prev) => (prev.includes(incomeId) ? prev : [...prev, incomeId]));
      const t = setTimeout(() => {
        dismissTimersRef.current.delete(incomeId);
        dismissMutate(incomeId, {
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
          onSettled: () => {
            setExitingIncomeIds((prev) => prev.filter((id) => id !== incomeId));
          },
        });
      }, DISMISS_EXIT_MS);
      dismissTimersRef.current.set(incomeId, t);
    },
    [dismissMutate, toast],
  );

  /**
   * `useVirtualizer` + ref scroll parent often sees `getScrollElement() === null` on the first
   * commit; TanStack then falls back to rendering *all* rows (~81 cards → ~569 buttons). Window
   * scroll is always available; `scrollMargin` aligns the list with the document.
   */
  const listAnchorRef = useRef<HTMLDivElement>(null);
  const [listScrollMargin, setListScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const el = listAnchorRef.current;
    if (!el) return;

    const updateMargin = () => {
      setListScrollMargin(el.getBoundingClientRect().top + window.scrollY);
    };

    updateMargin();
    const ro = new ResizeObserver(() => updateMargin());
    ro.observe(el);
    window.addEventListener("resize", updateMargin);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateMargin);
    };
  }, [items.length]);

  const rowVirtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => 280,
    overscan: 8,
    scrollMargin: listScrollMargin,
    getItemKey: (index) => items[index]?.incomeTransaction.id ?? index,
  });

  return (
    <PageContainer
      title="Potential refunds"
      description="Income transactions whose description looks like a refund credit, with suggested matching expenses. Dismiss false positives or link a pair to record a refund."
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={resetDismissalsPending}
                className="gap-1.5"
              >
                {resetDismissalsPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Reset dismissals
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset dismissed suggestions?</AlertDialogTitle>
                <AlertDialogDescription>
                  Every income you hid with &quot;Dismiss&quot; will show up here again if it still
                  looks like a refund and has no recorded refund link. This does not affect refunds
                  you already recorded.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={resetDismissalsPending}
                  onClick={() =>
                    resetDismissalsMutate(undefined, {
                      onSuccess: () => {
                        toast({ title: "Dismissals cleared" });
                      },
                      onError: (e) => {
                        toast({
                          title: "Could not reset dismissals",
                          description: e instanceof Error ? e.message : String(e),
                          variant: "destructive",
                        });
                      },
                    })
                  }
                >
                  Reset all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
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
        <div ref={listAnchorRef} className="rounded-lg pr-1 -mr-1" role="list">
          <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = items[virtualRow.index] as PotentialRefund;
              const incomeId = item.incomeTransaction.id;
              const isExiting = exitingIncomeIds.includes(incomeId);
              return (
                <div
                  key={virtualRow.key}
                  role="listitem"
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className="absolute left-0 top-0 w-full pb-6"
                  style={{
                    // `start` includes `scrollMargin` (document Y); the parent is already offset in the
                    // layout, so subtract to avoid a blank band above the first card.
                    transform: `translateY(${virtualRow.start - listScrollMargin}px)`,
                  }}
                >
                  <PotentialRefundCard
                    item={item}
                    incomeId={incomeId}
                    onDismissItem={onDismiss}
                    dismissing={dismissIsPending && dismissVariables === incomeId}
                    isExiting={isExiting}
                    onLinkRefundPair={openLinkRefund}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CreateRefundModal isOpen={modalOpen} onClose={closeModal} prefillPair={prefillPair} />
    </PageContainer>
  );
}

const PotentialRefundCard = memo(function PotentialRefundCard({
  item,
  incomeId,
  onDismissItem,
  dismissing,
  isExiting,
  onLinkRefundPair,
}: {
  item: PotentialRefund;
  incomeId: number;
  /** Stable — call with this card's `incomeId` from the child. */
  onDismissItem: (incomeId: number) => void;
  dismissing: boolean;
  /** Exit motion plays before the request / optimistic removal. */
  isExiting: boolean;
  /** Stable — parent passes `openLinkRefund`. */
  onLinkRefundPair: (incomeId: number, expenseId: number) => void;
}) {
  const inc = item.incomeTransaction;
  const top = item.suggestedExpenses[0];
  const busy = dismissing || isExiting;

  const handleDismiss = useCallback(() => {
    onDismissItem(incomeId);
  }, [onDismissItem, incomeId]);

  /** One stable handler for all "link" buttons so Radix `Button` isn't fed a new `onClick` every render. */
  const handleLinkExpenseClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      const raw = e.currentTarget.dataset.expenseId;
      if (raw == null) return;
      onLinkRefundPair(incomeId, Number(raw));
    },
    [onLinkRefundPair, incomeId],
  );

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card/50 p-4 shadow-sm [contain:layout]",
        /* Blur/filter and animating `box-shadow` force expensive repaints; stick to compositor-friendly props. */
        "transition-[opacity,transform] duration-300 ease-out",
        "motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-x-0",
        isExiting && "pointer-events-none opacity-0 -translate-x-3 scale-[0.99] shadow-none",
      )}
      aria-busy={busy || undefined}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Income (possible refund)
          </p>
          <p className="font-medium break-words">{inc.description || "—"}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{formatTransactionDateForDisplay(inc.date)}</span>
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
          <Button variant="outline" size="sm" onClick={handleDismiss} disabled={busy}>
            {dismissing ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Dismissing…
              </>
            ) : (
              "Dismiss"
            )}
          </Button>
          {top && (
            <Button
              type="button"
              size="sm"
              data-expense-id={top.transaction.id}
              onClick={handleLinkExpenseClick}
              disabled={busy}
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
                    <span>{formatTransactionDateForDisplay(e.date)}</span>
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
                    type="button"
                    size="sm"
                    variant="secondary"
                    data-expense-id={e.id}
                    onClick={handleLinkExpenseClick}
                    disabled={busy}
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
    </div>
  );
});
