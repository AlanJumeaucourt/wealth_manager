"use client"

import { useCategorySummary } from "@/api/queries"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useDateRange } from "@/contexts/date-range-context"
import { formatDate } from "date-fns"
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react"

export function MoneySummary() {
  const { dateRange } = useDateRange()
  const startDate = formatDate(dateRange.startDate, 'yyyy-MM-dd')
  const endDate = formatDate(dateRange.endDate, 'yyyy-MM-dd')

  const { data: summaryData, isLoading } = useCategorySummary(startDate, endDate)

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
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
    const overspendRate = ((Math.abs(remainingMoney) / totalIncome) * 100).toFixed(1)
    savingsText = `(${overspendRate}% overspent)`
  } else {
    const savingsRate = ((remainingMoney / totalIncome) * 100).toFixed(1)
    savingsText = `(${savingsRate}% saved)`
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card className="p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <ArrowUpIcon className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium text-muted-foreground">Total Income</span>
        </div>
        <div className="mt-2">
          <span className="text-2xl font-bold text-green-500">
            {new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: 'EUR'
            }).format(totalIncome)}
          </span>
        </div>
      </Card>

      <Card className="p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <ArrowDownIcon className="h-4 w-4 text-destructive" />
          <span className="text-sm font-medium text-muted-foreground">Total Expenses</span>
        </div>
        <div className="mt-2">
          <span className="text-2xl font-bold text-destructive">
            {new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: 'EUR'
            }).format(totalExpenses)}
          </span>
        </div>
      </Card>

      <Card className="p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <ArrowRightIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Remaining Money</span>
        </div>
        <div className="mt-2">
          <span className={`text-2xl font-bold ${remainingMoney >= 0 ? 'text-primary' : 'text-destructive'}`}>
            {new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: 'EUR'
            }).format(remainingMoney)}
          </span>
          <span className="ml-2 text-sm text-muted-foreground">
            {savingsText}
          </span>
        </div>
      </Card>
    </div>
  )
}
