"use client"

import {
  useAccounts,
  useAllCategories,
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
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react"
import { useMemo, useState } from "react"
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
  const { type } = useCategories()
  const { dateRange } = useDateRange()
  const startDate = formatDate(dateRange.startDate, "yyyy-MM-dd")
  const endDate = formatDate(dateRange.endDate, "yyyy-MM-dd")
  const [selectedCategory, setSelectedCategory] =
    useState<TransformedCategory | null>(null)

  const { data: allCategories, isLoading: loadingCategories } =
    useAllCategories()
  const { data: categorySummary, isLoading: loadingSummary } =
    useCategorySummary(startDate, endDate)

  const loading = loadingCategories || loadingSummary

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

  const renderCategoryItem = (category: TransformedCategory) => (
    <div
      key={category.name}
      className="flex items-center justify-between p-4 hover:bg-muted/50 rounded-lg cursor-pointer"
      onClick={() => setSelectedCategory(category)}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: category.color }}
        />
        <span className="text-sm font-medium">{category.name}</span>
        <span className="text-sm text-muted-foreground">
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
  )

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
    <div className="space-y-4">
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
