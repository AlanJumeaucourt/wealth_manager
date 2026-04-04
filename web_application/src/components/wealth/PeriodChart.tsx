import { useAllCategories } from "@/api/queries";
import { Card } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

interface CategoryData {
  count: number;
  net_amount: number;
  original_amount: number;
  transactions: Array<{
    amount: number;
    category: string;
    date: string;
    date_accountability: string;
    description: string;
    from_account_id: number;
    id: number;
    net_amount: number;
    refunded_amount: number;
    subcategory: string | null;
    to_account_id: number;
  }>;
}

interface PeriodSummary {
  start_date: string;
  end_date: string;
  income: {
    by_category: Record<string, CategoryData>;
    total: {
      net: number;
      original: number;
    };
  };
  expense: {
    by_category: Record<string, CategoryData>;
    total: {
      net: number;
      original: number;
    };
  };
}

interface PeriodChartProps {
  data: {
    period: string;
    summaries: PeriodSummary[];
  };
  selectedRange?: { startDate: string; endDate: string } | null;
  onSelectedRangeChange?: (range: { startDate: string; endDate: string } | null) => void;
}

interface GrowthMetrics {
  value: number;
  percentage: number;
  trend: "up" | "down" | "neutral";
}

interface PeriodMetrics {
  income: {
    total: number;
    average: number;
    growth: GrowthMetrics;
    medianPerPeriod: number;
    maxValue: number;
    minValue: number;
  };
  expense: {
    total: number;
    average: number;
    growth: GrowthMetrics;
    medianPerPeriod: number;
    maxValue: number;
    minValue: number;
  };
  savings: {
    total: number;
    average: number;
    savingsRate: number;
    bestPeriod: {
      date: string;
      amount: number;
    };
  };
}

interface ChartDataPoint {
  period: string;
  income: number;
  expense: number;
  savings?: number;
  savingsRate?: number;
  averageIncome?: number;
  averageExpense?: number;
}

/** Normalize API date fields (string, Date, or ISO-like) to YYYY-MM-DD for lexicographic compare. */
function toDateKey(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && !Number.isNaN(value)) {
    return new Date(value).toISOString().slice(0, 10);
  }
  return "";
}

/** True when [periodStart, periodEnd] overlaps [rangeStart, rangeEnd] (YYYY-MM-DD strings). */
function periodOverlapsRange(
  summary: { start_date: unknown; end_date: unknown },
  range: { startDate: string; endDate: string },
): boolean {
  const p0 = toDateKey(summary.start_date);
  const p1 = toDateKey(summary.end_date);
  return p0 <= range.endDate && p1 >= range.startDate;
}

export function PeriodChart({
  data,
  selectedRange = null,
  onSelectedRangeChange,
}: PeriodChartProps) {
  const { data: allCategories } = useAllCategories();
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [selectionStartIndex, setSelectionStartIndex] = React.useState<number | null>(null);
  const [isDraggingSelection, setIsDraggingSelection] = React.useState(false);
  const isDraggingRef = React.useRef(false);
  const selectedChartRangeRef = React.useRef<{
    start: number;
    end: number;
    startPoint: ChartDataPoint;
    endPoint: ChartDataPoint;
  } | null>(null);
  const lastClickRef = React.useRef<{ time: number; index: number | null }>({
    time: 0,
    index: null,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  /** Recharts may pass string, Date, or number for the X tick — parseISO only accepts strings. */
  const formatPeriodLabel = (value: string | number | Date | undefined) => {
    if (value == null) return "";
    const date =
      value instanceof Date ? value : typeof value === "number" ? new Date(value) : parseISO(value);
    if (Number.isNaN(date.getTime())) return "";

    switch (data.period) {
      case "week":
        return format(date, "'Week of' MMM d, yyyy");
      case "month":
        return format(date, "MMMM yyyy");
      case "quarter": {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `Q${quarter} ${format(date, "yyyy")}`;
      }
      case "year":
        return format(date, "yyyy");
      default:
        return format(date, "MMM d, yyyy");
    }
  };

  const CustomTooltip = ({ payload, label, active }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">Period</span>
            <span className="font-bold text-muted-foreground">{formatPeriodLabel(label)}</span>
          </div>
          {payload.map((entry) => (
            <div key={entry.name} className="flex flex-col">
              <span className="text-[0.70rem] uppercase text-muted-foreground">{entry.name}</span>
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
    );
  };

  const ExpenseTooltip = ({ payload, label, active }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;

    const sortedPayload = [...payload].sort((a, b) => {
      const indexA = expenseCategories.indexOf(a.name as string);
      const indexB = expenseCategories.indexOf(b.name as string);
      return indexA - indexB;
    });

    const total = sortedPayload.reduce((sum, entry) => sum + (entry.value as number), 0);

    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">Period</span>
            <span className="font-bold text-muted-foreground">{formatPeriodLabel(label)}</span>
          </div>
          <div className="h-px bg-border" />
          {sortedPayload.map((entry) => (
            <div key={entry.name} className="flex justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                <span className="text-[0.70rem] uppercase text-muted-foreground">{entry.name}</span>
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
    );
  };

  const summariesInRange = selectedRange
    ? data.summaries.filter((summary) => periodOverlapsRange(summary, selectedRange))
    : data.summaries;
  const activeSummaries = summariesInRange.length > 0 ? summariesInRange : data.summaries;

  const chartData: ChartDataPoint[] = activeSummaries.map((summary) => ({
    period: summary.start_date,
    income: summary.income.total.net,
    expense: Math.abs(summary.expense.total.net),
  }));

  const averageIncome = chartData.reduce((sum, item) => sum + item.income, 0) / chartData.length;
  const averageExpense = chartData.reduce((sum, item) => sum + item.expense, 0) / chartData.length;

  const chartDataWithMetrics: ChartDataPoint[] = chartData.map((item) => ({
    ...item,
    averageIncome,
    averageExpense,
    savings: item.income - item.expense,
    savingsRate: ((item.income - item.expense) / item.income) * 100,
  }));

  // Calculate comprehensive metrics
  const calculateMetrics = (summaries: PeriodSummary[]): PeriodMetrics => {
    if (summaries.length === 0) {
      return {
        income: {
          total: 0,
          average: 0,
          growth: { value: 0, percentage: 0, trend: "neutral" },
          medianPerPeriod: 0,
          maxValue: 0,
          minValue: 0,
        },
        expense: {
          total: 0,
          average: 0,
          growth: { value: 0, percentage: 0, trend: "neutral" },
          medianPerPeriod: 0,
          maxValue: 0,
          minValue: 0,
        },
        savings: {
          total: 0,
          average: 0,
          savingsRate: 0,
          bestPeriod: { date: "", amount: 0 },
        },
      };
    }

    const sortedData = [...summaries].sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
    );
    const currentPeriod = sortedData[sortedData.length - 1];
    const previousPeriod = sortedData[sortedData.length - 2] ?? currentPeriod;

    const calculateGrowth = (current: number, previous: number): GrowthMetrics => ({
      value: current - previous,
      percentage: previous ? ((current - previous) / previous) * 100 : 0,
      trend: current > previous ? "up" : current < previous ? "down" : "neutral",
    });

    const calculateMedian = (values: number[]): number => {
      const sorted = [...values].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    };

    const incomeValues = summaries.map((s) => s.income.total.net);
    const expenseValues = summaries.map((s) => Math.abs(s.expense.total.net));
    const savingsValues = summaries.map((s) => s.income.total.net - s.expense.total.net);

    const savingsTotal = savingsValues.reduce((sum, val) => sum + val, 0);
    const incomeTotal = incomeValues.reduce((sum, val) => sum + val, 0);

    return {
      income: {
        total: incomeValues.reduce((sum, val) => sum + val, 0),
        average: averageIncome,
        growth: calculateGrowth(currentPeriod.income.total.net, previousPeriod.income.total.net),
        medianPerPeriod: calculateMedian(incomeValues),
        maxValue: Math.max(...incomeValues),
        minValue: Math.min(...incomeValues),
      },
      expense: {
        total: expenseValues.reduce((sum, val) => sum + val, 0),
        average: averageExpense,
        growth: calculateGrowth(currentPeriod.expense.total.net, previousPeriod.expense.total.net),
        medianPerPeriod: calculateMedian(expenseValues),
        maxValue: Math.max(...expenseValues),
        minValue: Math.min(...expenseValues),
      },
      savings: {
        total: savingsTotal,
        average: savingsTotal / savingsValues.length,
        savingsRate: incomeTotal !== 0 ? (savingsTotal / incomeTotal) * 100 : 0,
        bestPeriod: sortedData.reduce(
          (best, current) => {
            const savings = current.income.total.net - current.expense.total.net;
            return savings > best.amount ? { date: current.start_date, amount: savings } : best;
          },
          {
            date: sortedData[0].start_date,
            amount: sortedData[0].income.total.net - sortedData[0].expense.total.net,
          },
        ),
      },
    };
  };

  const metrics = calculateMetrics(activeSummaries);

  // Calculate total amount for each category across all periods
  const categoryTotals = activeSummaries.reduce(
    (totals, summary) => {
      Object.entries(summary.expense.by_category).forEach(([category, data]) => {
        totals[category] = (totals[category] || 0) + Math.abs(data.net_amount);
      });
      return totals;
    },
    {} as Record<string, number>,
  );

  // Sort categories by their total amount in descending order
  const expenseCategories = Object.entries(categoryTotals)
    .sort(([, amountA], [, amountB]) => amountB - amountA)
    .map(([category]) => category);

  const expenseChartData = activeSummaries.map((summary) => {
    const periodData: any = {
      period: summary.start_date,
    };

    expenseCategories.forEach((category) => {
      const categoryData = summary.expense.by_category[category];
      periodData[category] = categoryData ? Math.abs(categoryData.net_amount) : 0;
    });

    return periodData;
  });

  const categoryColors =
    allCategories?.expense?.reduce((acc: Record<string, string>, category: any) => {
      acc[category.name.fr] = category.color;
      return acc;
    }, {}) || {};

  const currentTooltipIndex =
    hoveredIndex ?? (chartDataWithMetrics.length ? chartDataWithMetrics.length - 1 : null);
  const selectedChartRange = React.useMemo(() => {
    if (selectionStartIndex === null || currentTooltipIndex === null) return null;
    const start = Math.min(selectionStartIndex, currentTooltipIndex);
    const end = Math.max(selectionStartIndex, currentTooltipIndex);
    const startPoint = chartDataWithMetrics[start];
    const endPoint = chartDataWithMetrics[end];
    if (!startPoint || !endPoint) return null;
    return {
      start,
      end,
      startPoint,
      endPoint,
    };
  }, [selectionStartIndex, currentTooltipIndex, chartDataWithMetrics]);

  selectedChartRangeRef.current = selectedChartRange;

  return (
    <Card>
      <div className="p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 mb-6 sm:mb-8 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Income Insights</h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-medium">{formatCurrency(metrics.income.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Average</span>
                <span className="font-medium">{formatCurrency(metrics.income.average)}</span>
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
                  <span className="text-success">{formatCurrency(metrics.income.maxValue)}</span>
                  {" - "}
                  <span className="text-destructive">
                    {formatCurrency(metrics.income.minValue)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Expense Insights</h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-medium">{formatCurrency(metrics.expense.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Average</span>
                <span className="font-medium">{formatCurrency(metrics.expense.average)}</span>
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
                  <span className="text-success">{formatCurrency(metrics.expense.minValue)}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Savings Insights</h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Saved</span>
                <span className="font-medium">{formatCurrency(metrics.savings.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Average</span>
                <span className="font-medium">{formatCurrency(metrics.savings.average)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Savings Rate</span>
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
                <span className="text-sm text-muted-foreground">Best Period</span>
                <span className="font-medium text-success">
                  {formatCurrency(metrics.savings.bestPeriod.amount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 h-[260px] sm:mb-8 sm:h-[360px] md:h-[400px] select-none">
          <ResponsiveContainer width="100%" height="100%" style={{ overflowY: "hidden" }}>
            <AreaChart
              data={chartDataWithMetrics}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
              onMouseDown={(state: any) => {
                if (typeof state?.activeTooltipIndex !== "number") return;
                const index = state.activeTooltipIndex;
                const now = Date.now();
                if (lastClickRef.current.index === index && now - lastClickRef.current.time < 280) {
                  onSelectedRangeChange?.(null);
                  setSelectionStartIndex(null);
                  setHoveredIndex(null);
                  setIsDraggingSelection(false);
                  isDraggingRef.current = false;
                  lastClickRef.current = { time: 0, index: null };
                  return;
                }
                lastClickRef.current = { time: now, index };
                isDraggingRef.current = true;
                setSelectionStartIndex(state.activeTooltipIndex);
                setHoveredIndex(state.activeTooltipIndex);
                setIsDraggingSelection(true);

                const bodyStyle = document.body.style;
                const previousUserSelect = bodyStyle.userSelect;
                const previousWebkitUserSelect = bodyStyle.getPropertyValue("-webkit-user-select");
                bodyStyle.userSelect = "none";
                bodyStyle.setProperty("-webkit-user-select", "none");

                const onWindowMouseUp = () => {
                  const range = selectedChartRangeRef.current;
                  if (isDraggingRef.current && range && range.start !== range.end) {
                    onSelectedRangeChange?.({
                      startDate: range.startPoint.period,
                      endDate: range.endPoint.period,
                    });
                  }
                  isDraggingRef.current = false;
                  setIsDraggingSelection(false);
                  setSelectionStartIndex(null);
                  setHoveredIndex(null);
                  bodyStyle.userSelect = previousUserSelect;
                  if (previousWebkitUserSelect) {
                    bodyStyle.setProperty("-webkit-user-select", previousWebkitUserSelect);
                  } else {
                    bodyStyle.removeProperty("-webkit-user-select");
                  }
                };
                window.addEventListener("mouseup", onWindowMouseUp, { once: true });
              }}
              onMouseMove={(state: any) => {
                if (typeof state?.activeTooltipIndex !== "number") return;
                setHoveredIndex(state.activeTooltipIndex);
              }}
              onMouseLeave={() => {
                setHoveredIndex(null);
              }}
            >
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
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
              {selectedChartRange && (
                <ReferenceArea
                  x1={chartDataWithMetrics[selectedChartRange.start]?.period}
                  x2={chartDataWithMetrics[selectedChartRange.end]?.period}
                  strokeOpacity={0}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.08}
                />
              )}
              <Area
                type="monotone"
                dataKey="income"
                stroke="hsl(var(--success))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorIncome)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="expense"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorExpense)"
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="savingsRate"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                name="Savings Rate"
                isAnimationActive={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => `${value.toFixed(0)}%`}
                width={40}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mb-6 text-xs text-muted-foreground">
          {isDraggingSelection
            ? "Comparing range... drag to another date for live delta."
            : selectedRange
              ? "Range applied to all charts. Drag again to refine, or double-click to reset."
              : "Click a point to anchor, then drag to compare and apply the same range to all charts."}
        </div>

        <div>
          <h3 className="text-base font-semibold mb-3 sm:text-lg sm:mb-4">Expenses by Category</h3>
          <div className="h-[260px] sm:h-[360px] md:h-[400px]">
            <ResponsiveContainer width="100%" height="100%" style={{ overflowY: "hidden" }}>
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
                  formatter={(value) => <span className="text-[0.70rem] uppercase">{value}</span>}
                />
                {expenseCategories.map((category) => (
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
  );
}
