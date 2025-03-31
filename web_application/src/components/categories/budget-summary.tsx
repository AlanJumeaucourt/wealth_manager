"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useDateRange } from "@/contexts/date-range-context"
import { useCategories } from "@/hooks/use-categories"
import { formatCurrency } from "@/utils/format"
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"
import { useEffect, useState } from "react"

export function BudgetSummary() {
  const { stats, fetchData } = useCategories()
  const { dateRange } = useDateRange()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      try {
        setLoading(true)
        await fetchData(dateRange.startDate, dateRange.endDate)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [dateRange, fetchData])

  const StatCard = ({ title, value, subValue, percentage }: {
    title: string
    value: string
    subValue: string
    percentage: number
  }) => (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="flex items-center">
              <Skeleton className="h-8 w-24" />
              <div className="ml-2">
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center">
              <div className="text-2xl font-bold">{value}</div>
              <div className="ml-2 flex items-center text-sm text-muted-foreground">
                {subValue.startsWith('+') ? (
                  <TrendingUpIcon className="mr-1 h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDownIcon className="mr-1 h-4 w-4 text-red-500" />
                )}
                {subValue}
              </div>
            </div>
            <Progress value={percentage} className="h-2" />
            <div className="text-sm text-muted-foreground">
              {percentage}% {title.toLowerCase()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Monthly Budget"
        value={formatCurrency(stats.monthlyBudget)}
        subValue={`-${formatCurrency(stats.remaining)} (${stats.remainingPercentage}% remaining)`}
        percentage={stats.usedPercentage}
      />
      <StatCard
        title="Biggest Category"
        value={formatCurrency(stats.biggestCategory.amount)}
        subValue={`${stats.biggestCategory.difference >= 0 ? '+' : ''}${formatCurrency(stats.biggestCategory.difference)} vs last month`}
        percentage={stats.biggestCategory.percentage}
      />
      <StatCard
        title="Daily Average"
        value={formatCurrency(stats.dailyAverage.amount)}
        subValue={`${stats.dailyAverage.difference >= 0 ? '+' : ''}${formatCurrency(stats.dailyAverage.difference)} vs last month`}
        percentage={stats.dailyAverage.percentage}
      />
    </div>
  )
}
