import { useAllCategories } from "@/api/queries"
import { Card } from "@/components/ui/card"
import { format, parseISO } from "date-fns"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts"
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent"

interface CategoryData {
  count: number
  net_amount: number
  original_amount: number
  transactions: Array<{
    amount: number
    category: string
    date: string
    date_accountability: string
    description: string
    from_account_id: number
    id: number
    net_amount: number
    refunded_amount: number
    subcategory: string | null
    to_account_id: number
  }>
}

interface PeriodSummary {
  start_date: string
  end_date: string
  income: {
    by_category: Record<string, CategoryData>
    total: {
      net: number
      original: number
    }
  }
  expense: {
    by_category: Record<string, CategoryData>
    total: {
      net: number
      original: number
    }
  }
}

interface PeriodChartProps {
  data: {
    period: string
    summaries: PeriodSummary[]
  }
}

interface GrowthMetrics {
  value: number
  percentage: number
  trend: "up" | "down" | "neutral"
}

interface PeriodMetrics {
  income: {
    total: number
    average: number
    growth: GrowthMetrics
    medianPerPeriod: number
    maxValue: number
    minValue: number
  }
  expense: {
    total: number
    average: number
    growth: GrowthMetrics
    medianPerPeriod: number
    maxValue: number
    minValue: number
  }
  savings: {
    total: number
    average: number
    savingsRate: number
    bestPeriod: {
      date: string
      amount: number
    }
  }
}

interface ChartDataPoint {
  period: string
  income: number
  expense: number
  savings?: number
  savingsRate?: number
  averageIncome?: number
  averageExpense?: number
}

export function PeriodChart({ data }: PeriodChartProps) {
  const { data: allCategories } = useAllCategories()

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value)
  }

  const formatPeriodLabel = (dateStr: string) => {
    const date = parseISO(dateStr)

    switch (data.period) {
      case "week":
        return format(date, "'Week of' MMM d, yyyy")
      case "month":
        return format(date, "MMMM yyyy")
      case "quarter":
        const quarter = Math.floor(date.getMonth() / 3) + 1
        return `Q${quarter} ${format(date, "yyyy")}`
      case "year":
        return format(date, "yyyy")
      default:
        return format(date, "MMM d, yyyy")
    }
  }

  const CustomTooltip = ({
    payload,
    label,
    active,
  }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null

    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              Period
            </span>
            <span className="font-bold text-muted-foreground">
              {formatPeriodLabel(label)}
            </span>
          </div>
          {payload.map(entry => (
            <div key={entry.name} className="flex flex-col">
              <span className="text-[0.70rem] uppercase text-muted-foreground">
                {entry.name}
              </span>
              <span
                className={`font-bold ${
                  entry.name === "expense" ? "text-destructive" : "text-success"
                }`}
              >
                {formatCurrency(entry.value as number)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const ExpenseTooltip = ({
    payload,
    label,
    active,
  }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null

    const sortedPayload = [...payload].sort((a, b) => {
      const indexA = expenseCategories.indexOf(a.name as string)
      const indexB = expenseCategories.indexOf(b.name as string)
      return indexA - indexB
    })

    const total = sortedPayload.reduce(
      (sum, entry) => sum + (entry.value as number),
      0
    )

    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              Period
            </span>
            <span className="font-bold text-muted-foreground">
              {formatPeriodLabel(label)}
            </span>
          </div>
          <div className="h-px bg-border" />
          {sortedPayload.map(entry => (
            <div key={entry.name} className="flex justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-[0.70rem] uppercase text-muted-foreground">
                  {entry.name}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-bold" style={{ color: entry.color }}>
                  {formatCurrency(entry.value as number)}
                </span>
                <span className="text-[0.65rem] text-muted-foreground">
                  {Math.round(((entry.value as number) / total) * 100)}%
                </span>
              </div>
            </div>
          ))}
          <div className="h-px bg-border" />
          <div className="flex justify-between gap-4">
            <span className="text-[0.70rem] uppercase font-bold">Total</span>
            <span className="font-bold">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    )
  }

  const chartData: ChartDataPoint[] = data.summaries.map(summary => ({
    period: summary.start_date,
    income: summary.income.total.net,
    expense: Math.abs(summary.expense.total.net),
  }))

  const averageIncome =
    chartData.reduce((sum, item) => sum + item.income, 0) / chartData.length
  const averageExpense =
    chartData.reduce((sum, item) => sum + item.expense, 0) / chartData.length

  const chartDataWithMetrics: ChartDataPoint[] = chartData.map(item => ({
    ...item,
    averageIncome,
    averageExpense,
    savings: item.income - item.expense,
    savingsRate: ((item.income - item.expense) / item.income) * 100,
  }))

  // Calculate comprehensive metrics
  const calculateMetrics = (summaries: PeriodSummary[]): PeriodMetrics => {
    const sortedData = [...summaries].sort(
      (a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    )
    const currentPeriod = sortedData[sortedData.length - 1]
    const previousPeriod = sortedData[sortedData.length - 2]

    const calculateGrowth = (
      current: number,
      previous: number
    ): GrowthMetrics => ({
      value: current - previous,
      percentage: previous ? ((current - previous) / previous) * 100 : 0,
      trend:
        current > previous ? "up" : current < previous ? "down" : "neutral",
    })

    const calculateMedian = (values: number[]): number => {
      const sorted = [...values].sort((a, b) => a - b)
      const middle = Math.floor(sorted.length / 2)
      return sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2
    }

    const incomeValues = summaries.map(s => s.income.total.net)
    const expenseValues = summaries.map(s => Math.abs(s.expense.total.net))
    const savingsValues = summaries.map(
      s => s.income.total.net - s.expense.total.net
    )

    return {
      income: {
        total: incomeValues.reduce((sum, val) => sum + val, 0),
        average: averageIncome,
        growth: calculateGrowth(
          currentPeriod.income.total.net,
          previousPeriod.income.total.net
        ),
        medianPerPeriod: calculateMedian(incomeValues),
        maxValue: Math.max(...incomeValues),
        minValue: Math.min(...incomeValues),
      },
      expense: {
        total: expenseValues.reduce((sum, val) => sum + val, 0),
        average: averageExpense,
        growth: calculateGrowth(
          currentPeriod.expense.total.net,
          previousPeriod.expense.total.net
        ),
        medianPerPeriod: calculateMedian(expenseValues),
        maxValue: Math.max(...expenseValues),
        minValue: Math.min(...expenseValues),
      },
      savings: {
        total: savingsValues.reduce((sum, val) => sum + val, 0),
        average:
          savingsValues.reduce((sum, val) => sum + val, 0) /
          savingsValues.length,
        savingsRate:
          (savingsValues.reduce((sum, val) => sum + val, 0) /
            incomeValues.reduce((sum, val) => sum + val, 0)) *
          100,
        bestPeriod: sortedData.reduce(
          (best, current) => {
            const savings = current.income.total.net - current.expense.total.net
            return savings > best.amount
              ? { date: current.start_date, amount: savings }
              : best
          },
          { date: "", amount: -Infinity }
        ),
      },
    }
  }

  const metrics = calculateMetrics(data.summaries)

  // Calculate total amount for each category across all periods
  const categoryTotals = data.summaries.reduce(
    (totals, summary) => {
      Object.entries(summary.expense.by_category).forEach(
        ([category, data]) => {
          totals[category] = (totals[category] || 0) + Math.abs(data.net_amount)
        }
      )
      return totals
    },
    {} as Record<string, number>
  )

  // Sort categories by their total amount in descending order
  const expenseCategories = Object.entries(categoryTotals)
    .sort(([, amountA], [, amountB]) => amountB - amountA)
    .map(([category]) => category)

  const expenseChartData = data.summaries.map(summary => {
    const periodData: any = {
      period: summary.start_date,
    }

    expenseCategories.forEach(category => {
      const categoryData = summary.expense.by_category[category]
      periodData[category] = categoryData
        ? Math.abs(categoryData.net_amount)
        : 0
    })

    return periodData
  })

  const categoryColors =
    allCategories?.expense?.reduce(
      (acc: Record<string, string>, category: any) => {
        acc[category.name.fr] = category.color
        return acc
      },
      {}
    ) || {}

  return (
    <Card>
      <div className="p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="rounded-lg border bg-card p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Income Insights
            </h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-medium">
                  {formatCurrency(metrics.income.total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Average</span>
                <span className="font-medium">
                  {formatCurrency(metrics.income.average)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Growth</span>
                <span
                  className={`font-medium ${
                    metrics.income.growth.trend === "up"
                      ? "text-success"
                      : metrics.income.growth.trend === "down"
                        ? "text-destructive"
                        : ""
                  }`}
                >
                  {metrics.income.growth.percentage >= 0 ? "+" : ""}
                  {metrics.income.growth.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Range</span>
                <span className="text-sm">
                  <span className="text-success">
                    {formatCurrency(metrics.income.maxValue)}
                  </span>
                  {" - "}
                  <span className="text-destructive">
                    {formatCurrency(metrics.income.minValue)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Expense Insights
            </h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-medium">
                  {formatCurrency(metrics.expense.total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Average</span>
                <span className="font-medium">
                  {formatCurrency(metrics.expense.average)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Growth</span>
                <span
                  className={`font-medium ${
                    metrics.expense.growth.trend === "down"
                      ? "text-success"
                      : metrics.expense.growth.trend === "up"
                        ? "text-destructive"
                        : ""
                  }`}
                >
                  {metrics.expense.growth.percentage >= 0 ? "+" : ""}
                  {metrics.expense.growth.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Range</span>
                <span className="text-sm">
                  <span className="text-destructive">
                    {formatCurrency(metrics.expense.maxValue)}
                  </span>
                  {" - "}
                  <span className="text-success">
                    {formatCurrency(metrics.expense.minValue)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Savings Insights
            </h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Total Saved
                </span>
                <span className="font-medium">
                  {formatCurrency(metrics.savings.total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Average</span>
                <span className="font-medium">
                  {formatCurrency(metrics.savings.average)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Savings Rate
                </span>
                <span
                  className={`font-medium ${
                    metrics.savings.savingsRate >= 20
                      ? "text-success"
                      : metrics.savings.savingsRate >= 10
                        ? "text-warning"
                        : "text-destructive"
                  }`}
                >
                  {metrics.savings.savingsRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Best Period
                </span>
                <span className="font-medium text-success">
                  {formatCurrency(metrics.savings.bestPeriod.amount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8 h-[400px]">
          <ResponsiveContainer
            width="100%"
            height="100%"
            style={{ overflowY: "hidden" }}
          >
            <AreaChart
              data={chartDataWithMetrics}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--success))"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--success))"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--destructive))"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--destructive))"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={formatPeriodLabel}
              />
              <YAxis
                width={65}
                tickFormatter={formatCurrency}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <Tooltip content={CustomTooltip} />
              <Legend />
              <Area
                type="monotone"
                dataKey="income"
                stroke="hsl(var(--success))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorIncome)"
              />
              <Area
                type="monotone"
                dataKey="expense"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorExpense)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="savingsRate"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                name="Savings Rate"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={value => `${value.toFixed(0)}%`}
                width={40}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Expenses by Category</h3>
          <div className="h-[400px]">
            <ResponsiveContainer
              width="100%"
              height="100%"
              style={{ overflowY: "hidden" }}
            >
              <BarChart
                data={expenseChartData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="period"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={formatPeriodLabel}
                />
                <YAxis
                  width={65}
                  tickFormatter={formatCurrency}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <Tooltip content={ExpenseTooltip} />
                <Legend
                  iconType="square"
                  formatter={value => (
                    <span className="text-[0.70rem] uppercase">{value}</span>
                  )}
                />
                {expenseCategories.map(category => (
                  <Bar
                    key={category}
                    dataKey={category}
                    stackId="expenses"
                    fill={categoryColors[category] || "#808080"}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Card>
  )
}
