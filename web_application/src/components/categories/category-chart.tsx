"use client"

import { useAllCategories, useCategorySummary } from "@/api/queries"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { useDateRange } from "@/contexts/date-range-context"
import { useCategories } from "@/hooks/use-categories"
import { formatCurrency } from "@/lib/utils"
import { formatDate } from "date-fns"
import { PiggyBank, Wallet } from "lucide-react"
import * as React from "react"
import { Label, Pie, PieChart, ResponsiveContainer } from "recharts"

interface Category {
  color: string;
  iconName: string;
  iconSet: string;
  name: {
    en: string;
    fr: string;
  };
}

interface ChartData {
  category: string;
  value: number;
  originalValue: number;
  fill: string;
}

export function CategoryChart() {
  const { type } = useCategories()
  const { dateRange } = useDateRange()
  const startDate = formatDate(dateRange.startDate, 'yyyy-MM-dd')
  const endDate = formatDate(dateRange.endDate, 'yyyy-MM-dd')

  const { data: allCategories, isLoading: isLoadingCategories, error: categoriesError } = useAllCategories()
  const { data: summaryData, isLoading: isLoadingSummary, error: summaryError } = useCategorySummary(startDate, endDate)

  const isLoading = isLoadingCategories || isLoadingSummary
  const error = categoriesError || summaryError

  // Transform data when dependencies change
  const { chartData, totalAmount } = React.useMemo(() => {
    if (!allCategories || !summaryData) {
      return { chartData: [], totalAmount: 0 }
    }

    const categoryMapFr: Record<string, Category> = {};
    const categories = allCategories[type] as unknown as Category[];
    categories.forEach((category: Category) => {
      categoryMapFr[category.name.fr] = category;
    });

    // Transform and sort the data by amount
    const transformedData = Object.entries(summaryData[type].by_category)
      .map(([name, details]) => {
        const categoryInfo = categoryMapFr[name] || {
          color: "#808080",
          name: { en: name, fr: name }
        };

        return {
          category: categoryInfo.name.fr,
          value: Math.abs(details.net_amount),
          originalValue: Math.abs(details.original_amount),
          fill: categoryInfo.color,
        }
      })
      .filter(item => item.value > 0) // Only show categories with spending
      .sort((a, b) => b.value - a.value) // Sort by value in descending order

    const total = transformedData.reduce((acc, curr) => acc + curr.value, 0)

    return { chartData: transformedData, totalAmount: total }
  }, [allCategories, summaryData, type])

  if (error) {
    return <div className="text-red-500">Failed to load category data</div>
  }

  const chartConfig = {
    value: {
      label: type === "expense" ? "Total Spending" : "Total Income",
    },
    ...Object.fromEntries(
      chartData.map((item) => [
        item.category,
        {
          label: item.category,
          color: item.fill,
        },
      ])
    ),
  }

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      {type === "expense" ? (
        <>
          <PiggyBank className="h-16 w-16 mb-4" />
          <p className="text-lg font-medium mb-2">No expenses yet!</p>
          <p className="text-sm text-center">
            Looks like you're either really good at saving<br />
            or haven't tracked any expenses yet.
          </p>
        </>
      ) : (
        <>
          <Wallet className="h-16 w-16 mb-4" />
          <p className="text-lg font-medium mb-2">No income recorded</p>
          <p className="text-sm text-center">
            Time to make it rain! 💸<br />
            Start tracking your income to see insights.
          </p>
        </>
      )}
    </div>
  )

  return (
    <div className="h-[300px]">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <Skeleton className="h-[200px] w-[200px] rounded-full" />
          <Skeleton className="h-4 w-32" />
          <div className="flex flex-wrap gap-2 justify-center">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Skeleton className="h-2.5 w-2.5 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : chartData.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%" style={{ overflowY: "hidden" }}>
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                  tooltip={({ datum }) => (
                    <div className="bg-background border rounded-lg shadow-lg p-2">
                      <strong>{datum.label}</strong>
                      <div>
                        {datum.originalValue !== datum.value ? (
                          <>
                            <span className="line-through text-muted-foreground">
                              {formatCurrency(datum.originalValue)}
                            </span>
                            <span className="ml-2">
                              {formatCurrency(datum.value)}
                            </span>
                          </>
                        ) : (
                          formatCurrency(datum.value)
                        )}
                      </div>
                    </div>
                  )}
                />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="category"
                  innerRadius={60}
                  strokeWidth={4}
                >
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy}
                              className="fill-foreground text-xl font-bold"
                            >
                              {formatCurrency(totalAmount)}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 20}
                              className="fill-muted-foreground text-xs"
                            >
                              {type === "expense" ? "Total Spending" : "Total Income"}
                            </tspan>
                          </text>
                        )
                      }
                    }}
                  />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {chartData.map((item) => (
              <div key={item.category} className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.fill }}
                />
                <span className="text-xs text-muted-foreground">
                  {item.category}
                  <span className="ml-1 text-muted-foreground">
                    {formatCurrency(item.value)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
