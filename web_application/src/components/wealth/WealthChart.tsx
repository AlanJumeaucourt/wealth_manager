"use client";

import type { BalanceHistoryResponse } from "@/api/edenDerivedTypes";

import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { formatCompactCurrency, formatCurrency } from "@/utils/currency";
import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface WealthChartProps {
  startDate: Date;
  endDate: Date;
  periodType?: "week" | "month" | "quarter" | "year";
  /** Aggregated wealth history (includes balance + investment_gain per day). */
  wealthData: BalanceHistoryResponse | undefined;
  isLoading?: boolean;
  /** When false, the chart shows balance only (cost basis path); gain is omitted from the series. */
  showInvestmentGain?: boolean;
  /** When false, loan accounts are omitted from the book (blue) series. */
  includeDebt?: boolean;
  selectedRange?: { startDate: string; endDate: string } | null;
  onSelectedRangeChange?: (range: { startDate: string; endDate: string } | null) => void;
}

type ChartPoint = {
  date: string;
  balance: number;
  balance_by_currency?: Record<string, number>;
  investment_gain_unrealized: number;
  investment_gain_realized: number;
  investment_gain_value: number;
  market_value: number;
};

function parseGainFields(data: {
  investment_gain: number;
  investment_gain_unrealized?: number;
  investment_gain_realized?: number;
}) {
  const total = data.investment_gain;
  const unrealized = data.investment_gain_unrealized ?? total;
  const realized = data.investment_gain_realized ?? Math.max(0, total - unrealized);
  return { total, unrealized, realized };
}

function formatSignedCurrency(value: number, currency: string) {
  return `${value >= 0 ? "+" : ""}${formatCurrency(value, currency)}`;
}

function CustomTooltip({
  active,
  payload,
  label,
  preferredCurrency,
  rangeSelection,
  showInvestmentGain = true,
  includeDebt = true,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
  label?: string;
  preferredCurrency: string;
  rangeSelection?: {
    startPoint?: ChartPoint;
    endPoint?: ChartPoint;
  } | null;
  showInvestmentGain?: boolean;
  includeDebt?: boolean;
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const balance = data.balance;
  const unrealized = data.investment_gain_unrealized;
  const realized = data.investment_gain_realized;
  const investmentGain = data.investment_gain_value;
  const marketValue = data.market_value;
  const balanceByCurrency = data.balance_by_currency;
  const curr = preferredCurrency;
  const hasRange = Boolean(rangeSelection?.startPoint && rangeSelection?.endPoint);
  const startPoint = rangeSelection?.startPoint;
  const endPoint = rangeSelection?.endPoint;
  const startDateLabel = startPoint
    ? new Date(startPoint.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const endDateLabel = endPoint
    ? new Date(endPoint.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm">
      <div className="text-xs text-muted-foreground mb-2">
        {new Date(label ?? "").toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </div>
      <div className="space-y-1">
        {hasRange && startPoint && endPoint && (
          <div className="text-xs rounded-md border border-blue-200 bg-blue-50 p-2 mb-2 space-y-0.5">
            <div className="font-medium text-blue-700">
              Selected: {startDateLabel} {"->"} {endDateLabel}
            </div>
            <div>
              Book diff:{" "}
              <span
                className={
                  endPoint.balance - startPoint.balance >= 0 ? "text-green-700" : "text-red-700"
                }
              >
                {formatSignedCurrency(endPoint.balance - startPoint.balance, curr)}
              </span>
            </div>
            {showInvestmentGain && (
              <>
                <div>
                  Unrealized diff:{" "}
                  <span
                    className={
                      endPoint.investment_gain_unrealized - startPoint.investment_gain_unrealized >=
                      0
                        ? "text-green-700"
                        : "text-red-700"
                    }
                  >
                    {formatSignedCurrency(
                      endPoint.investment_gain_unrealized - startPoint.investment_gain_unrealized,
                      curr,
                    )}
                  </span>
                </div>
                <div>
                  Realized diff:{" "}
                  <span
                    className={
                      endPoint.investment_gain_realized - startPoint.investment_gain_realized >= 0
                        ? "text-green-700"
                        : "text-red-700"
                    }
                  >
                    {formatSignedCurrency(
                      endPoint.investment_gain_realized - startPoint.investment_gain_realized,
                      curr,
                    )}
                  </span>
                </div>
                <div>
                  Market diff:{" "}
                  <span
                    className={
                      endPoint.market_value - startPoint.market_value >= 0
                        ? "text-green-700"
                        : "text-red-700"
                    }
                  >
                    {formatSignedCurrency(endPoint.market_value - startPoint.market_value, curr)}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
        <div className="text-sm font-medium">
          {includeDebt ? "Net worth (book)" : "Assets (book)"}:{" "}
          <span className="text-blue-600">{formatCurrency(balance, curr)}</span>
        </div>
        {balanceByCurrency && Object.keys(balanceByCurrency).length > 0 && (
          <div className="text-xs text-muted-foreground pt-1 border-t mt-1">
            <div className="mb-1 font-medium text-foreground/80">Balance by currency</div>
            {Object.entries(balanceByCurrency)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([currency, amt]) => (
                <div key={currency} className="flex items-center justify-between gap-3">
                  <span>{currency}</span>
                  <span className="tabular-nums">{formatCurrency(amt, currency)}</span>
                </div>
              ))}
          </div>
        )}
        {showInvestmentGain && (
          <>
            <div className="text-sm">
              Paper gain (open):{" "}
              <span className={unrealized >= 0 ? "text-emerald-500" : "text-red-600"}>
                {formatSignedCurrency(unrealized, curr)}
              </span>
            </div>
            <div className="text-sm">
              Locked in:{" "}
              <span className={realized >= 0 ? "text-emerald-700" : "text-red-600"}>
                {formatSignedCurrency(realized, curr)}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Total uplift: {formatSignedCurrency(investmentGain, curr)}
            </div>
            <div className="text-sm">
              Market value:{" "}
              <span className="text-blue-500">{formatCurrency(marketValue, curr)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function WealthChart({
  startDate,
  endDate,
  periodType = "month",
  wealthData,
  isLoading = false,
  showInvestmentGain = true,
  includeDebt = true,
  selectedRange = null,
  onSelectedRangeChange,
}: WealthChartProps) {
  const { preferredCurrency } = usePreferredCurrency();
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [selectionStartIndex, setSelectionStartIndex] = React.useState<number | null>(null);
  const [isDraggingSelection, setIsDraggingSelection] = React.useState(false);
  const lastClickRef = React.useRef<{ time: number; index: number | null }>({
    time: 0,
    index: null,
  });
  const isDraggingRef = React.useRef(false);
  const dragRangeRef = React.useRef<{
    start: number;
    end: number;
    startPoint: ChartPoint;
    endPoint: ChartPoint;
  } | null>(null);

  const chartConfig = React.useMemo(
    () => ({
      balance: {
        label: includeDebt ? "Net worth (book)" : "Assets (book)",
        color: "hsl(217, 91%, 60%)",
        gradientFrom: "hsl(217, 91%, 60%)",
        gradientTo: "hsl(217, 91%, 97%)",
      },
      unrealized: {
        label: "Market uplift",
        color: "hsl(142, 60%, 45%)",
        gradientFrom: "hsl(142, 60%, 45%)",
        gradientTo: "hsl(142, 60%, 88%)",
      },
    }),
    [includeDebt],
  );

  const chartData: ChartPoint[] = wealthData
    ? Object.entries(wealthData).map(([date, raw]) => {
        const { total, unrealized, realized } = parseGainFields(raw);
        const marketValue =
          "market_value" in raw && typeof raw.market_value === "number"
            ? raw.market_value
            : raw.balance + unrealized;
        return {
          date,
          balance: raw.balance,
          balance_by_currency: raw.balance_by_currency,
          investment_gain_unrealized: unrealized,
          investment_gain_realized: realized,
          investment_gain_value: total,
          market_value: marketValue,
        };
      })
    : [];

  const filteredData = chartData.filter((item) => {
    const d = new Date(item.date);
    return d >= startDate && d <= endDate;
  });
  const zoomedData = selectedRange
    ? filteredData.filter(
        (item) => item.date >= selectedRange.startDate && item.date <= selectedRange.endDate,
      )
    : filteredData;
  const activeData = zoomedData.length > 0 ? zoomedData : filteredData;
  const hasData = activeData.length > 0;

  const stackTotals = activeData.map((item) => item.market_value);
  const visibleBalances = activeData.map((item) => item.balance);
  const minBalance = hasData ? Math.min(...visibleBalances) : 0;
  const maxBalance = hasData ? Math.max(...visibleBalances) : 0;
  const minTotal = hasData ? Math.min(...stackTotals, ...visibleBalances) : 0;
  const maxTotal = hasData ? Math.max(...stackTotals, ...visibleBalances) : 0;

  const balanceRange = maxBalance - minBalance;
  const totalRange = maxTotal - minTotal;
  const padding = {
    top: Math.max(balanceRange, totalRange) * 0.1,
    bottom: Math.max(balanceRange, totalRange) * 0.1,
  };

  const shouldStartFromZero = minBalance < maxBalance * 0.05;
  const yDomain = showInvestmentGain
    ? ([
        shouldStartFromZero ? 0 : Math.min(minBalance, minTotal) - padding.bottom,
        Math.max(maxBalance, maxTotal) + padding.top,
      ] as [number, number])
    : (() => {
        const r = maxBalance - minBalance;
        const pad = Math.max(r, 1) * 0.1;
        return [shouldStartFromZero ? 0 : minBalance - pad, maxBalance + pad] as [number, number];
      })();

  const currentTooltipIndex = hoveredIndex ?? (hasData ? activeData.length - 1 : null);

  const dragRange = React.useMemo(() => {
    if (selectionStartIndex === null || currentTooltipIndex === null) return null;
    const start = Math.min(selectionStartIndex, currentTooltipIndex);
    const end = Math.max(selectionStartIndex, currentTooltipIndex);
    const startPoint = activeData[start];
    const endPoint = activeData[end];
    if (!startPoint || !endPoint) return null;
    return { start, end, startPoint, endPoint };
  }, [selectionStartIndex, currentTooltipIndex, activeData]);

  dragRangeRef.current = dragRange;

  const formatDate = (date: string) => {
    const dateObj = new Date(date);
    switch (periodType) {
      case "week":
      case "month":
        return dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      case "quarter": {
        const quarter = Math.floor(dateObj.getMonth() / 3) + 1;
        return `Q${quarter} ${dateObj.getFullYear()}`;
      }
      case "year":
        return dateObj.getFullYear().toString();
      default:
        return dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
  };

  const getTickSpacing = () => {
    const dataLength = activeData.length;
    if (dataLength <= 12) return 1;
    if (dataLength <= 24) return 2;
    if (dataLength <= 36) return 3;
    return Math.ceil(dataLength / 12);
  };

  if (isLoading) return <div className="px-6 py-8 text-sm text-muted-foreground">Loading...</div>;
  if (!wealthData) return null;

  return (
    <div className="px-6 pb-6">
      {showInvestmentGain && (
        <div className="flex flex-wrap gap-4 mb-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: chartConfig.balance.color }}
            />
            <span className="text-muted-foreground">{chartConfig.balance.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: chartConfig.unrealized.color }}
            />
            <span className="text-muted-foreground">{chartConfig.unrealized.label}</span>
          </div>
        </div>
      )}
      <div className="h-[240px] w-full sm:h-[300px] select-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={activeData}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            onMouseDown={(state: { activeTooltipIndex?: number }) => {
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
                const dr = dragRangeRef.current;
                if (isDraggingRef.current && dr && dr.start !== dr.end) {
                  onSelectedRangeChange?.({
                    startDate: dr.startPoint.date,
                    endDate: dr.endPoint.date,
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
            onMouseMove={(state: { activeTooltipIndex?: number }) => {
              if (typeof state?.activeTooltipIndex !== "number") return;
              setHoveredIndex(state.activeTooltipIndex);
            }}
            onMouseLeave={() => {
              setHoveredIndex(null);
            }}
          >
            <defs>
              <linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartConfig.balance.gradientFrom} stopOpacity={0.2} />
                <stop offset="95%" stopColor={chartConfig.balance.gradientTo} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillUnrealized" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={chartConfig.unrealized.gradientFrom}
                  stopOpacity={0.35}
                />
                <stop
                  offset="95%"
                  stopColor={chartConfig.unrealized.gradientTo}
                  stopOpacity={0.08}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              interval={getTickSpacing() - 1}
              tickFormatter={formatDate}
              stroke="#9CA3AF"
            />
            <YAxis
              domain={yDomain}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => formatCompactCurrency(value, preferredCurrency)}
              width={80}
              stroke="#9CA3AF"
            />
            {dragRange && (
              <ReferenceArea
                x1={activeData[dragRange.start]?.date}
                x2={activeData[dragRange.end]?.date}
                strokeOpacity={0}
                fill="hsl(217, 91%, 60%)"
                fillOpacity={0.08}
              />
            )}
            <Area
              type="monotone"
              dataKey="balance"
              stackId="wealth"
              stroke={chartConfig.balance.color}
              fill="url(#fillBalance)"
              strokeWidth={2}
              isAnimationActive={false}
            />
            {showInvestmentGain && (
              <>
                <Area
                  type="monotone"
                  dataKey="investment_gain_unrealized"
                  stackId="wealth"
                  stroke={chartConfig.unrealized.color}
                  fill="url(#fillUnrealized)"
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </>
            )}
            <Tooltip
              content={
                <CustomTooltip
                  preferredCurrency={preferredCurrency}
                  rangeSelection={dragRange}
                  showInvestmentGain={showInvestmentGain}
                  includeDebt={includeDebt}
                />
              }
              wrapperStyle={{ outline: "none" }}
              active={hoveredIndex !== null}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {isDraggingSelection
          ? "Drag to another date to compare."
          : selectedRange
            ? "Double-click chart to reset range."
            : "Hover for values. Drag on chart to compare two dates."}
      </p>
      {selectedRange && (
        <button
          type="button"
          className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2"
          onClick={() => {
            onSelectedRangeChange?.(null);
            setSelectionStartIndex(null);
            setHoveredIndex(null);
            setIsDraggingSelection(false);
          }}
        >
          Reset selected date range
        </button>
      )}
    </div>
  );
}
