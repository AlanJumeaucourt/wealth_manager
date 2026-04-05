import { useAccounts, useAllCategories, useTransactions } from "@/api/queries";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  BatchDeleteResponse,
  BatchDeleteTransactionsButton,
} from "@/components/transactions/BatchDeleteTransactionsButton";
import { DeleteTransactionDialog } from "@/components/transactions/DeleteTransactionDialog";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { useDialogStore } from "@/store/dialogStore";
import { Account, Transaction, TransactionField, TransactionType } from "@/types";
import { formatCurrency } from "@/utils/currency";
import { transactionsThroughTodayRange } from "@/utils/transactionsListDateBounds";
import {
  formatSignedTransactionAmountDisplay,
  formatTransactionAmountDisplay,
  netAmountAfterRefundsPreferred,
  refundedAmountPreferred,
  transactionOriginalCurrency,
} from "@/utils/transactionDisplay";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpDown,
  ArrowUpIcon,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
interface TransactionsPageProps {
  defaultType?: string;
}

type SortField = TransactionField;
type SortDirection = "asc" | "desc";

interface ActiveFilter {
  type: "type" | "category" | "account" | "date";
  value: string;
  label: string;
}

const skeletonCells = () => {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-4" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-24 rounded-md" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </TableCell>
    </TableRow>
  );
};

const getEmptyStateColspan = () => {
  return 6;
};

const getStatsText = (defaultType: string) => {
  switch (defaultType) {
    case "expense":
      return {
        title: "Total Spent",
        average: "Monthly Spending",
        count: "Total Expenses",
      };
    case "income":
      return {
        title: "Total Earned",
        average: "Monthly Income",
        count: "Income Entries",
      };
    case "transfer":
      return {
        title: "Total Transferred",
        average: "Monthly Transfers",
        count: "Transfer Count",
      };
    default:
      return {
        title: "Total Flow",
        average: "Monthly Average",
        count: "All Transactions",
      };
  }
};

// Mobile-friendly transaction card (replaces table row on small screens)
const MobileTransactionCard = memo(function MobileTransactionCard({
  transaction,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  getAccountName,
  getCategoryColor,
  navigate,
  search,
  preferredCurrency,
}: {
  transaction: Transaction;
  isSelected: boolean;
  onSelect: (id: number, checked: boolean) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  getAccountName: (id?: number) => string;
  getCategoryColor: (category: string) => string;
  navigate: any;
  search: Record<string, any>;
  preferredCurrency: string;
}) {
  const handleClick = useCallback(() => {
    void navigate({
      to: "/transactions/$transactionId",
      params: { transactionId: transaction.id },
    });
  }, [navigate, transaction.id]);

  const handleSelect = useCallback(
    (checked: boolean) => {
      onSelect(transaction.id, checked as boolean);
    },
    [onSelect, transaction.id],
  );

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit(transaction);
    },
    [onEdit, transaction],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(transaction);
    },
    [onDelete, transaction],
  );

  const amountClass =
    transaction.type === "expense"
      ? "text-red-600"
      : transaction.type === "income"
        ? "text-green-600"
        : "text-blue-600";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleClick();
      }}
      aria-label={`View details for ${transaction.description}`}
      className={`
        rounded-xl border border-border/50 bg-card p-4 shadow-sm
        transition-colors active:bg-muted/50
        ${isSelected ? "ring-2 ring-primary/50" : ""}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleSelect}
            aria-label={`Select ${transaction.description}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium truncate">{transaction.description}</span>
            <span className={`text-right font-semibold shrink-0 ${amountClass}`}>
              {transaction.type === "transfer"
                ? formatTransactionAmountDisplay(transaction, preferredCurrency)
                : transaction.refunded_amount > 0
                  ? `${transaction.type === "expense" ? "−" : "+"}${formatCurrency(
                      netAmountAfterRefundsPreferred(transaction),
                      preferredCurrency,
                    )}`
                  : formatSignedTransactionAmountDisplay(transaction, preferredCurrency)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{new Date(transaction.date).toLocaleDateString()}</span>
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: `${getCategoryColor(transaction.category)}25`,
                color: getCategoryColor(transaction.category),
              }}
              onClick={(e) => {
                e.stopPropagation();
                void navigate({
                  to: "/transactions/all",
                  search: { ...search, category: transaction.category },
                });
              }}
            >
              {transaction.category}
            </span>
          </div>
          {transaction.type === "transfer" && (
            <p className="mt-1 text-xs text-muted-foreground">
              {getAccountName(transaction.from_account_id)} →{" "}
              {getAccountName(transaction.to_account_id)}
            </p>
          )}
          {(transaction.type === "expense" || transaction.type === "income") && (
            <p className="mt-1 text-xs text-muted-foreground">
              {transaction.type === "expense" ? "From" : "To"}:{" "}
              {getAccountName(transaction.from_account_id)}
              {transaction.to_account_id && ` → ${getAccountName(transaction.to_account_id)}`}
            </p>
          )}
          {transaction.refunded_amount > 0 && (
            <div className="mt-1 flex items-center text-xs text-amber-600">
              <RotateCcw className="h-3 w-3 mr-1 shrink-0" />
              Refunded: {formatCurrency(refundedAmountPreferred(transaction), preferredCurrency)}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});

const TransactionRow = memo(function TransactionRow({
  transaction,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  getAccountName,
  getCategoryColor,
  navigate,
  search,
  preferredCurrency,
}: {
  transaction: Transaction;
  isSelected: boolean;
  onSelect: (id: number, checked: boolean) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  getAccountName: (id?: number) => string;
  getCategoryColor: (category: string) => string;
  navigate: any;
  search: Record<string, any>;
  preferredCurrency: string;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        void navigate({
          to: "/transactions/$transactionId",
          params: { transactionId: transaction.id },
        });
      }
    },
    [navigate, transaction.id],
  );

  const handleClick = useCallback(() => {
    void navigate({
      to: "/transactions/$transactionId",
      params: { transactionId: transaction.id },
    });
  }, [navigate, transaction.id]);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const handleSelect = useCallback(
    (checked: boolean) => {
      onSelect(transaction.id, checked as boolean);
    },
    [onSelect, transaction.id],
  );

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit(transaction);
    },
    [onEdit, transaction],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(transaction);
    },
    [onDelete, transaction],
  );

  return (
    <TableRow
      className={`
        hover:bg-muted/50
        transition-colors
        ${isHovered ? "bg-muted" : ""}
        ${isSelected ? "bg-muted/70" : ""}
        cursor-pointer
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`View details for ${transaction.description}`}
    >
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleSelect}
          aria-label={`Select transaction ${transaction.description}`}
          onClick={(e) => e.stopPropagation()}
        />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(transaction.date).toLocaleDateString()}
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {transaction.description}
          {transaction.refunded_amount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-flex items-center text-amber-600">
                    <RotateCcw className="h-4 w-4 mr-1" />
                    <span className="text-xs">
                      {formatCurrency(refundedAmountPreferred(transaction), preferredCurrency)}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">
                    {transaction.type === "expense"
                      ? `Refunded amount: ${formatCurrency(refundedAmountPreferred(transaction), preferredCurrency)}`
                      : `Used in refund(s): ${formatCurrency(refundedAmountPreferred(transaction), preferredCurrency)}`}
                  </p>
                  {transaction.refund_items && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {transaction.refund_items.length} refund allocation
                      {transaction.refund_items.length > 1 ? "s" : ""}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {transaction.refund_items && transaction.refund_items.length > 0 && (
          <div className="text-xs text-amber-600 font-normal flex items-center mt-0.5">
            <RotateCcw className="h-3 w-3 mr-1" />
            {transaction.refund_items.length} refund allocation
            {transaction.refund_items.length > 1 ? "s" : ""}
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          {transaction.type === "transfer" ? (
            <>
              From{" "}
              <Button
                variant="link"
                className="p-0 h-auto text-xs font-normal text-muted-foreground hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  void navigate({
                    to: "/accounts/$accountId",
                    params: { accountId: transaction.from_account_id },
                  });
                }}
              >
                {getAccountName(transaction.from_account_id)}
              </Button>
              {" → "}
              <Button
                variant="link"
                className="p-0 h-auto text-xs font-normal text-muted-foreground hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  void navigate({
                    to: "/accounts/$accountId",
                    params: { accountId: transaction.to_account_id },
                  });
                }}
              >
                {getAccountName(transaction.to_account_id)}
              </Button>
            </>
          ) : transaction.type === "expense" ? (
            <>
              Paid from{" "}
              <Button
                variant="link"
                className="p-0 h-auto text-xs font-normal text-muted-foreground hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  void navigate({
                    to: "/accounts/$accountId",
                    params: { accountId: transaction.from_account_id },
                  });
                }}
              >
                {getAccountName(transaction.from_account_id)}
              </Button>
              {" → "}
              <Button
                variant="link"
                className="p-0 h-auto text-xs font-normal text-muted-foreground hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  void navigate({
                    to: "/accounts/$accountId",
                    params: { accountId: transaction.to_account_id },
                  });
                }}
              >
                {getAccountName(transaction.to_account_id)}
              </Button>
            </>
          ) : (
            <>
              Received from{" "}
              <Button
                variant="link"
                className="p-0 h-auto text-xs font-normal text-muted-foreground hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  void navigate({
                    to: "/accounts/$accountId",
                    params: { accountId: transaction.from_account_id },
                  });
                }}
              >
                {getAccountName(transaction.from_account_id)}
              </Button>
              {" → "}
              <Button
                variant="link"
                className="p-0 h-auto text-xs font-normal text-muted-foreground hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  void navigate({
                    to: "/accounts/$accountId",
                    params: { accountId: transaction.to_account_id },
                  });
                }}
              >
                {getAccountName(transaction.to_account_id)}
              </Button>
            </>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span
          className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:opacity-80"
          style={{
            backgroundColor: `${getCategoryColor(transaction.category)}25`,
            color: `${getCategoryColor(transaction.category)}`,
            borderColor: `${getCategoryColor(transaction.category)}`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            void navigate({
              to: "/transactions/all",
              search: {
                ...search,
                category: transaction.category,
              },
            });
          }}
        >
          {transaction.category}
        </span>
      </TableCell>
      <TableCell
        className={`text-right ${
          transaction.type === "expense"
            ? "text-red-600"
            : transaction.type === "income"
              ? "text-green-600"
              : "text-blue-600"
        }`}
      >
        {transaction.type === "transfer" ? (
          formatTransactionAmountDisplay(transaction, preferredCurrency)
        ) : transaction.refunded_amount > 0 ? (
          <div className="flex flex-col items-end">
            <span className="line-through text-gray-500 text-sm">
              {transaction.type === "expense" ? "−" : "+"}
              {formatCurrency(
                Math.abs(transaction.amount),
                transactionOriginalCurrency(transaction),
              )}
            </span>
            <span>
              {transaction.type === "expense" ? "−" : "+"}
              {formatCurrency(netAmountAfterRefundsPreferred(transaction), preferredCurrency)}
            </span>
          </div>
        ) : (
          formatSignedTransactionAmountDisplay(transaction, preferredCurrency)
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

// Memoized Stats Component
const StatsSection = memo(function StatsSection({
  defaultType,
  totalItems,
  transactionsResponse,
  shouldShowSkeleton,
  preferredCurrency,
}: {
  defaultType: string;
  totalItems: number;
  transactionsResponse: any;
  shouldShowSkeleton: boolean;
  preferredCurrency: string;
}) {
  const statsText = getStatsText(defaultType);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {shouldShowSkeleton ? (
        Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="bg-card rounded-xl p-6 shadow-sm border border-border/50">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-32" />
            {index === 0 && <Skeleton className="h-4 w-16 mt-2" />}
          </div>
        ))
      ) : (
        <>
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50 transition-colors hover:bg-card/80">
            <p className="text-sm text-muted-foreground">{statsText.count}</p>
            <p className="text-2xl font-semibold mt-2">{totalItems}</p>
          </div>
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50 transition-colors hover:bg-card/80">
            <p className="text-sm text-muted-foreground">{statsText.average}</p>
            <p className="text-2xl font-semibold mt-2">
              {formatCurrency(
                Math.abs((transactionsResponse?.total_amount || 0) / 12),
                preferredCurrency,
              )}
            </p>
          </div>
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50 transition-colors hover:bg-card/80">
            <p className="text-sm text-muted-foreground">{statsText.title}</p>
            <p
              className={`text-2xl font-semibold mt-2 ${
                defaultType === "expense"
                  ? "text-destructive"
                  : defaultType === "income"
                    ? "text-green-600"
                    : ""
              }`}
            >
              {formatCurrency(Math.abs(transactionsResponse?.total_amount || 0), preferredCurrency)}
            </p>
          </div>
        </>
      )}
    </div>
  );
});

// Memoized Filters Component
const FiltersSection = memo(function FiltersSection({
  allCategories,
  accounts,
  activeFilters,
  handleTypeChange,
  handleCategoryChange,
  handleAccountChange,
  handleDateRangeChange,
  removeFilter,
  clearAllFilters,
  getCategoryColor,
  isLoading,
}: {
  allCategories: any;
  accounts: Account[];
  activeFilters: ActiveFilter[];
  handleTypeChange: (value: string) => void;
  handleCategoryChange: (value: string) => void;
  handleAccountChange: (value: string) => void;
  handleDateRangeChange: (value: string) => void;
  removeFilter: (filter: ActiveFilter) => void;
  clearAllFilters: () => void;
  getCategoryColor: (category: string) => string;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Type</label>
          <Select onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Date Range</label>
          <Select defaultValue="all" onValueChange={handleDateRangeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Category</label>
          <Select onValueChange={handleCategoryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {allCategories &&
                Object.entries(
                  allCategories as Record<string, Array<{ name: { fr: string } }>>,
                ).flatMap((entry) =>
                  entry[1].map((category: { name: { fr: string } }) => (
                    <SelectItem key={category.name.fr} value={category.name.fr}>
                      {category.name.fr}
                    </SelectItem>
                  )),
                )}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Account</label>
          <Select onValueChange={handleAccountChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id.toString()}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 flex-wrap">
            {activeFilters.map((filter) => (
              <span
                key={filter.type + filter.value}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary"
                style={
                  filter.type === "category"
                    ? {
                        backgroundColor: `${getCategoryColor(filter.value)}25`,
                        color: getCategoryColor(filter.value),
                      }
                    : undefined
                }
              >
                {filter.label}
                <button
                  className="ml-1 text-primary hover:text-primary/80"
                  onClick={() => removeFilter(filter)}
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            ))}
          </div>
          <button
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={clearAllFilters}
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
});

// Memoized Search Component
const SearchSection = memo(function SearchSection({
  searchTerm,
  setSearchTerm,
  isLoadingAccounts,
  setIsAddingTransaction,
  selectedTransactions,
  transactions,
  handleBatchDeleteSuccess,
  isLoading,
}: {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  isLoadingAccounts: boolean;
  setIsAddingTransaction: (value: boolean) => void;
  selectedTransactions: number[];
  transactions: Transaction[];
  handleBatchDeleteSuccess: (result: BatchDeleteResponse) => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
      <div className="relative w-full sm:w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search transactions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-background border-border/50"
        />
      </div>
      <div className="flex gap-2 w-full sm:w-auto">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-[140px]" />
            {selectedTransactions.length > 0 && <Skeleton className="h-10 w-[140px]" />}
          </>
        ) : (
          <>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setIsAddingTransaction(true)}
              disabled={isLoadingAccounts}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
            {selectedTransactions.length > 0 && (
              <BatchDeleteTransactionsButton
                selectedTransactions={transactions.filter((t) =>
                  selectedTransactions.includes(t.id),
                )}
                onSuccess={handleBatchDeleteSuccess}
                disabled={isLoading}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
});

export function TransactionsPage({ defaultType = "all" }: TransactionsPageProps) {
  const { toast } = useToast();
  const { preferredCurrency } = usePreferredCurrency();
  const navigate = useNavigate();
  const routerSearch = useSearch({ strict: false });

  // State for AddTransactionDialog
  const [addTransactionDialogOpen, setAddTransactionDialogOpen] = useState(false);
  const { editTransaction, setEditTransaction, setDeleteTransaction } = useDialogStore();

  // Handle search params safely with a type assertion approach
  const safeSearch = routerSearch as Record<string, any>;

  // Safely convert search parameters to arrays with proper type checks
  const accountFilters: string[] = useMemo(() => {
    if (!safeSearch.accountId) return [];
    if (Array.isArray(safeSearch.accountId)) {
      return safeSearch.accountId.map((id: any) => String(id));
    }
    return [String(safeSearch.accountId)];
  }, [safeSearch.accountId]);

  const categoryFilters: string[] = useMemo(() => {
    if (!safeSearch.category) return [];
    if (Array.isArray(safeSearch.category)) {
      return safeSearch.category.map((c: any) => String(c));
    }
    return [String(safeSearch.category)];
  }, [safeSearch.category]);

  const typeFilters: string[] = useMemo(() => {
    if (!safeSearch.type && defaultType === "all") return [];
    if (!safeSearch.type) return [defaultType];
    if (Array.isArray(safeSearch.type)) {
      return safeSearch.type.map((t: any) => String(t));
    }
    return [String(safeSearch.type)];
  }, [safeSearch.type, defaultType]);

  const dateRangeFilter = safeSearch.date_range ? String(safeSearch.date_range) : undefined;
  const sortFieldFilter = safeSearch.sort_field
    ? (String(safeSearch.sort_field) as TransactionField)
    : "date";
  const sortDirectionFilter = safeSearch.sort_direction
    ? (String(safeSearch.sort_direction) as SortDirection)
    : "desc";
  const pageFilter = safeSearch.page ? parseInt(String(safeSearch.page)) : 1;

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedTransactions, setSelectedTransactions] = useState<number[]>([]);
  const [isEnteringPage, setIsEnteringPage] = useState(false);
  const [manualPageInput, setManualPageInput] = useState("");
  const tableRef = useRef<HTMLTableElement>(null);
  const { data: allCategories } = useAllCategories();
  const itemsPerPage = 25;
  useEffect(() => {
    if (safeSearch.openAddDialog === "true" || safeSearch.openAddDialog === true) {
      setAddTransactionDialogOpen(true);
      // Optional: remove the query param to prevent re-opening on refresh if not desired
      // void navigate({ search: (prev) => ({ ...prev, openAddDialog: undefined }), replace: true });
    }
  }, [safeSearch, navigate]);

  // Update search params when filters change
  const updateSearchParams = (updates: Record<string, any>) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        ...updates,
      }),
    });
  };

  // Update filter handler methods to toggle selections
  const handleTypeChange = (value: string) => {
    let newTypes: string[] = [];

    // If already selected, remove it, otherwise add it
    if (typeFilters.includes(value)) {
      newTypes = typeFilters.filter((t) => t !== value);
    } else {
      newTypes = [...typeFilters, value];
    }

    updateSearchParams({
      type: newTypes.length === 0 ? undefined : newTypes,
      page: "1",
    });
  };

  const handleCategoryChange = (value: string) => {
    let newCategories: string[] = [];

    // If already selected, remove it, otherwise add it
    if (categoryFilters.includes(value)) {
      newCategories = categoryFilters.filter((c) => c !== value);
    } else {
      newCategories = [...categoryFilters, value];
    }

    updateSearchParams({
      category: newCategories.length === 0 ? undefined : newCategories,
      page: "1",
    });
  };

  const handleAccountChange = (value: string) => {
    let newAccounts: string[] = [];

    // If already selected, remove it, otherwise add it
    if (accountFilters.includes(value)) {
      newAccounts = accountFilters.filter((a) => a !== value);
    } else {
      newAccounts = [...accountFilters, value];
    }

    updateSearchParams({
      accountId: newAccounts.length === 0 ? undefined : newAccounts,
      page: "1",
    });
  };

  // Remove single item from filters
  const removeTypeFilter = (value: string) => {
    const newTypes = typeFilters.filter((t) => t !== value);
    updateSearchParams({
      type: newTypes.length === 0 ? undefined : newTypes,
      page: "1",
    });
  };

  const removeCategoryFilter = (value: string) => {
    const newCategories = categoryFilters.filter((c) => c !== value);
    updateSearchParams({
      category: newCategories.length === 0 ? undefined : newCategories,
      page: "1",
    });
  };

  const removeAccountFilter = (value: string) => {
    const newAccounts = accountFilters.filter((a) => a !== value);
    updateSearchParams({
      accountId: newAccounts.length === 0 ? undefined : newAccounts,
      page: "1",
    });
  };

  const handleDateRangeChange = (value: string) => {
    updateSearchParams({ date_range: value === "all" ? undefined : value });
  };

  const handleSort = (field: SortField) => {
    const newDirection =
      field === sortFieldFilter && sortDirectionFilter === "desc" ? "asc" : "desc";
    updateSearchParams({
      sort_field: field,
      sort_direction: newDirection,
      page: "1",
    });
  };

  const handlePageChange = (page: number) => {
    updateSearchParams({ page: page.toString() });
  };

  const clearAllFilters = () => {
    void navigate({
      search: {},
    });
    setSearchTerm("");
  };

  // Calculate date range based on filter
  const getDateRange = () => {
    if (!dateRangeFilter) {
      // No date range filter - use today as toDate and beginning of time as fromDate
      return transactionsThroughTodayRange();
    }

    const now = new Date();
    let fromDate = new Date();
    const toDate = new Date(); // Always today for filtered ranges

    switch (dateRangeFilter) {
      case "7d":
        fromDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        fromDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        fromDate.setDate(now.getDate() - 90);
        break;
      case "all":
        fromDate = new Date(0);
        break;
    }

    return {
      from_date: fromDate.toISOString().split("T")[0],
      to_date: toDate.toISOString().split("T")[0],
    };
  };

  const { from_date, to_date } = getDateRange();

  // Use isFetching instead of isPreviousData/isPlaceholderData
  const {
    data: transactionsResponse,
    isLoading,
    isFetching,
  } = useTransactions({
    type:
      typeFilters.length === 0
        ? undefined
        : typeFilters.length === 1
          ? (typeFilters[0] as TransactionType)
          : undefined,
    page: pageFilter,
    per_page: itemsPerPage,
    sort_by: sortFieldFilter,
    sort_order: sortDirectionFilter,
    search: debouncedSearchTerm || undefined,
    account_id: accountFilters.length > 0 ? parseInt(accountFilters[0]) : undefined, // API limitation: can only filter by one account for now
    category: categoryFilters.length > 0 ? categoryFilters[0] : undefined, // API limitation: can only filter by one category for now
    from_date,
    to_date,
  });

  useEffect(() => {
    void navigate({
      search: (prev) => {
        const currentPage = prev.page ? parseInt(String(prev.page), 10) : 1;
        if (currentPage === 1) return prev;
        return { ...prev, page: "1" };
      },
    });
  }, [debouncedSearchTerm, navigate]);

  const transactions: Transaction[] = useMemo(
    () => transactionsResponse?.items ?? [],
    [transactionsResponse],
  );
  const totalItems = transactionsResponse?.total || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Use isFetching instead of isPreviousData/isPlaceholderData
  const displayTransactions = isFetching ? transactions : isLoading ? [] : transactions;
  const shouldShowSkeleton = isLoading && !isFetching;

  const accountIds = useMemo(() => {
    const ids = new Set<number>();

    transactions.forEach((transaction) => {
      if (transaction.from_account_id) {
        ids.add(transaction.from_account_id);
      }
      if (transaction.to_account_id) {
        ids.add(transaction.to_account_id);
      }
    });

    accountFilters.forEach((accountFilter) => {
      const parsed = parseInt(accountFilter, 10);
      if (!Number.isNaN(parsed)) {
        ids.add(parsed);
      }
    });

    return Array.from(ids);
  }, [transactions, accountFilters]);

  const { data: accountsResponse, isLoading: isLoadingAccounts } = useAccounts(
    accountIds.length > 0
      ? {
          id: accountIds,
          sort_by: "name",
          sort_order: "asc",
        }
      : {
          sort_by: "name",
          sort_order: "asc",
        },
  );

  const accounts: Account[] = useMemo(() => accountsResponse?.items ?? [], [accountsResponse]);

  // Compute active filters based on URL params
  const activeFilters = useMemo(() => {
    const filters: ActiveFilter[] = [];

    // Add type filters
    typeFilters.forEach((typeFilter: string) => {
      if (typeFilter !== "all") {
        filters.push({
          type: "type",
          value: typeFilter,
          label: typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1),
        });
      }
    });

    // Add category filters
    categoryFilters.forEach((categoryFilter: string) => {
      filters.push({
        type: "category",
        value: categoryFilter,
        label: categoryFilter,
      });
    });

    // Add account filters
    accountFilters.forEach((accountFilter: string) => {
      const account = accounts.find((a) => a.id === parseInt(accountFilter));
      filters.push({
        type: "account",
        value: accountFilter,
        label: account?.name || accountFilter,
      });
    });

    // Add date range filter
    if (dateRangeFilter) {
      const dateLabels: Record<string, string> = {
        "7d": "Last 7 days",
        "30d": "Last 30 days",
        "90d": "Last 90 days",
      };
      filters.push({
        type: "date",
        value: dateRangeFilter,
        label: dateLabels[dateRangeFilter] || dateRangeFilter,
      });
    }

    return filters;
  }, [typeFilters, categoryFilters, accountFilters, dateRangeFilter, accounts]);

  const getAccountName = (accountId?: number): string => {
    if (!accountId) return "";
    const account = accounts.find((a) => a.id === accountId);
    return account ? account.name : "";
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTransactions(transactions.map((transaction) => transaction.id));
    } else {
      setSelectedTransactions([]);
    }
  };

  const handleSelectTransaction = (transactionId: number, checked: boolean) => {
    if (checked) {
      setSelectedTransactions((prev) => [...prev, transactionId]);
    } else {
      setSelectedTransactions((prev) => prev.filter((existingId) => existingId !== transactionId));
    }
  };

  const getCategoryColor = (categoryName: string): string => {
    if (!allCategories) return "hsl(var(--primary))";

    for (const type of ["income", "expense", "transfer"] as const) {
      const category = allCategories[type]?.find((cat) => cat.name.fr === categoryName);
      if (category && category.color) {
        return category.color;
      }
    }
    return "hsl(var(--primary))";
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortFieldFilter !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortDirectionFilter === "asc" ? (
      <ArrowUpIcon className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDownIcon className="ml-2 h-4 w-4" />
    );
  };

  useKeyboardShortcuts({
    onNew: () => {
      if (!addTransactionDialogOpen) {
        setAddTransactionDialogOpen(true);
      }
    },
    onEdit: () => {
      if (selectedTransactions.length === 1) {
        const transaction = transactions.find((t) => t.id === selectedTransactions[0]);
        if (transaction) {
          setEditTransaction(transaction);
        }
      }
    },
    onDelete: () => {
      if (selectedTransactions.length === 1) {
        const transaction = transactions.find((t) => t.id === selectedTransactions[0]);
        if (transaction) {
          setDeleteTransaction(transaction);
        }
      }
    },
    onHome: () => {
      if (tableRef.current) {
        tableRef.current.scrollTop = 0;
        handlePageChange(1);
      }
    },
    onEnd: () => {
      if (tableRef.current) {
        tableRef.current.scrollTop = tableRef.current.scrollHeight;
        handlePageChange(totalPages);
      }
    },
    onPrevPage: () => handlePageChange(Math.max(1, pageFilter - 1)),
    onNextPage: () => handlePageChange(Math.min(totalPages, pageFilter + 1)),
  });

  const handleBatchDeleteSuccess = (result: BatchDeleteResponse) => {
    if (result.total_successful > 0) {
      setSelectedTransactions([]);
      toast({
        title: "Transactions deleted",
        description: `Successfully deleted ${result.total_successful} transactions.`,
      });
    }
  };

  // Restore removeFilter function to work with activeFilters
  const removeFilter = (filter: ActiveFilter) => {
    switch (filter.type) {
      case "type":
        removeTypeFilter(filter.value);
        break;
      case "category":
        removeCategoryFilter(filter.value);
        break;
      case "account":
        removeAccountFilter(filter.value);
        break;
      case "date":
        updateSearchParams({ date_range: undefined });
        break;
    }
  };

  return (
    <PageContainer
      title={
        defaultType === "all"
          ? "All Transactions"
          : `${defaultType.charAt(0).toUpperCase() + defaultType.slice(1)} Transactions`
      }
    >
      <div className="space-y-6">
        <StatsSection
          defaultType={defaultType}
          totalItems={totalItems}
          transactionsResponse={transactionsResponse}
          shouldShowSkeleton={shouldShowSkeleton}
          preferredCurrency={preferredCurrency}
        />

        <FiltersSection
          allCategories={allCategories}
          accounts={accounts}
          activeFilters={activeFilters}
          handleTypeChange={handleTypeChange}
          handleCategoryChange={handleCategoryChange}
          handleAccountChange={handleAccountChange}
          handleDateRangeChange={handleDateRangeChange}
          removeFilter={removeFilter}
          clearAllFilters={clearAllFilters}
          getCategoryColor={getCategoryColor}
          isLoading={isLoading}
        />

        <SearchSection
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          isLoadingAccounts={isLoadingAccounts}
          setIsAddingTransaction={setAddTransactionDialogOpen}
          selectedTransactions={selectedTransactions}
          transactions={transactions}
          handleBatchDeleteSuccess={handleBatchDeleteSuccess}
          isLoading={isLoading}
        />

        {/* Desktop: table (hidden on mobile) */}
        <div
          ref={tableRef}
          className="hidden md:block bg-card rounded-xl shadow-sm border border-border/50 overflow-hidden"
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      selectedTransactions.length === transactions.length && transactions.length > 0
                    }
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead
                  className="w-[150px] cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort("date")}
                >
                  Date <SortIcon field="date" />
                </TableHead>
                <TableHead
                  className="w-[400px] cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort("description")}
                >
                  Description <SortIcon field="description" />
                </TableHead>
                <TableHead
                  className="w-[150px] cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort("category")}
                >
                  Category <SortIcon field="category" />
                </TableHead>
                <TableHead
                  className="text-right w-[150px] cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort("amount")}
                >
                  Amount <SortIcon field="amount" />
                </TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shouldShowSkeleton ? (
                Array.from({ length: 5 }).map(() => skeletonCells())
              ) : displayTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={getEmptyStateColspan()} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <p>No transactions found</p>
                      <Button
                        variant="link"
                        onClick={() => setAddTransactionDialogOpen(true)}
                        className="mt-2"
                      >
                        Add your first transaction
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displayTransactions.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    isSelected={selectedTransactions.includes(transaction.id)}
                    onSelect={handleSelectTransaction}
                    onEdit={setEditTransaction}
                    onDelete={setDeleteTransaction}
                    getAccountName={getAccountName}
                    getCategoryColor={getCategoryColor}
                    navigate={navigate}
                    search={safeSearch}
                    preferredCurrency={preferredCurrency}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile: card list (hidden on desktop) */}
        <div className="md:hidden space-y-3">
          {shouldShowSkeleton ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/4 mb-2" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))
          ) : displayTransactions.length === 0 ? (
            <div className="rounded-xl border border-border/50 bg-card p-8 text-center shadow-sm">
              <p className="text-muted-foreground">No transactions found</p>
              <Button
                variant="link"
                onClick={() => setAddTransactionDialogOpen(true)}
                className="mt-2"
              >
                Add your first transaction
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card px-4 py-2 shadow-sm">
                <Checkbox
                  checked={
                    selectedTransactions.length === transactions.length && transactions.length > 0
                  }
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
                <span className="text-sm text-muted-foreground">Select all</span>
              </div>
              {displayTransactions.map((transaction) => (
                <MobileTransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  isSelected={selectedTransactions.includes(transaction.id)}
                  onSelect={handleSelectTransaction}
                  onEdit={setEditTransaction}
                  onDelete={setDeleteTransaction}
                  getAccountName={getAccountName}
                  getCategoryColor={getCategoryColor}
                  navigate={navigate}
                  search={safeSearch}
                  preferredCurrency={preferredCurrency}
                />
              ))}
            </>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-muted-foreground order-2 sm:order-1">
              Showing {(pageFilter - 1) * itemsPerPage + 1} to{" "}
              {Math.min(pageFilter * itemsPerPage, totalItems)} of {totalItems} transactions
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => handlePageChange(1)}
                disabled={pageFilter === 1}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.max(1, pageFilter - 1))}
                disabled={pageFilter === 1}
              >
                Previous
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsEnteringPage(true)}>
                Page {pageFilter} of {totalPages}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.min(totalPages, pageFilter + 1))}
                disabled={pageFilter === totalPages}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => handlePageChange(totalPages)}
                disabled={pageFilter === totalPages}
              >
                Last
              </Button>
            </div>
          </div>
        )}

        <TransactionForm
          open={addTransactionDialogOpen}
          onOpenChange={setAddTransactionDialogOpen}
          defaultType={
            defaultType === "all" ? "expense" : (defaultType as "expense" | "income" | "transfer")
          }
        />

        <TransactionForm
          open={!!editTransaction}
          onOpenChange={(isOpen) => {
            if (!isOpen) setEditTransaction(null);
          }}
          transaction={editTransaction || undefined}
        />

        <DeleteTransactionDialog redirectTo="/transactions/all" />

        <Dialog open={isEnteringPage} onOpenChange={setIsEnteringPage}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Go to Page</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={manualPageInput}
                  onChange={(e) => setManualPageInput(e.target.value)}
                  placeholder={`Enter page (1-${totalPages})`}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEnteringPage(false);
                  setManualPageInput("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const pageNum = parseInt(manualPageInput);
                  if (pageNum >= 1 && pageNum <= totalPages) {
                    handlePageChange(pageNum);
                    setIsEnteringPage(false);
                    setManualPageInput("");
                  } else {
                    toast({
                      title: "Invalid page number",
                      description: `Please enter a number between 1 and ${totalPages}`,
                      variant: "destructive",
                    });
                  }
                }}
              >
                Go to Page
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
