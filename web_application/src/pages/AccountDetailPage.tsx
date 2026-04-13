import {
  useAccountBalanceHistory,
  useAccounts,
  useAllCategories,
  useBanks,
  usePortfolioSummary,
  useTransactions,
} from "@/api/queries";
import { AccountBalanceChart } from "@/components/accounts/AccountBalanceChart";
import { AccountForm } from "@/components/accounts/AccountForm";
import { DeleteAccountDialog } from "@/components/accounts/DeleteAccountDialog";
import { PageContainer } from "@/components/layout/PageContainer";
import { DeleteTransactionDialog } from "@/components/transactions/DeleteTransactionDialog";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS } from "@/constants";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { transactionsThroughTodayRange } from "@/utils/transactionsListDateBounds";
import { cn } from "@/lib/utils";
import { accountDetailRoute } from "@/Router";
import { useDialogStore } from "@/store/dialogStore";
import { Account, Bank, Transaction } from "@/types";
import { formatCurrency } from "@/utils/currency";
import { amountPreferredOrFallback } from "@/utils/transactionDisplay";
import { useNavigate, useRouter } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Building2,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const TYPE_COLORS: Record<string, { text: string; bg: string; badge: string }> = {
  checking: {
    text: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  savings: {
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  investment: {
    text: "text-violet-700 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  },
  loan: {
    text: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  },
  expense: {
    text: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  },
  income: {
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
};

export function AccountDetailPage() {
  const accountId = parseInt(accountDetailRoute.useParams().accountId);
  const navigate = useNavigate();
  const router = useRouter();
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const { setDeleteTransaction } = useDialogStore();
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const { preferredCurrency } = usePreferredCurrency();

  const { data: banksResponse } = useBanks();
  const { data: allCategories } = useAllCategories();

  const { data: transactionsResponse } = useTransactions({
    account_id: accountId,
    per_page: 5,
    sort_by: "date",
    sort_order: "desc",
    ...transactionsThroughTodayRange(),
  });
  const recentTransactions = useMemo(
    () => transactionsResponse?.items ?? [],
    [transactionsResponse],
  );

  const { data: accountsResponse, isLoading: isLoadingAccounts } = useAccounts({
    per_page: 6,
    id: [
      ...new Set(
        [accountId].concat(
          recentTransactions
            .map((t) => t.from_account_id)
            .concat(recentTransactions.map((t) => t.to_account_id)),
        ),
      ),
    ].filter((id) => id != null),
  });

  const { data: balanceHistory, isLoading: isLoadingBalanceHistory } =
    useAccountBalanceHistory(accountId);

  const account = accountsResponse?.items?.find((a: Account) => a.id === accountId);
  const isInvestment = account?.type === "investment";

  const { data: portfolioSummary, isLoading: isLoadingPortfolio } = usePortfolioSummary(
    isInvestment ? accountId : undefined,
  );

  const banks = banksResponse?.items || [];
  const bank = account ? banks.find((b: Bank) => b.id === account.bank_id) : null;

  const getAccountName = (id: number) => {
    return accountsResponse?.items?.find((a: Account) => a.id === id)?.name || "-";
  };

  const getLastUpdated = () => {
    if (!recentTransactions.length) return "Never";
    return new Date(recentTransactions[0].date).toLocaleDateString();
  };

  const getCategoryColor = (categoryName: string) => {
    if (!allCategories) return "hsl(var(--primary))";
    for (const type of ["income", "expense", "transfer"] as const) {
      const category = allCategories[type]?.find((cat) => cat.name.fr === categoryName);
      if (category) return category.color;
    }
    return "hsl(var(--primary))";
  };

  const investmentMetrics = useMemo(() => {
    if (!portfolioSummary || !isInvestment) return null;
    const pnl = (portfolioSummary.total_value ?? 0) - (portfolioSummary.net_investment ?? 0);
    const pnlPct = portfolioSummary.net_investment
      ? (pnl / portfolioSummary.net_investment) * 100
      : 0;
    return {
      marketValue: portfolioSummary.total_value ?? 0,
      netInvested: portfolioSummary.net_investment ?? 0,
      pnl,
      pnlPct,
      dividendYield: (portfolioSummary.dividend_metrics?.portfolio_yield ?? 0) * 100,
      monthlyIncome: portfolioSummary.dividend_metrics?.monthly_income_estimate ?? 0,
      assets: portfolioSummary.assets ?? [],
      numPositions: portfolioSummary.metrics?.number_of_positions ?? 0,
    };
  }, [portfolioSummary, isInvestment]);

  useEffect(() => {
    function handleKeyPress(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (!selectedTransactionId || isInput) return;

      const transaction = recentTransactions.find(
        (t: Transaction) => t.id === parseInt(selectedTransactionId),
      );
      if (!transaction) return;

      if (event.key === "e") {
        event.preventDefault();
        setEditingTransaction(transaction);
      } else if (event.key === "d") {
        event.preventDefault();
        setDeleteTransaction(transaction);
      } else if (event.key === "Enter") {
        event.preventDefault();
        void navigate({
          to: "/transactions/$transactionId",
          params: { transactionId: transaction.id },
        });
      }
    }

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [
    selectedTransactionId,
    recentTransactions,
    navigate,
    setDeleteTransaction,
    setEditingTransaction,
  ]);

  const isLoading = isLoadingAccounts || isLoadingBalanceHistory;
  const typeColors = TYPE_COLORS[account?.type ?? "checking"] ?? TYPE_COLORS.checking;
  const currency = account?.currency ?? preferredCurrency;

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9" />
            <div>
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32 mt-1" />
            </div>
          </div>
          <Card className="p-6">
            <Skeleton className="h-4 w-32 mb-3" />
            <Skeleton className="h-10 w-48 mb-6" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-28" />
                </div>
              ))}
            </div>
          </Card>
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  if (!account) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-4">Account not found</h2>
          <Button onClick={() => router.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </PageContainer>
    );
  }

  const bal = account.balance_preferred ?? account.balance;

  if (recentTransactions.length === 0 && balanceHistory && balanceHistory.length === 0) {
    return (
      <PageContainer key={accountId}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => router.history.back()}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-2xl shrink-0">
                {ACCOUNT_TYPE_ICONS[account.type as keyof typeof ACCOUNT_TYPE_ICONS]}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold truncate">{account.name}</h1>
                  <Badge variant="secondary" className={cn("shrink-0", typeColors.badge)}>
                    {ACCOUNT_TYPE_LABELS[account.type as keyof typeof ACCOUNT_TYPE_LABELS]}
                  </Badge>
                </div>
                {bank && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Building2 className="h-3 w-3" />
                    {bank.name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setIsEditingAccount(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setDeletingAccount(account)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            </div>
          </div>

          <div className="text-center py-12 border rounded-lg bg-card">
            <h2 className="text-xl font-semibold mb-3">Welcome to your new account!</h2>
            <p className="text-muted-foreground mb-6">
              It looks like there&apos;s no transaction or balance history yet.
            </p>
            <Button
              onClick={() =>
                void navigate({
                  to: "/transactions/all",
                  search: {
                    accountId: account.id.toString(),
                    openAddDialog: true,
                  },
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add your first transaction
            </Button>
          </div>
        </div>

        {isEditingAccount && (
          <AccountForm
            account={account}
            open={isEditingAccount}
            onOpenChange={(open) => !open && setIsEditingAccount(false)}
          />
        )}
        <DeleteAccountDialog
          account={deletingAccount}
          open={!!deletingAccount}
          onOpenChange={(open) => !open && setDeletingAccount(null)}
          redirectTo="/accounts"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer key={accountId}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.history.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-2xl shrink-0">
              {ACCOUNT_TYPE_ICONS[account.type as keyof typeof ACCOUNT_TYPE_ICONS]}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold truncate">{account.name}</h1>
                <Badge variant="secondary" className={cn("shrink-0", typeColors.badge)}>
                  {ACCOUNT_TYPE_LABELS[account.type as keyof typeof ACCOUNT_TYPE_LABELS]}
                </Badge>
                {account.currency && account.currency !== preferredCurrency && (
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {account.currency}
                  </Badge>
                )}
              </div>
              {bank && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3 w-3" />
                  <span className="truncate">{bank.name}</span>
                  {bank.website && (
                    <a
                      href={bank.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-primary hover:underline ml-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setIsEditingAccount(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setDeletingAccount(account)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Stats Card */}
        {isInvestment && investmentMetrics ? (
          <Card className="p-6 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-background border-violet-200/40 dark:border-violet-800/30">
            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Market Value
                </p>
                <p className="mt-1.5 text-3xl md:text-4xl font-semibold tracking-tight">
                  {formatCurrency(investmentMetrics.marketValue, currency)}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border/40">
                {/* Net Invested */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium uppercase tracking-wide">
                      Net Invested
                    </span>
                  </div>
                  <p className="text-lg font-semibold">
                    {formatCurrency(investmentMetrics.netInvested, currency)}
                  </p>
                </div>

                {/* Unrealized P/L */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {investmentMetrics.pnl >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    <span className="text-xs font-medium uppercase tracking-wide">
                      Unrealized P/L
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-lg font-semibold",
                      investmentMetrics.pnl >= 0 ? "text-emerald-600" : "text-red-500",
                    )}
                  >
                    {investmentMetrics.pnl >= 0 ? "+" : ""}
                    {formatCurrency(investmentMetrics.pnl, currency)}
                  </p>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      investmentMetrics.pnlPct >= 0 ? "text-emerald-600" : "text-red-500",
                    )}
                  >
                    {investmentMetrics.pnlPct >= 0 ? "+" : ""}
                    {investmentMetrics.pnlPct.toFixed(2)}%
                  </p>
                </div>

                {/* Dividend Yield */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowDown className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium uppercase tracking-wide">
                      Dividend Yield
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-blue-500">
                    {investmentMetrics.dividendYield.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(investmentMetrics.monthlyIncome, currency)} /mo est.
                  </p>
                </div>

                {/* Last Transaction */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="text-xs font-medium uppercase tracking-wide">
                      Last Activity
                    </span>
                  </div>
                  <p className="text-lg font-semibold">{getLastUpdated()}</p>
                  <p className="text-xs text-muted-foreground">
                    {investmentMetrics.numPositions} position
                    {investmentMetrics.numPositions !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Current Balance
                </p>
                <p
                  className={cn(
                    "mt-1.5 text-3xl md:text-4xl font-semibold tracking-tight",
                    bal < 0 ? "text-destructive" : "",
                  )}
                >
                  {formatCurrency(Math.abs(bal), preferredCurrency)}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-border/40">
                {account.type !== "expense" && account.type !== "income" && bank && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium uppercase tracking-wide">Bank</span>
                    </div>
                    <p className="text-sm font-semibold">{bank.name}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="text-xs font-medium uppercase tracking-wide">
                      Last Activity
                    </span>
                  </div>
                  <p className="text-sm font-semibold">{getLastUpdated()}</p>
                </div>

                {account.currency && account.currency !== preferredCurrency && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="text-xs font-medium uppercase tracking-wide">
                        Native Balance
                      </span>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatCurrency(account.balance, account.currency)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Holdings (investment only) */}
        {isInvestment && investmentMetrics && investmentMetrics.assets.length > 0 && (
          <Card className="overflow-hidden">
            <div className="p-6 pb-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Holdings</h2>
                <span className="text-xs text-muted-foreground">
                  {investmentMetrics.assets.length} asset
                  {investmentMetrics.assets.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Allocation bar */}
            <div className="px-6 pt-4">
              <TooltipProvider delayDuration={100}>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  {investmentMetrics.assets
                    .filter((a) => a.portfolio_percentage > 0)
                    .sort((a, b) => b.portfolio_percentage - a.portfolio_percentage)
                    .map((asset, i) => {
                      const colors = [
                        "#22c55e",
                        "#3b82f6",
                        "#f59e0b",
                        "#ef4444",
                        "#8b5cf6",
                        "#ec4899",
                      ];
                      return (
                        <Tooltip key={asset.symbol}>
                          <TooltipTrigger asChild>
                            <div
                              className="h-full transition-all hover:opacity-80 first:rounded-l-full last:rounded-r-full"
                              style={{
                                width: `${Math.max(asset.portfolio_percentage, 0.5)}%`,
                                backgroundColor: colors[i % colors.length],
                              }}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            <p className="font-medium">{asset.symbol}</p>
                            <p className="text-muted-foreground">
                              {asset.portfolio_percentage.toFixed(1)}% &middot;{" "}
                              {formatCurrency(asset.current_value, currency)}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                </div>
              </TooltipProvider>
            </div>

            {/* Holdings table */}
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Asset</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Cost Basis</TableHead>
                    <TableHead className="text-right pr-6">P/L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...investmentMetrics.assets]
                    .sort((a, b) => b.current_value - a.current_value)
                    .map((asset) => (
                      <TableRow
                        key={asset.symbol}
                        className="cursor-pointer"
                        onClick={() =>
                          void navigate({
                            to: "/investments/assets/$symbol",
                            params: { symbol: asset.symbol },
                          })
                        }
                      >
                        <TableCell className="pl-6">
                          <div>
                            <p className="font-medium text-sm">{asset.symbol}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {asset.name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {asset.shares.toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatCurrency(asset.current_price, currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-medium">
                          {formatCurrency(asset.current_value, currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                          {formatCurrency(asset.cost_basis, currency)}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex flex-col items-end">
                            <span
                              className={cn(
                                "text-sm font-medium tabular-nums",
                                asset.gain_loss >= 0 ? "text-emerald-600" : "text-red-500",
                              )}
                            >
                              {asset.gain_loss >= 0 ? "+" : ""}
                              {formatCurrency(asset.gain_loss, currency)}
                            </span>
                            <span
                              className={cn(
                                "text-xs tabular-nums",
                                asset.gain_loss_percentage >= 0
                                  ? "text-emerald-600"
                                  : "text-red-500",
                              )}
                            >
                              {asset.gain_loss_percentage >= 0 ? "+" : ""}
                              {asset.gain_loss_percentage.toFixed(2)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {isInvestment && isLoadingPortfolio && (
          <Card className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-[200px] w-full" />
          </Card>
        )}

        {/* Balance Chart */}
        <AccountBalanceChart currentBalance={account.balance} balanceHistory={balanceHistory} />

        {/* Recent Transactions */}
        <Card className="overflow-hidden">
          <div className="p-6 pb-0 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Transactions</h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => void navigate({ to: "/transactions/all", search: { accountId } })}
            >
              View all
              <ArrowUp className="h-3.5 w-3.5 ml-1 rotate-45" />
            </Button>
          </div>

          <div className="mt-2">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Date</TableHead>
                  {account.type === "expense" && <TableHead>From Account</TableHead>}
                  {account.type === "income" && <TableHead>To Account</TableHead>}
                  {["checking", "savings", "investment", "loan"].includes(account.type) && (
                    <TableHead>Related Account</TableHead>
                  )}
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right pr-6">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((transaction: Transaction) => (
                    <TableRow
                      key={transaction.id}
                      className={cn(
                        "cursor-pointer transition-colors",
                        selectedTransactionId === transaction.id.toString() && "bg-muted",
                        "hover:bg-muted/50",
                      )}
                      onMouseEnter={() => setSelectedTransactionId(transaction.id.toString())}
                      onMouseLeave={() => setSelectedTransactionId(null)}
                      onClick={() =>
                        void navigate({
                          to: "/transactions/$transactionId",
                          params: { transactionId: transaction.id.toString() },
                        })
                      }
                    >
                      <TableCell className="pl-6 text-sm">
                        {new Date(transaction.date).toLocaleDateString()}
                      </TableCell>

                      {account.type === "expense" && (
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto font-normal text-muted-foreground hover:text-primary text-sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void navigate({
                                to: "/accounts/$accountId",
                                params: {
                                  accountId: transaction.from_account_id.toString(),
                                },
                              });
                            }}
                          >
                            {getAccountName(transaction.from_account_id)}
                          </Button>
                        </TableCell>
                      )}

                      {account.type === "income" && (
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto font-normal text-muted-foreground hover:text-primary text-sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void navigate({
                                to: "/accounts/$accountId",
                                params: {
                                  accountId: transaction.to_account_id.toString(),
                                },
                              });
                            }}
                          >
                            {getAccountName(transaction.to_account_id)}
                          </Button>
                        </TableCell>
                      )}

                      {["checking", "savings", "investment", "loan"].includes(account.type) && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-xs",
                                transaction.from_account_id === accountId
                                  ? "text-destructive"
                                  : "text-success",
                              )}
                            >
                              {transaction.from_account_id === accountId ? "→ To" : "← From"}
                            </span>
                            <Button
                              variant="link"
                              className="p-0 h-auto font-normal text-muted-foreground hover:text-primary text-sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const relatedId =
                                  transaction.from_account_id === accountId
                                    ? transaction.to_account_id
                                    : transaction.from_account_id;
                                void navigate({
                                  to: "/accounts/$accountId",
                                  params: { accountId: relatedId.toString() },
                                });
                              }}
                            >
                              {transaction.from_account_id === accountId
                                ? getAccountName(transaction.to_account_id)
                                : getAccountName(transaction.from_account_id)}
                            </Button>
                          </div>
                        </TableCell>
                      )}

                      <TableCell className="text-sm">{transaction.description}</TableCell>
                      <TableCell>
                        <span
                          className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium cursor-pointer hover:opacity-80"
                          style={{
                            backgroundColor: `${getCategoryColor(transaction.category)}20`,
                            color: getCategoryColor(transaction.category),
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            void navigate({
                              to: "/transactions/all",
                              search: { category: transaction.category },
                            });
                          }}
                        >
                          {transaction.category}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right pr-6 tabular-nums font-medium text-sm",
                          transaction.amount < 0 ? "text-destructive" : "text-success",
                        )}
                      >
                        {formatCurrency(amountPreferredOrFallback(transaction), preferredCurrency)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No recent transactions
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Dialogs */}
        <TransactionForm
          open={!!editingTransaction}
          onOpenChange={(isOpen) => {
            if (!isOpen) setEditingTransaction(null);
          }}
          transaction={editingTransaction || undefined}
          redirectTo={`/accounts/${accountId}`}
        />

        <DeleteTransactionDialog redirectTo={`/accounts/${accountId}`} />

        {isEditingAccount && (
          <AccountForm
            account={account}
            open={isEditingAccount}
            onOpenChange={(open) => !open && setIsEditingAccount(false)}
          />
        )}

        <DeleteAccountDialog
          account={deletingAccount}
          open={!!deletingAccount}
          onOpenChange={(open) => !open && setDeletingAccount(null)}
          redirectTo="/accounts"
        />
      </div>
    </PageContainer>
  );
}
