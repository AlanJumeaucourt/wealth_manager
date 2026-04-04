import {
  useAccounts,
  useAssets,
  useInvestmentDetail,
  useInvestments,
  useRefundGroups,
  useRefundItems,
  useTransactions,
} from "@/api/queries";
import { AddInvestmentDialog } from "@/components/investmentsTransaction/AddInvestmentTransactionDialog";
import { PageContainer } from "@/components/layout/PageContainer";
import { DeleteTransactionDialog } from "@/components/transactions/DeleteTransactionDialog";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { cn } from "@/lib/utils";
import { transactionDetailRoute } from "@/Router";
import { useDialogStore } from "@/store/dialogStore";
import { Investment, Transaction } from "@/types";
import { formatCurrency, formatDualCurrency } from "@/utils/currency";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calendar,
  CreditCard,
  FileText,
  Pencil,
  RefreshCw,
  Tag,
  Trash,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

function formatTxAmount(t: Transaction, preferredCurrency: string): string {
  const amt = Math.abs(t.amount_preferred ?? t.amount);
  const curr = t.preferred_currency ?? preferredCurrency;
  const fromCurr = (t.from_currency ?? "EUR").toUpperCase();
  const toCurr = (t.to_currency ?? "EUR").toUpperCase();
  // Cross-currency transfer: - old currency, + new currency
  if (t.type === "transfer" && t.to_amount != null && fromCurr !== toCurr) {
    return `-${formatCurrency(Math.abs(t.amount), fromCurr)} (+${formatCurrency(Math.abs(t.to_amount), toCurr)})`;
  }
  const orig = t.currency ?? "EUR";
  if (orig !== curr) {
    return formatDualCurrency(amt, curr, Math.abs(t.amount), orig);
  }
  return formatCurrency(amt, curr);
}

function formatUnitPrice(amount: number, currency: string): string {
  const code = (currency || "EUR").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  } catch {
    return `${amount.toFixed(4)} ${code}`;
  }
}

function InvestmentTransactionExtras({
  transaction,
  preferredCurrency,
  getAccountName,
  editRequested,
  onEditRequestHandled,
  onEditInvestment,
  investmentFromDetail,
  relatedTransactionsFromDetail,
}: {
  transaction: Transaction;
  preferredCurrency: string;
  getAccountName: (accountId?: number) => string;
  editRequested: boolean;
  onEditRequestHandled: () => void;
  onEditInvestment: (investment: Investment) => void;
  investmentFromDetail?: Investment | null;
  relatedTransactionsFromDetail?: Transaction[];
}) {
  const navigate = useNavigate();

  const shouldUseDetail = !!investmentFromDetail;

  const {
    data: investmentsResponse,
    isLoading: isLoadingInvestment,
    isFetching: isFetchingInvestment,
  } = useInvestments(
    shouldUseDetail
      ? undefined
      : {
          transaction_id: transaction.id,
          per_page: 1,
          page: 1,
        },
  );

  const investment = (investmentFromDetail ??
    (investmentsResponse?.items?.[0] as Investment | undefined)) as Investment | undefined;

  const relatedTransactionIds = useMemo(() => {
    if (!investment || relatedTransactionsFromDetail) return [];
    const ids = [
      investment.pl_transaction_id,
      investment.fee_transaction_id,
      investment.tax_transaction_id,
    ]
      .map((v) => (typeof v === "number" ? v : v ? Number(v) : null))
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    return Array.from(new Set(ids));
  }, [investment, relatedTransactionsFromDetail]);

  const { data: relatedTransactionsResponse } = useTransactions(
    relatedTransactionIds.length > 0
      ? {
          id: relatedTransactionIds,
          per_page: relatedTransactionIds.length,
        }
      : undefined,
  );

  const relatedTransactions: Transaction[] = useMemo(
    () => relatedTransactionsFromDetail ?? relatedTransactionsResponse?.items ?? [],
    [relatedTransactionsFromDetail, relatedTransactionsResponse],
  );
  const plTransaction = useMemo(() => {
    const id = investment?.pl_transaction_id;
    if (id == null) return null;
    return relatedTransactions.find((t) => t.id === id) ?? null;
  }, [investment?.pl_transaction_id, relatedTransactions]);
  const otherRelatedTransactions = useMemo(() => {
    if (!investment) return [];
    return relatedTransactions.filter((t) => t.id !== transaction.id);
  }, [investment, relatedTransactions, transaction.id]);

  const { data: assetsResponse, isLoading: isLoadingAssets } = useAssets({
    per_page: 1000,
    sort_by: "symbol",
    sort_order: "asc",
  });

  const asset = useMemo(() => {
    if (!investment) return null;
    return assetsResponse?.items?.find((a) => a.id === investment.asset_id) ?? null;
  }, [assetsResponse?.items, investment]);

  const displayCurrency = (
    transaction.currency ??
    transaction.preferred_currency ??
    preferredCurrency ??
    "EUR"
  ).toUpperCase();

  const totalFallback =
    investment != null
      ? investment.quantity * investment.unit_price + investment.fee + investment.tax
      : 0;
  const total = investment?.total_paid ?? totalFallback;

  const realizedPL = useMemo(() => {
    if (!investment || investment.investment_type !== "Sell") return null;

    const source = investment.gain_loss_source;
    if (source === "manual" && investment.gain_loss_override != null) {
      return {
        value: Number(investment.gain_loss_override),
        source: "manual" as const,
      };
    }
    if (source === "calculated" && investment.gain_loss_calculated != null) {
      return {
        value: Number(investment.gain_loss_calculated),
        source: "calculated" as const,
      };
    }

    // Fallback to the P/L transaction sign if backend didn't provide fields (older rows)
    if (plTransaction) {
      const signed =
        plTransaction.type === "income"
          ? Math.abs(plTransaction.amount)
          : -Math.abs(plTransaction.amount);
      return {
        value: signed,
        source: (source ?? "calculated") as "manual" | "calculated",
      };
    }

    return null;
  }, [investment, plTransaction]);

  const typeMeta = useMemo(() => {
    const t = investment?.investment_type;
    switch (t) {
      case "Buy":
        return {
          label: "Buy",
          icon: <TrendingUp className="h-4 w-4 text-emerald-600" />,
          pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        };
      case "Sell":
        return {
          label: "Sell",
          icon: <TrendingDown className="h-4 w-4 text-destructive" />,
          pill: "bg-destructive/10 text-destructive",
        };
      case "Deposit":
        return {
          label: "Deposit",
          icon: <ArrowDown className="h-4 w-4 text-blue-600" />,
          pill: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
        };
      case "Withdrawal":
        return {
          label: "Withdrawal",
          icon: <ArrowUp className="h-4 w-4 text-orange-600" />,
          pill: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
        };
      case "Dividend":
        return {
          label: "Dividend",
          icon: <ArrowDown className="h-4 w-4 text-purple-600" />,
          pill: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
        };
      default:
        return {
          label: t ?? "Investment",
          icon: <TrendingUp className="h-4 w-4 text-muted-foreground" />,
          pill: "bg-muted text-foreground",
        };
    }
  }, [investment?.investment_type]);

  useEffect(() => {
    if (!editRequested) return;
    if (isLoadingInvestment || isFetchingInvestment) return;

    if (investment) {
      onEditInvestment(investment);
    }
    onEditRequestHandled();
  }, [
    editRequested,
    investment,
    isFetchingInvestment,
    isLoadingInvestment,
    onEditInvestment,
    onEditRequestHandled,
  ]);

  if (isLoadingInvestment || isLoadingAssets) {
    return (
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border bg-card p-6 shadow-sm"
      >
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-40 rounded bg-muted" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-10 rounded bg-muted" />
            <div className="h-10 rounded bg-muted" />
            <div className="h-10 rounded bg-muted" />
            <div className="h-10 rounded bg-muted" />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="rounded-xl border bg-card p-6 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          Investment details
        </div>
        {asset?.symbol && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void navigate({
                to: "/investments/assets/$symbol",
                params: { symbol: asset.symbol },
              })
            }
          >
            View asset
          </Button>
        )}
      </div>

      {!investment ? (
        <div className="text-sm text-muted-foreground">
          Investment details not found for this transaction.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
                typeMeta.pill,
              )}
            >
              {typeMeta.icon}
              {typeMeta.label}
            </span>
            {asset && (
              <span className="text-sm text-muted-foreground">
                {asset.symbol} • {asset.name}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Quantity</div>
              <div className="font-medium">{investment.quantity.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Unit price</div>
              <div className="font-medium">
                {formatUnitPrice(investment.unit_price, displayCurrency)}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">From account</div>
              <div className="font-medium">{getAccountName(investment.from_account_id)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">To account</div>
              <div className="font-medium">{getAccountName(investment.to_account_id)}</div>
            </div>

            {investment.fee > 0 && (
              <div>
                <div className="text-sm text-muted-foreground">Fee</div>
                <div className="font-medium text-destructive">
                  {formatCurrency(investment.fee, displayCurrency)}
                </div>
              </div>
            )}
            {investment.tax > 0 && (
              <div>
                <div className="text-sm text-muted-foreground">Tax</div>
                <div className="font-medium text-destructive">
                  {formatCurrency(investment.tax, displayCurrency)}
                </div>
              </div>
            )}

            {realizedPL && (
              <div className="col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">Realized P/L</div>
                  <span className="text-xs text-muted-foreground">
                    {realizedPL.source === "manual" ? "Manual" : "Calculated"}
                  </span>
                </div>
                <div
                  className={cn(
                    "text-lg font-semibold",
                    realizedPL.value >= 0 ? "text-emerald-600" : "text-destructive",
                  )}
                >
                  {formatCurrency(realizedPL.value, displayCurrency)}
                </div>
              </div>
            )}

            <div className="col-span-2">
              <div className="text-sm text-muted-foreground">Total</div>
              <div className="text-lg font-semibold">{formatCurrency(total, displayCurrency)}</div>
            </div>
          </div>

          {otherRelatedTransactions.length > 0 && (
            <div className="pt-4 border-t space-y-2">
              <div className="text-sm text-muted-foreground">Related entries</div>
              <div className="space-y-2">
                {otherRelatedTransactions.map((relTx) => {
                  const isGainLoss = relTx.id === investment.pl_transaction_id;
                  const labelPrefix = isGainLoss
                    ? relTx.type === "income"
                      ? "Gain"
                      : "Loss"
                    : undefined;

                  const displayAmount =
                    relTx.type === "income"
                      ? Math.abs(relTx.amount)
                      : relTx.type === "expense"
                        ? -Math.abs(relTx.amount)
                        : relTx.amount;

                  return (
                    <div key={relTx.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{relTx.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {labelPrefix && `${labelPrefix} • `}
                          {formatCurrency(displayAmount, displayCurrency)}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void navigate({
                            to: "/transactions/$transactionId",
                            params: { transactionId: relTx.id.toString() },
                          })
                        }
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export function TransactionDetailPage() {
  const { transactionId } = transactionDetailRoute.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const { preferredCurrency } = usePreferredCurrency();
  const [editInvestmentRequested, setEditInvestmentRequested] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const { setEditTransaction, setDeleteTransaction } = useDialogStore();

  // Always fetch these base queries
  const { data: transactionsResponse, isLoading: isLoadingTransaction } = useTransactions({
    id: typeof transactionId === "string" ? parseInt(transactionId, 10) : Number(transactionId),
    per_page: 1,
  });

  const { data: accountsResponse, isLoading: isLoadingAccounts } = useAccounts({
    type: "checking,savings,investment,loan,income,expense",
    per_page: 1000,
  });

  const { data: refundItemsResponse, isLoading: isLoadingRefunds } = useRefundItems({
    per_page: 1000,
  });

  const { data: refundGroupsResponse } = useRefundGroups({
    per_page: 1000,
  });

  const transaction = transactionsResponse?.items[0];
  const accounts = useMemo(() => accountsResponse?.items ?? [], [accountsResponse]);
  const refundGroups = useMemo(() => refundGroupsResponse?.items ?? [], [refundGroupsResponse]);

  const investmentId = transaction?.investment_id ?? null;

  // Load consolidated investment detail using the shared investment_id
  const { data: investmentDetail } = useInvestmentDetail(investmentId ?? undefined);

  // Memoized values that depend on transaction
  const refundItems = useMemo(() => {
    if (!transaction || !refundItemsResponse?.items) return [];
    return refundItemsResponse.items.filter((item) =>
      transaction.type === "expense"
        ? item.expense_transaction_id === transaction.id
        : item.income_transaction_id === transaction.id,
    );
  }, [transaction, refundItemsResponse]);

  const linkedTransactionIds = useMemo(() => {
    if (!transaction) return [];
    return refundItems
      .map((item) =>
        transaction.type === "expense" ? item.income_transaction_id : item.expense_transaction_id,
      )
      .filter((id): id is number => !!id);
  }, [transaction, refundItems]);

  // Only fetch linked transactions if we have IDs
  const { data: linkedTransactionsResponse } = useTransactions(
    linkedTransactionIds.length > 0
      ? {
          id: linkedTransactionIds,
          per_page: linkedTransactionIds.length,
        }
      : undefined,
  );

  const linkedTransactions = useMemo(
    () => linkedTransactionsResponse?.items ?? [],
    [linkedTransactionsResponse],
  );

  const getAccountName = useCallback(
    (accountId?: number) => {
      if (!accountId) return "";
      const account = accounts.find((a) => a.id === accountId);
      return account ? account.name : "";
    },
    [accounts],
  );

  const getRefundGroupName = useCallback(
    (groupId?: number | null) => {
      if (!groupId) return null;
      const group = refundGroups.find((g) => g.id === groupId);
      return group?.name || null;
    },
    [refundGroups],
  );

  const getLinkedTransaction = useCallback(
    (transactionId: number) => {
      return linkedTransactions.find((t) => t.id === transactionId) || null;
    },
    [linkedTransactions],
  );

  if (isLoadingTransaction || isLoadingAccounts || isLoadingRefunds) {
    return (
      <PageContainer>
        <div className="max-w-3xl mx-auto space-y-6 p-4">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded-lg w-24" />
            <div className="h-32 bg-muted rounded-xl" />
            <div className="h-20 bg-muted rounded-lg" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!transaction) {
    return (
      <PageContainer>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <h2 className="text-2xl font-semibold mb-4">Transaction not found</h2>
          <Button onClick={() => router.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Transactions
          </Button>
        </motion.div>
      </PageContainer>
    );
  }

  const transactionColor =
    transaction.type === "expense"
      ? "text-destructive"
      : transaction.type === "income"
        ? "text-emerald-600"
        : "text-primary";

  const transactionBgColor =
    transaction.type === "expense"
      ? "bg-destructive/10"
      : transaction.type === "income"
        ? "bg-emerald-500/10"
        : "bg-primary/10";

  return (
    <PageContainer>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-3xl mx-auto p-4"
      >
        <nav className="sticky top-0 z-10 mb-6 -mx-4 px-4 pt-2">
          <div className="flex items-center justify-between gap-2 rounded-xl border bg-card/80 backdrop-blur-sm px-3 py-2 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              className="group"
              onClick={() => router.history.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back
            </Button>
            <div className="flex gap-2">
              {(transaction.type === "expense" || transaction.type === "income") &&
                transaction.refunded_amount < Math.abs(transaction.amount) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-amber-600 border-amber-600 hover:bg-amber-50"
                    onClick={() => void navigate({ to: "/refunds" })}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Add Refund
                  </Button>
                )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (transaction.investment_id != null) {
                    setEditInvestmentRequested(true);
                    return;
                  }
                  setEditTransaction(transaction);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteTransaction(transaction)}
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Transaction Header */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="rounded-xl border bg-card p-6 space-y-4"
          >
            <div className="flex flex-col items-center text-center">
              <span
                className={cn(
                  "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-3",
                  transactionBgColor,
                  transactionColor,
                )}
              >
                {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
              </span>
              <h1 className="text-xl font-medium mb-3 max-w-md">{transaction.description}</h1>
              {transaction.refunded_amount > 0 ? (
                <div className="flex flex-col items-center w-full max-w-sm">
                  <p className={cn("text-lg line-through text-muted-foreground")}>
                    {transaction.type === "transfer"
                      ? formatTxAmount(transaction, preferredCurrency)
                      : `${
                          transaction.type === "expense" ? "-" : "+"
                        }${formatTxAmount(transaction, preferredCurrency)}`}
                  </p>
                  <p className={cn("text-3xl font-semibold tracking-tight", transactionColor)}>
                    {transaction.type === "transfer"
                      ? formatCurrency(
                          Math.abs(transaction.amount - transaction.refunded_amount),
                          transaction.preferred_currency ?? preferredCurrency,
                        )
                      : `${transaction.type === "expense" ? "-" : "+"}${formatCurrency(
                          Math.abs(transaction.amount - transaction.refunded_amount),
                          transaction.preferred_currency ?? preferredCurrency,
                        )}`}
                  </p>

                  <div className="flex items-center text-amber-600 mt-1 text-sm gap-1">
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    <span>
                      {transaction.type === "expense" ? "Refunded: " : "Used in refunds: "}
                      {formatCurrency(
                        transaction.refunded_amount,
                        transaction.preferred_currency ?? preferredCurrency,
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      (
                      {Math.round(
                        (transaction.refunded_amount / Math.abs(transaction.amount)) * 100,
                      )}
                      %)
                    </span>
                  </div>

                  {transaction.type === "expense" && (
                    <div className="w-full mt-3">
                      <Progress
                        value={Math.round(
                          (transaction.refunded_amount / Math.abs(transaction.amount)) * 100,
                        )}
                        className="h-2"
                        indicatorClassName="bg-amber-500"
                      />
                      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                        <span>0%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className={cn("text-3xl font-semibold tracking-tight", transactionColor)}>
                  {transaction.type === "transfer"
                    ? formatTxAmount(transaction, preferredCurrency)
                    : `${
                        transaction.type === "expense" ? "-" : "+"
                      }${formatTxAmount(transaction, preferredCurrency)}`}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="text-sm">
                  {new Date(transaction.date).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="text-sm truncate">
                  {transaction.category}
                  {transaction.subcategory && ` • ${transaction.subcategory}`}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Account Information */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <CreditCard className="h-4 w-4" />
              Account Details
            </div>
            <div className="space-y-3">
              {transaction.type === "transfer" ? (
                <>
                  <div>
                    <div className="text-sm text-muted-foreground">From</div>
                    <div className="font-medium">{getAccountName(transaction.from_account_id)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">To</div>
                    <div className="font-medium">{getAccountName(transaction.to_account_id)}</div>
                  </div>
                </>
              ) : transaction.type === "expense" ? (
                <div>
                  <div className="text-sm text-muted-foreground">From</div>
                  <div className="font-medium">{getAccountName(transaction.from_account_id)}</div>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-muted-foreground">To</div>
                  <div className="font-medium">{getAccountName(transaction.to_account_id)}</div>
                </div>
              )}
            </div>
          </motion.div>

          {transaction.investment_id != null && (
            <InvestmentTransactionExtras
              transaction={transaction}
              preferredCurrency={preferredCurrency}
              getAccountName={getAccountName}
              editRequested={editInvestmentRequested}
              onEditRequestHandled={() => setEditInvestmentRequested(false)}
              onEditInvestment={(inv) => setEditingInvestment(inv)}
              investmentFromDetail={
                investmentDetail ? (investmentDetail.investment as Investment) : undefined
              }
              relatedTransactionsFromDetail={
                investmentDetail ? investmentDetail.transactions : undefined
              }
            />
          )}

          {/* Refunds Section - Investment-style card */}
          {(transaction.type === "expense" || (refundItems && refundItems.length > 0)) && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                delay: transaction.investment_id != null ? 0.3 : 0.2,
              }}
              className="rounded-xl border bg-card p-6 shadow-sm"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <RefreshCw className="h-4 w-4" />
                <span>Refund details</span>
              </div>

              {transaction.type === "expense" && refundItems.length > 0 && (
                <div className="mb-6">
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg mb-4">
                    <div className="space-y-1">
                      <span className="text-sm text-muted-foreground">Original Amount</span>
                      <p className="text-lg font-medium text-destructive">
                        {formatTxAmount(transaction, preferredCurrency)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm text-muted-foreground">Total Refunded</span>
                      <p className="text-lg font-medium text-emerald-600">
                        {formatCurrency(
                          refundItems.reduce((total, item) => total + item.amount, 0),
                          transaction.preferred_currency ?? preferredCurrency,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold inline-block text-emerald-600">
                          {Math.round(
                            (refundItems.reduce((total, item) => total + item.amount, 0) /
                              Math.abs(transaction.amount)) *
                              100,
                          )}
                          % Refunded
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold inline-block text-destructive">
                          {formatCurrency(
                            Math.abs(transaction.amount) -
                              refundItems.reduce((total, item) => total + item.amount, 0),
                            transaction.preferred_currency ?? preferredCurrency,
                          )}{" "}
                          remaining
                        </span>
                      </div>
                    </div>
                    <div className="overflow-hidden h-2 text-xs flex rounded bg-muted">
                      <div
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (refundItems.reduce((total, item) => total + item.amount, 0) /
                                Math.abs(transaction.amount)) *
                                100,
                            ),
                          )}%`,
                        }}
                        className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500"
                      ></div>
                    </div>
                  </div>
                </div>
              )}

              {refundItems && refundItems.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Refund allocations</h3>
                  <div className="space-y-3">
                    {refundItems.map((item) => {
                      const linkedTransaction = getLinkedTransaction(
                        transaction.type === "expense"
                          ? item.income_transaction_id
                          : item.expense_transaction_id,
                      );
                      const refundGroupName = getRefundGroupName(item.refund_group_id);

                      return (
                        <div
                          key={item.id}
                          className="p-4 rounded-lg bg-card border border-border/50 hover:border-border transition-colors space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="font-medium">
                                {linkedTransaction?.description || item.description}
                              </p>
                              <time className="text-xs text-muted-foreground flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(
                                  linkedTransaction?.date ??
                                    (item as unknown as { created_at?: string }).created_at ??
                                    "",
                                ).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </time>
                            </div>
                            <p
                              className={cn(
                                "font-medium text-lg",
                                transaction.type === "expense"
                                  ? "text-emerald-600"
                                  : "text-destructive",
                              )}
                            >
                              {transaction.type === "expense" ? "+" : "-"}
                              {formatCurrency(
                                Math.abs(item.amount),
                                transaction.preferred_currency ?? preferredCurrency,
                              )}
                            </p>
                          </div>

                          {refundGroupName && (
                            <div className="flex items-center text-xs text-muted-foreground">
                              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                {refundGroupName}
                              </span>
                            </div>
                          )}

                          {linkedTransaction && (
                            <div className="flex justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() =>
                                  void navigate({
                                    to: "/transactions/$transactionId",
                                    params: {
                                      transactionId: linkedTransaction.id.toString(),
                                    },
                                  })
                                }
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                View {transaction.type === "expense" ? "income" : "expense"}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">No refunds recorded</p>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {editingInvestment && (
          <AddInvestmentDialog
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                setEditingInvestment(null);
                setEditInvestmentRequested(false);
              }
            }}
            investment={editingInvestment}
          />
        )}

        <TransactionForm
          open={!!useDialogStore.getState().editTransaction}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              useDialogStore.getState().setEditTransaction(null);
            }
          }}
          transaction={useDialogStore.getState().editTransaction || undefined}
          redirectTo={`/transactions/${transactionId}`}
        />
        <DeleteTransactionDialog redirectTo="/transactions/all" />
      </motion.div>
    </PageContainer>
  );
}
