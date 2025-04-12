"use client"

import {
    useAccounts,
    useAllCategories,
    useBudgetComparison, useBudgets,
    useCategorySummary,
} from "@/api/queries"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useDateRange } from "@/contexts/date-range-context"
import { useCategories } from "@/hooks/use-categories"
import { formatCurrency } from "@/lib/utils"
import { CategoryMetadata } from "@/types/categories"
import { useNavigate } from "@tanstack/react-router"
import { formatDate } from "date-fns"
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, CheckIcon, PencilIcon, XIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { IoBuildOutline, IoCalendarOutline } from "react-icons/io5"

interface Transaction {
  id: number
  date: string
  date_accountability: string
  description: string
  amount: number
  from_account_id: number
  to_account_id: number
  type: "expense" | "income" | "transfer"
  category: string
  subcategory?: string
  refunded_amount: number
}

interface TransformedCategory {
  name: string
  color: string
  amount: number
  originalAmount: number
  count: number
  transactions: Transaction[]
}

interface TransactionDialogProps {
  category: TransformedCategory
  open: boolean
  onOpenChange: (open: boolean) => void
  type: "income" | "expense" | "transfer"
}

function TransactionDialog({
  category,
  open,
  onOpenChange,
  type,
}: TransactionDialogProps) {
  const [sortBy, setSortBy] = useState<"date" | "amount">("date")
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")
  const [selectedTransactionId, setSelectedTransactionId] = useState<
    number | null
  >(null)
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null)
  const [deletingTransaction, setDeletingTransaction] =
    useState<Transaction | null>(null)
  const navigate = useNavigate()

  const { data: accountsResponse } = useAccounts({
    per_page: 100,
  })

  const accounts = accountsResponse?.items || []

  const getAccountName = (accountId: number) => {
    const account = accounts.find(a => a.id === accountId)
    return account?.name || `Account #${accountId}`
  }

  const transactions = useMemo(() => {
    return [...category.transactions].sort((a, b) => {
      if (sortBy === "date") {
        return sortOrder === "desc"
          ? new Date(b.date).getTime() - new Date(a.date).getTime()
          : new Date(a.date).getTime() - new Date(b.date).getTime()
      }
      const aAmount = Math.abs(a.amount - (a.refunded_amount || 0))
      const bAmount = Math.abs(b.amount - (b.refunded_amount || 0))
      return sortOrder === "desc" ? bAmount - aAmount : aAmount - bAmount
    })
  }, [category.transactions, sortBy, sortOrder])

  const handleTransactionClick = (transaction: Transaction) => {
    navigate({
      to: "/transactions/$transactionId",
      params: { transactionId: transaction.id.toString() },
    })
  }

  const handleAccountClick = (e: React.MouseEvent, accountId: number) => {
    e.stopPropagation()
    navigate({
      to: "/accounts/$accountId",
      params: { accountId: accountId.toString() },
    })
  }

  const { netAmount, originalAmount } = useMemo(() => {
    return transactions.reduce(
      (acc, t) => ({
        netAmount:
          acc.netAmount + Math.abs(t.amount - (t.refunded_amount || 0)),
        originalAmount: acc.originalAmount + Math.abs(t.amount),
      }),
      { netAmount: 0, originalAmount: 0 }
    )
  }, [transactions])

  const averageAmount =
    transactions.length > 0 ? netAmount / transactions.length : 0
  const maxAmount =
    transactions.length > 0
      ? Math.max(
          ...transactions.map(t =>
            Math.abs(t.amount - (t.refunded_amount || 0))
          )
        )
      : 0
  const minAmount =
    transactions.length > 0
      ? Math.min(
          ...transactions.map(t =>
            Math.abs(t.amount - (t.refunded_amount || 0))
          )
        )
      : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="rounded-full p-2"
              style={{ backgroundColor: category.color }}
            />
            <span>{category.name}</span>
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <div className="flex justify-between items-center">
              <div>
                {originalAmount !== netAmount ? (
                  <>
                    <span className="line-through text-muted-foreground">
                      {formatCurrency(originalAmount)}
                    </span>
                    <span className="ml-2 font-medium">
                      {formatCurrency(netAmount)}
                    </span>
                  </>
                ) : (
                  <span className="font-medium">
                    {formatCurrency(netAmount)}
                  </span>
                )}
                <span className="ml-2 text-xs">
                  ({transactions.length} transactions)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={sortBy}
                  onValueChange={(value: "date" | "amount") => setSortBy(value)}
                >
                  <SelectTrigger className="h-8 w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="amount">Amount</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() =>
                    setSortOrder(order => (order === "asc" ? "desc" : "asc"))
                  }
                >
                  {sortOrder === "asc" ? (
                    <ArrowUpIcon className="h-4 w-4" />
                  ) : (
                    <ArrowDownIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="rounded-lg bg-muted p-2 text-center">
                <div className="text-xs text-muted-foreground">Average</div>
                <div className="font-medium">
                  {formatCurrency(averageAmount)}
                </div>
              </div>
              <div className="rounded-lg bg-muted p-2 text-center">
                <div className="text-xs text-muted-foreground">Highest</div>
                <div className="font-medium">{formatCurrency(maxAmount)}</div>
              </div>
              <div className="rounded-lg bg-muted p-2 text-center">
                <div className="text-xs text-muted-foreground">Lowest</div>
                <div className="font-medium">{formatCurrency(minAmount)}</div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-6">
          {Object.entries(
            transactions.reduce(
              (acc, transaction) => {
                const monthYear = new Date(transaction.date).toLocaleString(
                  "default",
                  { month: "long", year: "numeric" }
                )
                if (!acc[monthYear]) acc[monthYear] = []
                acc[monthYear].push(transaction)
                return acc
              },
              {} as Record<string, Transaction[]>
            )
          ).map(([monthYear, monthTransactions]) => (
            <div key={monthYear} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground sticky top-0 bg-background py-2">
                {monthYear}
              </h3>
              <div className="space-y-2">
                {monthTransactions.map(transaction => {
                  const netAmount =
                    transaction.amount - (transaction.refunded_amount || 0)
                  const hasRefund = transaction.refunded_amount > 0
                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors"
                      onClick={() => handleTransactionClick(transaction)}
                      onMouseEnter={() =>
                        setSelectedTransactionId(transaction.id)
                      }
                      onMouseLeave={() => setSelectedTransactionId(null)}
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">
                          {transaction.description}
                        </span>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <IoCalendarOutline className="h-3 w-3" />
                          <span>
                            {new Date(transaction.date).toLocaleDateString(
                              undefined,
                              {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              }
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <IoBuildOutline className="h-3 w-3" />
                          <button
                            className="hover:underline focus:underline"
                            onClick={e =>
                              handleAccountClick(e, transaction.from_account_id)
                            }
                          >
                            {getAccountName(transaction.from_account_id)}
                          </button>
                          {transaction.to_account_id && (
                            <>
                              <ArrowRightIcon className="h-3 w-3" />
                              <button
                                className="hover:underline focus:underline"
                                onClick={e =>
                                  handleAccountClick(
                                    e,
                                    transaction.to_account_id
                                  )
                                }
                              >
                                {getAccountName(transaction.to_account_id)}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {hasRefund ? (
                          <>
                            <span className="text-sm line-through text-muted-foreground">
                              {formatCurrency(
                                type === "expense"
                                  ? -transaction.amount
                                  : transaction.amount
                              )}
                            </span>
                            <span className="text-sm font-medium">
                              {formatCurrency(
                                type === "expense" ? -netAmount : netAmount
                              )}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm font-medium">
                            {formatCurrency(
                              type === "expense"
                                ? -transaction.amount
                                : transaction.amount
                            )}
                          </span>
                        )}
                        {Math.abs(netAmount) === maxAmount && (
                          <span className="text-xs text-muted-foreground">
                            Highest
                          </span>
                        )}
                        {Math.abs(netAmount) === minAmount && (
                          <span className="text-xs text-muted-foreground">
                            Lowest
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function CategoryList() {
  const { type, stats, setBudgetSegments } = useCategories()
  const { dateRange } = useDateRange()
  const startDate = formatDate(dateRange.startDate, "yyyy-MM-dd")
  const endDate = formatDate(dateRange.endDate, "yyyy-MM-dd")
  const [selectedCategory, setSelectedCategory] =
    useState<TransformedCategory | null>(null)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")

  const { data: allCategories, isLoading: loadingCategories } =
    useAllCategories()
  const { data: categorySummary, isLoading: loadingSummary } =
    useCategorySummary(startDate, endDate)

  // Fetch budget data
  const {
    data: budgets = [],
    isLoading: budgetsLoading,
    refetch: refetchBudgets
  } = useBudgets(currentYear, currentMonth)

  const {
    data: comparisons = [],
    isLoading: comparisonsLoading,
    refetch: refetchComparisons
  } = useBudgetComparison(currentYear, currentMonth)

  const { useUpdate, useCreate } = useBudgets()
  const updateBudgetMutation = useUpdate()
  const createBudgetMutation = useCreate()

  // Setup the current month/year based on the date range
  useEffect(() => {
    if (dateRange.startDate) {
      const date = new Date(dateRange.startDate)
      const year = date.getFullYear()
      const month = date.getMonth() + 1 // 0-indexed to 1-indexed

      setCurrentYear(year)
      setCurrentMonth(month)
    }
  }, [dateRange])

  const loading = loadingCategories || loadingSummary || budgetsLoading || comparisonsLoading

  // Get budget data for categories
  const budgetDataMap = useMemo(() => {
    const map = new Map<string, { budgeted: number, percentage: number, isOver: boolean }>();

    comparisons.forEach(item => {
      const shouldInclude = type === "expense"
        ? !item.category.startsWith('+')
        : item.category.startsWith('+');

      if (shouldInclude) {
        const categoryName = type === "expense"
          ? item.category
          : item.category.replace(/^\+/, '');

        map.set(categoryName, {
          budgeted: item.budgeted || 0,
          percentage: item.percentage || 0,
          isOver: item.difference < 0
        });
      }
    });

    return map;
  }, [comparisons, type]);

  const categoryData = useMemo(() => {
    if (!categorySummary || !allCategories) return []

    const categories =
      type === "expense" ? allCategories.expense : allCategories.income
    const summarySection =
      type === "expense" ? categorySummary.expense : categorySummary.income

    if (!categories || !summarySection?.by_category) return []

    return categories
      .map((category: CategoryMetadata) => {
        const categoryName = category.name.fr
        const data = summarySection.by_category[categoryName]
        if (!data) return null

        return {
          name: categoryName,
          color: category.color,
          amount: data.net_amount,
          originalAmount: data.original_amount,
          count: data.count,
          transactions: data.transactions || [],
        }
      })
      .filter(
        (cat): cat is TransformedCategory => cat !== null && cat.amount !== 0
      )
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  }, [categorySummary, allCategories, type])

  // Budget editing functions
  const startEditing = (category: string, amount: number) => {
    setEditingId(category);
    setEditValue(amount.toString());
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEditing = async (category: string) => {
    const numAmount = parseFloat(editValue);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Please enter a valid amount greater than zero");
      return;
    }

    try {
      // Find if a budget already exists for this category
      const categoryForBudget = type === "expense" ? category : `+${category}`;
      const existingBudget = budgets.find(budget =>
        budget.category === categoryForBudget &&
        budget.year === currentYear &&
        budget.month === currentMonth
      );

      if (existingBudget) {
        // Update existing budget
        await updateBudgetMutation.mutateAsync({
          id: existingBudget.id,
          data: { amount: numAmount }
        });
      } else {
        // Create new budget
        const nowIso = new Date().toISOString();
        await createBudgetMutation.mutateAsync({
          category: categoryForBudget,
          amount: numAmount,
          year: currentYear,
          month: currentMonth,
          created_at: nowIso,
          updated_at: nowIso
        });
      }

      // Refresh data
      refetchBudgets();
      refetchComparisons();
      setEditingId(null);
    } catch (error) {
      console.error("Failed to update budget:", error);
      alert("Failed to update budget");
    }
  };

  // Calculate budget segments for the horizontal bar - MOVED OUTSIDE CONDITIONAL
  useEffect(() => {
    // Skip if loading or no data
    if (loading || !categoryData.length) return;

    const totalBudget = type === "expense" ?
      stats.totalBudgeted : stats.totalBudgeted;

    // Skip if no budget data or total is zero
    if (totalBudget === 0) return;

    // Create segments for each category that has both budget and spending
    const segments: Array<{
      name: string;
      amount: number;
      percentage: number;
      color: string;
    }> = [];

    // Loop through category data and create segments
    categoryData.forEach(category => {
      const budgetData = budgetDataMap.get(category.name);

      // Only include categories with budget and actual spending
      if (budgetData && budgetData.budgeted > 0 && Math.abs(category.amount) > 0) {
        // Calculate what percentage of the total budget this category represents
        const percentage = (Math.abs(category.amount) / totalBudget) * 100;

        segments.push({
          name: category.name,
          amount: Math.abs(category.amount),
          percentage: percentage,
          color: category.color || "#888888" // Use category color or default
        });
      }
    });

    // Sort segments by percentage (largest first)
    segments.sort((a, b) => b.percentage - a.percentage);

    // Update the store with the segments
    setBudgetSegments(type, segments);
  }, [loading, categoryData, budgetDataMap, type, stats.totalBudgeted, setBudgetSegments]);

  const renderCategoryItem = (category: TransformedCategory) => {
    const budgetData = budgetDataMap.get(category.name);
    const hasBudget = budgetData && budgetData.budgeted > 0;
    const isEditing = editingId === category.name;

    // Find if there's an existing budget
    const categoryForBudget = type === "expense" ? category.name : `+${category.name}`;
    const budgetItem = budgets.find(budget =>
      budget.category === categoryForBudget &&
      budget.year === currentYear &&
      budget.month === currentMonth
    );

    return (
      <div
        key={category.name}
        className="flex flex-col p-3 hover:bg-muted/50 rounded-lg cursor-pointer"
      >
        <div
          className="flex items-center justify-between"
          onClick={() => setSelectedCategory(category)}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <span className="text-sm font-medium">{category.name}</span>
            <span className="text-xs text-muted-foreground">
              ({category.count})
            </span>
          </div>
          <div className="flex flex-col items-end">
            {category.originalAmount !== category.amount ? (
              <>
                <span className="text-sm line-through text-muted-foreground">
                  {formatCurrency(category.originalAmount)}
                </span>
                <span className="text-sm font-medium">
                  {formatCurrency(category.amount)}
                </span>
              </>
            ) : (
              <span className="text-sm font-medium">
                {formatCurrency(category.amount)}
              </span>
            )}
          </div>
        </div>

        {/* Budget section */}
        <div className="mt-2 flex items-center justify-between" onClick={e => e.stopPropagation()}>
          {isEditing ? (
            <div className="flex items-center space-x-2 w-full">
              <span className="text-xs text-muted-foreground">Budget:</span>
              <div className="relative flex-1 max-w-[120px]">
                <span className="absolute inset-y-0 left-2 flex items-center text-gray-500 text-xs">
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="pl-5 h-7 text-right text-xs"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => saveEditing(category.name)}
                >
                  <CheckIcon className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={cancelEditing}
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Budget:</span>
                <span className="text-xs font-medium">
                  {hasBudget
                    ? formatCurrency(budgetData.budgeted)
                    : "–"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => startEditing(
                    category.name,
                    hasBudget ? budgetData.budgeted : Math.abs(category.amount)
                  )}
                >
                  <PencilIcon className="h-3 w-3" />
                </Button>
              </div>

              {hasBudget && (
                <div className="flex items-center gap-1 ml-2">
                  <Progress
                    value={Math.min(100, budgetData.percentage)}
                    className="h-1.5 w-16"
                    indicatorClassName={budgetData.isOver ? "bg-red-500" : ""}
                  />
                  <span className={`text-xs ${budgetData.isOver ? "text-red-500" : "text-muted-foreground"}`}>
                    {Math.round(budgetData.percentage)}%
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    )
  }

  if (!categoryData.length) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        No data available
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {categoryData.map(renderCategoryItem)}
      {selectedCategory && (
        <TransactionDialog
          category={selectedCategory}
          open={!!selectedCategory}
          onOpenChange={open => !open && setSelectedCategory(null)}
          type={type}
        />
      )}
    </div>
  )
}
