"use client"

import { useCategorySummary } from "@/api/queries"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useDateRange } from "@/contexts/date-range-context"
import { useCategories } from "@/hooks/use-categories"
import { formatCurrency } from "@/lib/utils"
import { formatDate } from "date-fns"
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react"

export function MoneySummary() {
  const { dateRange } = useDateRange()
  const { type, stats } = useCategories()
  const startDate = formatDate(dateRange.startDate, "yyyy-MM-dd")
  const endDate = formatDate(dateRange.endDate, "yyyy-MM-dd")

  const { data: summaryData, isLoading } = useCategorySummary(
    startDate,
    endDate
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-8" />
      </div>
    )
  }

  if (!summaryData) {
    return null
  }

  // Calculate totals using the new API structure
  const totalIncome = Math.abs(summaryData.income.total.net)
  const totalExpenses = Math.abs(summaryData.expense.total.net)
  const remainingMoney = totalIncome - totalExpenses

  // Calculate savings rate only if there's income and we have savings
  let savingsText = ""
  if (totalIncome === 0) {
    savingsText = "(no income)"
  } else if (remainingMoney < 0) {
    const overspendRate = (
      (Math.abs(remainingMoney) / totalIncome) *
      100
    ).toFixed(1)
    savingsText = `(${overspendRate}% overspent)`
  } else {
    const savingsRate = ((remainingMoney / totalIncome) * 100).toFixed(1)
    savingsText = `(${savingsRate}% saved)`
  }

  // Format the budget progress - ensure we handle zero values safely
  const budgetProgressValue = stats.totalBudgeted > 0
    ? Math.min(100, Math.max(0, (stats.totalActual / stats.totalBudgeted) * 100) || 0)
    : 0

  // Generate budget segments for categories
  const budgetSegments = (type === 'expense') ? stats.expenseBudgetSegments || [] : stats.incomeBudgetSegments || []

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <ArrowUpIcon className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-muted-foreground">
              Total Income
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-green-500">
              {formatCurrency(totalIncome)}
            </span>
          </div>
        </Card>

        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <ArrowDownIcon className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-muted-foreground">
              Total Expenses
            </span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-destructive">
              {formatCurrency(totalExpenses)}
            </span>
          </div>
        </Card>

        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <ArrowRightIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              Remaining Money
            </span>
          </div>
          <div className="mt-2">
            <span
              className={`text-2xl font-bold ${
                remainingMoney >= 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {formatCurrency(remainingMoney)}
            </span>
            <span className="ml-2 text-sm text-muted-foreground">
              {savingsText}
            </span>
          </div>
        </Card>
      </div>

      {/* Global Budget Progress */}
      {stats.totalBudgeted > 0 && (
        <Card className="p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-medium">
              Budget: {formatCurrency(stats.totalBudgeted)}
              <span className="text-xs text-muted-foreground ml-2">
                {type === "expense" ? "Spent" : "Received"}: {formatCurrency(stats.totalActual)}
                ({Math.round(budgetProgressValue)}%)
              </span>
            </div>
          </div>
          <div className="relative h-5 overflow-hidden rounded-full">
            {/* Stacked horizontal bar chart */}
            <div className="absolute inset-0 w-full h-full bg-muted"></div>
            <div className="relative w-full h-full flex">
              {budgetSegments.map((segment, i) => (
                <div
                  key={i}
                  className="h-full"
                  style={{
                    width: `${segment.percentage}%`,
                    backgroundColor: segment.color,
                  }}
                  title={`${segment.name}: ${formatCurrency(segment.amount)} (${Math.round(segment.percentage)}%)`}
                >
                  {segment.percentage > 8 && (
                    <span className="text-xs text-white px-1 truncate h-full flex items-center">
                      {segment.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {budgetProgressValue > 100 && (
              <div
                className="absolute top-0 h-full border-l-2 border-white"
                style={{ left: '100%' }}
              />
            )}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">0%</span>
            <span className="text-xs text-muted-foreground">100%</span>
          </div>
        </Card>
      )}
    </div>
  )
}
