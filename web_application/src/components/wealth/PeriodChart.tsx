import { useAllCategories } from "@/api/queries";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { format, parseISO } from "date-fns";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoryData {
  preferred_currency?: string;
  count: number;
  net_amount: number;
  original_amount: number;
  by_currency?: Record<string, { net_amount: number; original_amount: number }>;
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
      preferred_currency?: string;
      net: number;
      original: number;
      by_currency?: Record<string, { net: number; original: number }>;
    };
  };
  expense: {
    by_category: Record<string, CategoryData>;
    total: {
      preferred_currency?: string;
      net: number;
      original: number;
      by_currency?: Record<string, { net: number; original: number }>;
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

interface CashFlowPoint {
  period: string;
  income: number;
  expense: number;
  savings: number;
  savingsRate: number;
  incomeByCurrency?: Record<string, { net: number; original: number }>;
  expenseByCurrency?: Record<string, { net: number; original: number }>;
}

interface CategoryChartPoint {
  period: string;
  totalExpense: number;
  expenseMovingAvg6: number | null;
  [category: string]: string | number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateKey(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && !Number.isNaN(value))
    return new Date(value).toISOString().slice(0, 10);
  return "";
}

function periodOverlapsRange(
  summary: { start_date: unknown; end_date: unknown },
  range: { startDate: string; endDate: string },
): boolean {
  const p0 = toDateKey(summary.start_date);
  const p1 = toDateKey(summary.end_date);
  return p0 <= range.endDate && p1 >= range.startDate;
}

function safeParse(value: string | number | Date | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  const d = parseISO(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Sparkline — tiny inline trend chart for metric cards
// ---------------------------------------------------------------------------

function Sparkline({ data, color, id }: { data: { v: number }[]; color: string; id: string }) {
  if (data.length < 2) return null;
  return (
    <div className="h-10 w-20 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            fill={`url(#spark-${id})`}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetricCard — single KPI tile with sparkline and trend badge
// ---------------------------------------------------------------------------

interface MetricCardProps {
  label: string;
  value: string;
  subLabel?: string;
  change?: { value: number; label: string };
  sparkData: { v: number }[];
  accentColor: string;
  sparkId: string;
}

function MetricCard({
  label,
  value,
  subLabel,
  change,
  sparkData,
  accentColor,
  sparkId,
}: MetricCardProps) {
  const TrendIcon = change
    ? change.value > 0
      ? ArrowUpRight
      : change.value < 0
        ? ArrowDownRight
        : Minus
    : null;
  const trendColor = change
    ? change.value > 0
      ? "text-green-500"
      : change.value < 0
        ? "text-red-500"
        : "text-muted-foreground"
    : "";

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: accentColor }} />
      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </div>
            <div className="text-lg sm:text-xl font-bold tabular-nums tracking-tight mt-0.5">
              {value}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {change && TrendIcon && (
                <>
                  <TrendIcon className={`h-3 w-3 shrink-0 ${trendColor}`} />
                  <span className={`text-[0.65rem] ${trendColor}`}>{change.label}</span>
                </>
              )}
              {subLabel && <span className="text-[0.65rem] text-muted-foreground">{subLabel}</span>}
            </div>
          </div>
          <Sparkline data={sparkData} color={accentColor} id={sparkId} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SavingsHealthStrip — period-level heatmap of savings rates
// ---------------------------------------------------------------------------

function SavingsHealthStrip({
  data,
  formatLabel,
}: {
  data: Array<{ period: string; income: number; expense: number }>;
  formatLabel: (v: string | number | Date | undefined) => string;
}) {
  if (data.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wider">
          Savings Pulse
        </span>
        <div className="flex items-center gap-3 text-[0.65rem] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> &gt;20%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-amber-400" /> 0–20%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-red-500" /> Deficit
          </span>
        </div>
      </div>
      <div className="flex gap-px rounded-lg overflow-hidden">
        {data.map((item, i) => {
          const rate =
            item.income > 0
              ? ((item.income - item.expense) / item.income) * 100
              : item.expense > 0
                ? -100
                : 0;
          const colorClass =
            rate >= 30
              ? "bg-emerald-500"
              : rate >= 20
                ? "bg-emerald-400"
                : rate >= 10
                  ? "bg-emerald-300/80"
                  : rate >= 0
                    ? "bg-amber-400"
                    : "bg-red-500";
          return (
            <div
              key={i}
              className={`h-2.5 flex-1 ${colorClass} transition-all hover:h-4 cursor-default first:rounded-l-sm last:rounded-r-sm`}
              title={`${formatLabel(item.period)}: ${rate.toFixed(1)}% savings rate`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PeriodChart — main export
// ---------------------------------------------------------------------------

export function PeriodChart({
  data,
  selectedRange = null,
  onSelectedRangeChange,
}: PeriodChartProps) {
  const { preferredCurrency } = usePreferredCurrency();
  const { data: allCategories } = useAllCategories();

  // Selection state
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [selectionStartIndex, setSelectionStartIndex] = React.useState<number | null>(null);
  const [isDraggingSelection, setIsDraggingSelection] = React.useState(false);
  const isDraggingRef = React.useRef(false);
  const selectedChartRangeRef = React.useRef<{
    start: number;
    end: number;
    startPoint: CashFlowPoint;
    endPoint: CashFlowPoint;
  } | null>(null);
  const lastClickRef = React.useRef<{ time: number; index: number | null }>({
    time: 0,
    index: null,
  });

  // ---- Formatters ----

  const fmtCurrency = React.useCallback(
    (value: number) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: preferredCurrency,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value),
    [preferredCurrency],
  );

  const fmtCurrencyIn = React.useCallback(
    (value: number, currency: string) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value),
    [],
  );

  const formatPeriodLabel = React.useCallback(
    (value: string | number | Date | undefined): string => {
      const date = safeParse(value);
      if (!date) return "";
      switch (data.period) {
        case "week":
          return format(date, "'Week of' MMM d, yyyy");
        case "month":
          return format(date, "MMMM yyyy");
        case "quarter":
          return `Q${Math.floor(date.getMonth() / 3) + 1} ${format(date, "yyyy")}`;
        case "year":
          return format(date, "yyyy");
        default:
          return format(date, "MMM d, yyyy");
      }
    },
    [data.period],
  );

  const formatAxisTick = React.useCallback(
    (value: string | number | Date | undefined): string => {
      const date = safeParse(value);
      if (!date) return "";
      switch (data.period) {
        case "week":
          return format(date, "MMM d");
        case "month":
          return format(date, "MMM yy");
        case "quarter":
          return `Q${Math.floor(date.getMonth() / 3) + 1} '${format(date, "yy")}`;
        case "year":
          return format(date, "yyyy");
        default:
          return format(date, "MMM d");
      }
    },
    [data.period],
  );

  // ---- Data ----

  const summariesInRange = selectedRange
    ? data.summaries.filter((s) => periodOverlapsRange(s, selectedRange))
    : data.summaries;
  const activeSummaries = summariesInRange.length > 0 ? summariesInRange : data.summaries;

  const cashFlowData: CashFlowPoint[] = React.useMemo(
    () =>
      activeSummaries.map((s) => {
        const income = s.income.total.net;
        const expense = Math.abs(s.expense.total.net);
        return {
          period: s.start_date,
          income,
          expense,
          savings: income - expense,
          savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0,
          incomeByCurrency: s.income.total.by_currency,
          expenseByCurrency: s.expense.total.by_currency,
        };
      }),
    [activeSummaries],
  );

  const metrics = React.useMemo(() => {
    const n = cashFlowData.length;
    if (n === 0)
      return {
        totalIncome: 0,
        totalExpense: 0,
        totalSavings: 0,
        avgIncome: 0,
        avgExpense: 0,
        overallRate: 0,
        incomeGrowth: 0,
        expenseGrowth: 0,
        savingsDelta: 0,
        hasPrev: false,
      };
    const totalIncome = cashFlowData.reduce((s, d) => s + d.income, 0);
    const totalExpense = cashFlowData.reduce((s, d) => s + d.expense, 0);
    const totalSavings = totalIncome - totalExpense;
    const last = cashFlowData[n - 1];
    const prev = n >= 2 ? cashFlowData[n - 2] : null;
    return {
      totalIncome,
      totalExpense,
      totalSavings,
      avgIncome: totalIncome / n,
      avgExpense: totalExpense / n,
      overallRate: totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0,
      incomeGrowth: prev && prev.income > 0 ? ((last.income - prev.income) / prev.income) * 100 : 0,
      expenseGrowth:
        prev && prev.expense > 0 ? ((last.expense - prev.expense) / prev.expense) * 100 : 0,
      savingsDelta: prev ? last.savings - prev.savings : 0,
      hasPrev: !!prev,
    };
  }, [cashFlowData]);

  const sparkIncome = React.useMemo(
    () => cashFlowData.map((d) => ({ v: d.income })),
    [cashFlowData],
  );
  const sparkExpense = React.useMemo(
    () => cashFlowData.map((d) => ({ v: d.expense })),
    [cashFlowData],
  );
  const sparkSavings = React.useMemo(
    () => cashFlowData.map((d) => ({ v: d.savings })),
    [cashFlowData],
  );
  const sparkRate = React.useMemo(
    () => cashFlowData.map((d) => ({ v: d.savingsRate })),
    [cashFlowData],
  );

  // Category data for river chart
  const { categoryTotals, expenseCategories, categoryChartData, categoryColors } =
    React.useMemo(() => {
      const totals = activeSummaries.reduce(
        (acc, s) => {
          for (const [cat, cData] of Object.entries(s.expense.by_category)) {
            acc[cat] = (acc[cat] || 0) + Math.abs(cData.net_amount);
          }
          return acc;
        },
        {} as Record<string, number>,
      );

      const cats = Object.entries(totals)
        .sort(([, a], [, b]) => b - a)
        .map(([cat]) => cat);

      const chartRows = activeSummaries.map((s) => {
        const row: CategoryChartPoint = {
          period: s.start_date,
          totalExpense: 0,
          expenseMovingAvg6: null,
        };
        for (const cat of cats) {
          const cd = s.expense.by_category[cat];
          const amount = cd ? Math.abs(cd.net_amount) : 0;
          row[cat] = amount;
          row.totalExpense += amount;
        }
        return row;
      });

      for (let i = 0; i < chartRows.length; i += 1) {
        const windowStart = Math.max(0, i - 5);
        const window = chartRows.slice(windowStart, i + 1);
        const windowTotal = window.reduce((sum, point) => sum + point.totalExpense, 0);
        chartRows[i].expenseMovingAvg6 = windowTotal / window.length;
      }

      const colors: Record<string, string> = {};
      if (allCategories?.expense) {
        for (const raw of allCategories.expense) {
          const c = raw as unknown as { name?: { fr?: string }; color?: string };
          if (c.name?.fr && c.color) colors[c.name.fr] = c.color;
        }
      }

      return {
        categoryTotals: totals,
        expenseCategories: cats,
        categoryChartData: chartRows,
        categoryColors: colors,
      };
    }, [activeSummaries, allCategories]);

  // ---- Drag-to-select ----

  const currentTooltipIndex =
    hoveredIndex ?? (cashFlowData.length ? cashFlowData.length - 1 : null);

  const selectedChartRange = React.useMemo(() => {
    if (selectionStartIndex === null || currentTooltipIndex === null) return null;
    const start = Math.min(selectionStartIndex, currentTooltipIndex);
    const end = Math.max(selectionStartIndex, currentTooltipIndex);
    const startPoint = cashFlowData[start];
    const endPoint = cashFlowData[end];
    if (!startPoint || !endPoint) return null;
    return { start, end, startPoint, endPoint };
  }, [selectionStartIndex, currentTooltipIndex, cashFlowData]);

  selectedChartRangeRef.current = selectedChartRange;

  const handleChartMouseDown = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state: any) => {
      if (typeof state?.activeTooltipIndex !== "number") return;
      const index = state.activeTooltipIndex as number;
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
      setSelectionStartIndex(index);
      setHoveredIndex(index);
      setIsDraggingSelection(true);

      const bodyStyle = document.body.style;
      const prevUserSelect = bodyStyle.userSelect;
      const prevWebkit = bodyStyle.getPropertyValue("-webkit-user-select");
      bodyStyle.userSelect = "none";
      bodyStyle.setProperty("-webkit-user-select", "none");

      const onUp = () => {
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
        bodyStyle.userSelect = prevUserSelect;
        if (prevWebkit) bodyStyle.setProperty("-webkit-user-select", prevWebkit);
        else bodyStyle.removeProperty("-webkit-user-select");
      };
      window.addEventListener("mouseup", onUp, { once: true });
    },
    [onSelectedRangeChange],
  );

  const handleChartMouseMove = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state: any) => {
      if (typeof state?.activeTooltipIndex === "number")
        setHoveredIndex(state.activeTooltipIndex as number);
    },
    [],
  );

  const handleChartMouseLeave = React.useCallback(() => {
    setHoveredIndex(null);
  }, []);

  // ---- Tooltips ----

  const CashFlowTooltip = ({ payload, label, active }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as CashFlowPoint | undefined;
    if (!point) return null;
    const hasRange = selectedChartRange && selectedChartRange.start !== selectedChartRange.end;
    const rangeDelta = hasRange
      ? selectedChartRange.endPoint.savings - selectedChartRange.startPoint.savings
      : 0;

    return (
      <div className="w-[260px] rounded-lg border bg-background p-3 shadow-md">
        <div className="text-xs text-muted-foreground mb-2 font-medium">
          {formatPeriodLabel(label)}
        </div>
        {hasRange && (
          <div className="text-xs rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/60 p-2 mb-2">
            <div className="font-medium text-blue-700 dark:text-blue-300">Selected range</div>
            <div>
              Savings delta:{" "}
              <span
                className={
                  rangeDelta >= 0
                    ? "text-green-700 dark:text-green-400"
                    : "text-red-700 dark:text-red-400"
                }
              >
                {rangeDelta >= 0 ? "+" : ""}
                {fmtCurrency(rangeDelta)}
              </span>
            </div>
          </div>
        )}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Income</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {fmtCurrency(point.income)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Expense</span>
            <span className="font-semibold text-red-600 dark:text-red-400">
              {fmtCurrency(point.expense)}
            </span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Savings</span>
            <span
              className={`font-semibold ${point.savings >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}`}
            >
              {point.savings >= 0 ? "+" : ""}
              {fmtCurrency(point.savings)}
            </span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Savings rate</span>
            <span>{point.savingsRate.toFixed(1)}%</span>
          </div>
        </div>
        {point.incomeByCurrency && Object.keys(point.incomeByCurrency).length > 0 && (
          <>
            <div className="h-px bg-border my-2" />
            <div className="text-[0.65rem] font-medium text-foreground/80 mb-1">By currency</div>
            {Object.entries(point.incomeByCurrency)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([cur, vals]) => (
                <div key={`i-${cur}`} className="flex justify-between text-xs">
                  <span className="text-muted-foreground uppercase">{cur} income</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {fmtCurrencyIn(vals.net, cur)}
                  </span>
                </div>
              ))}
            {point.expenseByCurrency &&
              Object.entries(point.expenseByCurrency)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([cur, vals]) => (
                  <div key={`e-${cur}`} className="flex justify-between text-xs">
                    <span className="text-muted-foreground uppercase">{cur} expense</span>
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      {fmtCurrencyIn(Math.abs(vals.net), cur)}
                    </span>
                  </div>
                ))}
          </>
        )}
      </div>
    );
  };

  const CategoryRiverTooltip = ({ payload, label, active }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;
    const movingAverageEntry = payload.find((entry) => entry.dataKey === "expenseMovingAvg6");
    const sorted = payload
      .filter((entry) => typeof entry.name === "string")
      .filter((entry) => expenseCategories.includes(entry.name as string))
      .sort((a, b) => {
        const iA = expenseCategories.indexOf(a.name as string);
        const iB = expenseCategories.indexOf(b.name as string);
        return iA - iB;
      });
    const total = sorted.reduce((s, e) => s + (Number(e.value) || 0), 0);
    const labelKey = toDateKey(label);
    const summary = activeSummaries.find((s) => toDateKey(s.start_date) === labelKey);
    const byCurrency = summary?.expense?.total?.by_currency ?? {};

    return (
      <div className="w-[280px] rounded-lg border bg-background p-3 shadow-md">
        <div className="text-xs text-muted-foreground font-medium mb-2">
          {formatPeriodLabel(label)}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs pb-1">
            <span className="text-muted-foreground">6-period avg</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {movingAverageEntry?.value != null
                ? fmtCurrency(Number(movingAverageEntry.value))
                : "—"}
            </span>
          </div>
          <div className="h-px bg-border mb-1" />
          {sorted.map((entry) => (
            <div key={entry.name} className="flex justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-[0.65rem] uppercase text-muted-foreground truncate">
                  {entry.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold" style={{ color: entry.color }}>
                  {fmtCurrency(entry.value as number)}
                </span>
                <span className="text-[0.6rem] text-muted-foreground w-8 text-right">
                  {total > 0 ? `${Math.round(((entry.value as number) / total) * 100)}%` : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
        {Object.keys(byCurrency).length > 0 && (
          <>
            <div className="h-px bg-border my-2" />
            <div className="text-[0.65rem] font-medium text-foreground/80 mb-1">
              Original by currency
            </div>
            {Object.entries(byCurrency)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([cur, vals]) => (
                <div key={cur} className="flex justify-between text-xs">
                  <span className="uppercase text-muted-foreground">{cur}</span>
                  <span className="font-medium">{fmtCurrencyIn(Math.abs(vals.net), cur)}</span>
                </div>
              ))}
          </>
        )}
        <div className="h-px bg-border my-2" />
        <div className="flex justify-between">
          <span className="text-xs font-bold uppercase">Total</span>
          <span className="text-xs font-bold">{fmtCurrency(total)}</span>
        </div>
      </div>
    );
  };

  // ---- Render ----

  const accentGreen = "hsl(142, 76%, 36%)";
  const accentRed = "hsl(0, 84%, 60%)";
  const accentBlue = "hsl(217, 91%, 60%)";
  const accentAmber = "hsl(38, 92%, 50%)";

  return (
    <div className="space-y-6">
      {/* ── Pulse Metrics ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Income"
          value={fmtCurrency(metrics.totalIncome)}
          subLabel={`${fmtCurrency(metrics.avgIncome)}/period`}
          change={
            metrics.hasPrev
              ? {
                  value: metrics.incomeGrowth,
                  label: `${metrics.incomeGrowth >= 0 ? "+" : ""}${metrics.incomeGrowth.toFixed(1)}%`,
                }
              : undefined
          }
          sparkData={sparkIncome}
          accentColor={accentGreen}
          sparkId="p-income"
        />
        <MetricCard
          label="Expenses"
          value={fmtCurrency(metrics.totalExpense)}
          subLabel={`${fmtCurrency(metrics.avgExpense)}/period`}
          change={
            metrics.hasPrev
              ? {
                  value: -metrics.expenseGrowth,
                  label: `${metrics.expenseGrowth >= 0 ? "+" : ""}${metrics.expenseGrowth.toFixed(1)}%`,
                }
              : undefined
          }
          sparkData={sparkExpense}
          accentColor={accentRed}
          sparkId="p-expense"
        />
        <MetricCard
          label="Net Savings"
          value={`${metrics.totalSavings >= 0 ? "+" : ""}${fmtCurrency(metrics.totalSavings)}`}
          subLabel={`${fmtCurrency(metrics.totalSavings / Math.max(cashFlowData.length, 1))}/period`}
          change={
            metrics.hasPrev
              ? {
                  value: metrics.savingsDelta,
                  label: `${metrics.savingsDelta >= 0 ? "+" : ""}${fmtCurrency(metrics.savingsDelta)}`,
                }
              : undefined
          }
          sparkData={sparkSavings}
          accentColor={accentBlue}
          sparkId="p-savings"
        />
        <MetricCard
          label="Savings Rate"
          value={`${metrics.overallRate.toFixed(1)}%`}
          subLabel={
            metrics.overallRate >= 20
              ? "Excellent"
              : metrics.overallRate >= 10
                ? "Good"
                : metrics.overallRate >= 0
                  ? "Fair"
                  : "Deficit"
          }
          sparkData={sparkRate}
          accentColor={accentAmber}
          sparkId="p-rate"
        />
      </div>

      {/* ── Savings Health Strip ── */}
      <SavingsHealthStrip
        data={cashFlowData.map((d) => ({
          period: d.period,
          income: d.income,
          expense: d.expense,
        }))}
        formatLabel={formatPeriodLabel}
      />

      {/* ── Cash Flow Chart ── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-6 pt-5 pb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">Cash Flow</h3>
            <div className="h-px flex-1 bg-border" />
            <div className="flex items-center gap-4 text-[0.65rem] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-4 rounded-sm"
                  style={{ background: accentGreen }}
                />
                Income
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-4 rounded-sm"
                  style={{ background: accentRed }}
                />
                Expense
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-0.5 w-4 rounded-full"
                  style={{ background: accentBlue }}
                />
                Savings
              </span>
            </div>
          </div>
        </div>

        <div className="h-[280px] sm:h-[360px] md:h-[420px] select-none px-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={cashFlowData}
              margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
              onMouseDown={handleChartMouseDown}
              onMouseMove={handleChartMouseMove}
              onMouseLeave={handleChartMouseLeave}
            >
              <defs>
                <linearGradient id="cfIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentGreen} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={accentGreen} stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="cfExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentRed} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={accentRed} stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={formatAxisTick}
              />
              <YAxis
                yAxisId="left"
                width={65}
                tickFormatter={fmtCurrency}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                width={50}
                tickFormatter={(v) => `${(v as number) >= 0 ? "+" : ""}${fmtCurrency(v as number)}`}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                stroke={accentBlue}
              />
              {selectedChartRange && (
                <ReferenceArea
                  yAxisId="left"
                  x1={cashFlowData[selectedChartRange.start]?.period}
                  x2={cashFlowData[selectedChartRange.end]?.period}
                  strokeOpacity={0}
                  fill="hsl(var(--primary))"
                  fillOpacity={0.08}
                />
              )}
              <ReferenceLine
                yAxisId="right"
                y={0}
                stroke="hsl(var(--border))"
                strokeDasharray="4 2"
              />
              <Bar
                yAxisId="left"
                dataKey="income"
                fill="url(#cfIncome)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
                name="Income"
              />
              <Bar
                yAxisId="left"
                dataKey="expense"
                fill="url(#cfExpense)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
                name="Expense"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="savings"
                stroke={accentBlue}
                strokeWidth={2.5}
                dot={{
                  r: 3,
                  fill: accentBlue,
                  strokeWidth: 0,
                }}
                isAnimationActive={false}
                name="Savings"
              />
              <Tooltip content={CashFlowTooltip} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="px-6 pb-4 text-[0.65rem] text-muted-foreground">
          {isDraggingSelection
            ? "Drag to compare range\u2026"
            : selectedRange
              ? "Range synced with all charts. Drag again or double-click to reset."
              : "Click and drag to select a range. Double-click to reset."}
        </div>
      </div>

      {/* ── Category Rivers ── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-6 pt-5 pb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">Expense Categories</h3>
            <div className="h-px flex-1 bg-border" />
            <span className="text-[0.65rem] text-muted-foreground">in {preferredCurrency}</span>
          </div>
        </div>

        <div className="h-[260px] sm:h-[360px] md:h-[420px] px-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={categoryChartData}
              margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={formatAxisTick}
              />
              <YAxis
                width={65}
                tickFormatter={fmtCurrency}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <Tooltip content={CategoryRiverTooltip} />
              {expenseCategories.map((cat) => (
                <Area
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  stackId="categories"
                  stroke={categoryColors[cat] || "#808080"}
                  fill={categoryColors[cat] || "#808080"}
                  fillOpacity={0.75}
                  strokeWidth={0}
                  isAnimationActive={false}
                />
              ))}
              <Line
                type="monotone"
                dataKey="expenseMovingAvg6"
                stroke={accentBlue}
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={false}
                connectNulls
                isAnimationActive={false}
                name="6-period avg"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="px-6 pb-5 pt-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-1.5 text-xs">
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: accentBlue }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: accentBlue }}
                />
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: accentBlue }}
                />
              </div>
              <span className="text-muted-foreground uppercase text-[0.65rem]">6-period avg</span>
            </div>
            {expenseCategories.map((cat) => (
              <div key={cat} className="flex items-center gap-1.5 text-xs">
                <div
                  className="h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{
                    backgroundColor: categoryColors[cat] || "#808080",
                  }}
                />
                <span className="text-muted-foreground uppercase text-[0.65rem]">{cat}</span>
                <span className="font-medium tabular-nums text-[0.65rem]">
                  {fmtCurrency(categoryTotals[cat])}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
