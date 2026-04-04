import { useAccounts, useBanks, useDeleteAccount } from "@/api/queries";
import { AccountForm } from "@/components/accounts/AccountForm";
import { AddBankDialog } from "@/components/accounts/AddBankDialog";
import { DeleteAccountDialog } from "@/components/accounts/DeleteAccountDialog";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS, type AccountType } from "@/constants";
import { useDebounce } from "@/hooks/use-debounce";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Account, Bank } from "@/types";
import { formatCurrency } from "@/utils/currency";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  LineChart,
  Link2,
  PiggyBank,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type FilterTab = "all" | "owned" | AccountType;

const TYPE_ORDER: AccountType[] = [
  "checking",
  "savings",
  "investment",
  "loan",
  "income",
  "expense",
];
const OWNED_TYPES: AccountType[] = ["checking", "savings", "investment", "loan"];

const TYPE_CONFIG: Record<
  AccountType,
  {
    icon: React.ReactNode;
    gradient: string;
    border: string;
    text: string;
    bg: string;
    badge: string;
  }
> = {
  checking: {
    icon: <CreditCard className="h-4 w-4" />,
    gradient: "from-blue-500/10 to-blue-600/5",
    border: "border-blue-200/60 dark:border-blue-800/40",
    text: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  savings: {
    icon: <PiggyBank className="h-4 w-4" />,
    gradient: "from-emerald-500/10 to-emerald-600/5",
    border: "border-emerald-200/60 dark:border-emerald-800/40",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  investment: {
    icon: <TrendingUp className="h-4 w-4" />,
    gradient: "from-violet-500/10 to-violet-600/5",
    border: "border-violet-200/60 dark:border-violet-800/40",
    text: "text-violet-700 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  },
  loan: {
    icon: <Landmark className="h-4 w-4" />,
    gradient: "from-rose-500/10 to-rose-600/5",
    border: "border-rose-200/60 dark:border-rose-800/40",
    text: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  },
  expense: {
    icon: <ArrowUpRight className="h-4 w-4" />,
    gradient: "from-orange-500/10 to-orange-600/5",
    border: "border-orange-200/60 dark:border-orange-800/40",
    text: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  },
  income: {
    icon: <ArrowDownRight className="h-4 w-4" />,
    gradient: "from-amber-500/10 to-amber-600/5",
    border: "border-amber-200/60 dark:border-amber-800/40",
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  asset: {
    icon: <Wallet className="h-4 w-4" />,
    gradient: "from-sky-500/10 to-sky-600/5",
    border: "border-sky-200/60 dark:border-sky-800/40",
    text: "text-sky-700 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-950/30",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  },
};

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "owned", label: "Net Worth" },
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "investment", label: "Investments" },
  { value: "loan", label: "Loans" },
  { value: "expense", label: "Expenses" },
  { value: "income", label: "Income" },
];

interface AccountsPageProps {
  defaultType?: FilterTab | "new" | "link";
}

export function AccountsPage({ defaultType = "all" }: AccountsPageProps) {
  const { preferredCurrency, updatePreferredCurrency, isUpdating } = usePreferredCurrency();
  const [activeTab, setActiveTab] = useState<FilterTab>(
    defaultType === "new" || defaultType === "link" ? "all" : (defaultType as FilterTab),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [isAddingAccount, setIsAddingAccount] = useState(defaultType === "new");
  const [isAddingBank, setIsAddingBank] = useState(defaultType === "link");
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false });
  const deleteMutation = useDeleteAccount();

  const { data: banksResponse } = useBanks({ per_page: 9999 });
  const bankMap = useMemo(() => {
    const map = new Map<number, Bank>();
    for (const bank of banksResponse?.items ?? []) {
      map.set(bank.id, bank);
    }
    return map;
  }, [banksResponse]);

  const OTHER_TYPES: AccountType[] = ["expense", "income"];

  const baseParams = {
    page: 1,
    per_page: 9999,
    sort_by: "name" as const,
    sort_order: "asc" as const,
    search: debouncedSearch,
  };

  const { data: ownedResponse, isLoading: isLoadingOwned } = useAccounts({
    ...baseParams,
    type: OWNED_TYPES,
  });

  const { data: otherResponse } = useAccounts({
    ...baseParams,
    type: OTHER_TYPES,
  });

  const isLoading = isLoadingOwned;
  const accounts = useMemo(() => {
    const owned = ownedResponse?.items ?? [];
    const other = otherResponse?.items ?? [];

    if (activeTab === "all") return [...owned, ...other];
    if (activeTab === "owned") return owned;

    const targetType = activeTab as AccountType;
    if (OWNED_TYPES.includes(targetType)) return owned.filter((a) => a.type === targetType);
    return other.filter((a) => a.type === targetType);
  }, [ownedResponse, otherResponse, activeTab]);

  useEffect(() => {
    if (
      (searchParams as Record<string, any>).openAddDialog === "true" ||
      (searchParams as Record<string, any>).openAddDialog === true
    ) {
      setIsAddingAccount(true);
    }
  }, [searchParams]);

  const bal = (a: Account) => a.balance_preferred ?? a.balance;

  const totals = useMemo(() => {
    let netWorth = 0;
    let netWorthWithMarket = 0;

    let checking = 0;
    let savings = 0;
    let investment = 0;
    let loan = 0;
    let expense = 0;
    let income = 0;

    let hasMarketValueInvestments = false;

    for (const a of accounts) {
      const baseBalance = bal(a);

      if (OWNED_TYPES.includes(a.type as AccountType)) {
        netWorth += baseBalance;
      }

      switch (a.type) {
        case "checking":
          checking += baseBalance;
          break;
        case "savings":
          savings += baseBalance;
          break;
        case "investment":
          investment += baseBalance;
          break;
        case "loan":
          loan += baseBalance;
          break;
        case "expense":
          expense += baseBalance;
          break;
        case "income":
          income += baseBalance;
          break;
      }

      if (a.type === "investment") {
        let marketValuePreferred = baseBalance;

        if (a.market_value != null) {
          hasMarketValueInvestments = true;

          if (a.balance_preferred != null && a.balance !== 0) {
            const conversionFactor = a.balance_preferred / a.balance;
            marketValuePreferred = a.market_value * conversionFactor;
          } else {
            marketValuePreferred = a.market_value;
          }
        }

        netWorthWithMarket += marketValuePreferred;
      } else if (OWNED_TYPES.includes(a.type as AccountType)) {
        netWorthWithMarket += baseBalance;
      }
    }

    return {
      netWorth,
      netWorthWithMarket,
      checking,
      savings,
      investment,
      loan,
      expense,
      income,
      hasMarketValueInvestments,
    };
  }, [accounts]);

  const groupedAccounts = useMemo(() => {
    const groups: Partial<Record<AccountType, Account[]>> = {};
    const typesToShow =
      activeTab === "all"
        ? TYPE_ORDER
        : activeTab === "owned"
          ? OWNED_TYPES
          : [activeTab as AccountType];

    for (const type of typesToShow) {
      const accs = accounts
        .filter((a) => a.type === type && (!hideEmpty || bal(a) !== 0))
        .sort((a, b) => Math.abs(bal(b)) - Math.abs(bal(a)));
      if (accs.length > 0) {
        groups[type] = accs;
      }
    }
    return groups;
  }, [accounts, activeTab, hideEmpty]);

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selectedAccounts.map((id) => deleteMutation.mutateAsync(id)));
      toast({
        title: "Accounts deleted",
        description: `${selectedAccounts.length} account(s) removed.`,
      });
      setSelectedAccounts([]);
      setShowBulkDeleteConfirm(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete some accounts.",
        variant: "destructive",
      });
    }
  };

  const totalAccountCount = accounts.length;

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading
                ? "Loading..."
                : `${totalAccountCount} account${totalAccountCount !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={preferredCurrency}
              onValueChange={(val) => {
                updatePreferredCurrency(val);
                toast({
                  title: "Currency updated",
                  description: `Amounts shown in ${val}.`,
                });
              }}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-20 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="RON">RON</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setIsAddingBank(true)}>
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              Link Bank
            </Button>
            <Button size="sm" onClick={() => setIsAddingAccount(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Account
            </Button>
          </div>
        </div>

        {/* Net Worth Hero */}
        {isLoading ? (
          <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-6">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-10 w-48" />
            <div className="flex gap-6 mt-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-16 mb-1" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border bg-gradient-to-br from-primary/5 via-background to-primary/10 p-6">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Wallet className="h-4 w-4" />
              Net Worth
            </p>
            <p
              className={cn(
                "text-4xl font-bold tracking-tight mt-1",
                totals.netWorth >= 0 ? "text-foreground" : "text-destructive",
              )}
            >
              {formatCurrency(totals.netWorth, preferredCurrency)}
            </p>
            {totals.hasMarketValueInvestments && (
              <p className="text-xs text-muted-foreground mt-1">
                Incl. market value: {formatCurrency(totals.netWorthWithMarket, preferredCurrency)}
              </p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
              {(
                [
                  {
                    key: "checking" as const,
                    label: "Checking",
                    icon: <CreditCard className="h-3 w-3" />,
                  },
                  {
                    key: "savings" as const,
                    label: "Savings",
                    icon: <PiggyBank className="h-3 w-3" />,
                  },
                  {
                    key: "investment" as const,
                    label: "Investments",
                    icon: <TrendingUp className="h-3 w-3" />,
                  },
                  {
                    key: "loan" as const,
                    label: "Loans",
                    icon: <Landmark className="h-3 w-3" />,
                  },
                ] as const
              ).map(({ key, label, icon }) => {
                const amount = totals[key];
                if (amount === 0 && accounts.filter((a) => a.type === key).length === 0)
                  return null;
                return (
                  <button
                    key={key}
                    className="text-left hover:opacity-80 transition-opacity"
                    onClick={() => setActiveTab(key)}
                  >
                    <p
                      className={cn(
                        "text-xs text-muted-foreground flex items-center gap-1",
                        TYPE_CONFIG[key].text,
                      )}
                    >
                      {icon} {label}
                    </p>
                    <p className="text-sm font-semibold">
                      {formatCurrency(amount, preferredCurrency)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Toolbar: Search + Tabs */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background border-border/50"
            />
          </div>
          {selectedAccounts.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteConfirm(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete ({selectedAccounts.length})
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 -mb-1 scrollbar-none">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors",
                activeTab === tab.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto">
            <Button
              variant={hideEmpty ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setHideEmpty((h) => !h)}
              title="Hide zero-balance accounts"
              className="gap-1.5 text-xs"
            >
              {hideEmpty ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              Hide empty
            </Button>
          </div>
        </div>

        {/* Account Groups */}
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2].map((g) => (
              <div key={g}>
                <Skeleton className="h-5 w-32 mb-3" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg border p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Skeleton className="h-9 w-9 rounded-lg" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-28 mb-1" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-6 w-24" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : Object.keys(groupedAccounts).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <LineChart className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">No accounts found</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              {debouncedSearch
                ? `No results for "${debouncedSearch}". Try a different search term.`
                : "Get started by adding your first account or linking your bank."}
            </p>
            {!debouncedSearch && (
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => setIsAddingAccount(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add Account
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsAddingBank(true)}>
                  <Link2 className="h-3.5 w-3.5 mr-1.5" />
                  Link Bank
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {(Object.entries(groupedAccounts) as [AccountType, Account[]][]).map(([type, accs]) => {
              const config = TYPE_CONFIG[type];
              const groupTotal = accs.reduce((s, a) => s + bal(a), 0);
              return (
                <section key={type}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex items-center justify-center h-6 w-6 rounded-md",
                          config.badge,
                        )}
                      >
                        {config.icon}
                      </span>
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        {ACCOUNT_TYPE_LABELS[type]}
                      </h2>
                      <span className="text-xs text-muted-foreground/60">{accs.length}</span>
                    </div>
                    <span className={cn("text-sm font-semibold", config.text)}>
                      {formatCurrency(groupTotal, preferredCurrency)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {accs.map((account) => {
                      const bank = bankMap.get(account.bank_id);
                      const isSelected = selectedAccounts.includes(account.id);
                      return (
                        <div
                          key={account.id}
                          className={cn(
                            "group relative rounded-lg border p-4 cursor-pointer transition-all duration-150",
                            "hover:shadow-md hover:-translate-y-0.5",
                            `bg-gradient-to-br ${config.gradient}`,
                            config.border,
                            isSelected && "ring-2 ring-primary",
                          )}
                          onClick={() =>
                            void navigate({
                              to: "/accounts/$accountId",
                              params: { accountId: account.id.toString() },
                            })
                          }
                        >
                          {/* Selection checkbox */}
                          <div
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAccounts((prev) =>
                                prev.includes(account.id)
                                  ? prev.filter((id) => id !== account.id)
                                  : [...prev, account.id],
                              );
                            }}
                          >
                            <div
                              className={cn(
                                "h-5 w-5 rounded border-2 flex items-center justify-center transition-colors",
                                isSelected
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground/30 hover:border-muted-foreground/60",
                              )}
                            >
                              {isSelected && (
                                <svg
                                  className="h-3 w-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "flex items-center justify-center h-9 w-9 rounded-lg text-base shrink-0",
                                config.bg,
                              )}
                            >
                              {ACCOUNT_TYPE_ICONS[type]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate pr-6">{account.name}</p>
                              {bank && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Building2 className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{bank.name}</span>
                                </p>
                              )}
                              {account.currency && account.currency !== preferredCurrency && (
                                <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground mt-1">
                                  {account.currency}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 flex items-end justify-between">
                            <p className={cn("text-lg font-bold", config.text)}>
                              {formatCurrency(bal(account), preferredCurrency)}
                            </p>
                            {account.market_value != null && account.balance !== 0 && (
                              <div className="text-right">
                                <p
                                  className={cn(
                                    "text-xs font-medium",
                                    account.market_value >= account.balance
                                      ? "text-emerald-600"
                                      : "text-red-600",
                                  )}
                                >
                                  {account.market_value >= account.balance ? "+" : ""}
                                  {(
                                    ((account.market_value - account.balance) /
                                      Math.abs(account.balance)) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  MV{" "}
                                  {formatCurrency(
                                    account.market_value,
                                    account.currency ?? preferredCurrency,
                                  )}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {editingAccount && (
        <AccountForm
          account={editingAccount}
          open={true}
          onOpenChange={(open) => !open && setEditingAccount(null)}
        />
      )}

      <DeleteAccountDialog
        account={deletingAccount}
        open={!!deletingAccount}
        onOpenChange={(open) => !open && setDeletingAccount(null)}
        redirectTo="/accounts"
      />

      {isAddingAccount && (
        <AccountForm
          open={isAddingAccount}
          onOpenChange={(open) => !open && setIsAddingAccount(false)}
        />
      )}

      {isAddingBank && (
        <AddBankDialog
          open={isAddingBank}
          onOpenChange={(open) => !open && setIsAddingBank(false)}
        />
      )}

      {showBulkDeleteConfirm && (
        <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">
                Delete {selectedAccounts.length} Account
                {selectedAccounts.length > 1 ? "s" : ""}
              </DialogTitle>
              <DialogDescription className="space-y-3 pt-3">
                <p className="text-destructive font-medium">
                  This action cannot be undone. All transactions linked to these accounts will be
                  affected.
                </p>
                <div className="max-h-40 overflow-y-auto rounded-md border p-2">
                  <ul className="space-y-1">
                    {accounts
                      .filter((a) => selectedAccounts.includes(a.id))
                      .map((account) => (
                        <li key={account.id} className="flex items-center gap-2 text-sm py-1">
                          <span>{ACCOUNT_TYPE_ICONS[account.type as AccountType]}</span>
                          <span className="font-medium">{account.name}</span>
                          <span className="text-muted-foreground">
                            ({ACCOUNT_TYPE_LABELS[account.type as AccountType]})
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleBulkDelete}>
                Delete {selectedAccounts.length} Account
                {selectedAccounts.length > 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </PageContainer>
  );
}
