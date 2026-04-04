"use client";

import { useWealthOverTimeWithGains } from "@/api/queries";

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
  headerActions?: React.ReactNode;
  selectedRange?: { startDate: string; endDate: string } | null;
  onSelectedRangeChange?: (range: { startDate: string; endDate: string } | null) => void;
}

type ChartPoint = {
  date: string;
  balance: number;
  balance_by_currency?: Record<string, number>;
  total_value: number;
  investment_gain_value: number;
  investment_gain_display: number;
  balance_with_negative_gains: number;
};

function formatSignedCurrency(value: number, currency: string) {
  return `${value >= 0 ? "+" : ""}${formatCurrency(value, currency)}`;
}

function CustomTooltip({ active, payload, label, preferredCurrency, rangeSelection }: any) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const balance = data.balance;
  const investmentGain = data.investment_gain_value;
  const totalValue = data.total_value;
  const balanceByCurrency = data.balance_by_currency as Record<string, number> | undefined;
  const curr = preferredCurrency || "EUR";
  const hasRange = Boolean(rangeSelection?.startPoint && rangeSelection?.endPoint);
  const startPoint = rangeSelection?.startPoint as ChartPoint | undefined;
  const endPoint = rangeSelection?.endPoint as ChartPoint | undefined;
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
        {new Date(label).toLocaleDateString(undefined, {
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
              Balance diff:{" "}
              <span
                className={
                  endPoint.balance - startPoint.balance >= 0 ? "text-green-700" : "text-red-700"
                }
              >
                {formatSignedCurrency(endPoint.balance - startPoint.balance, curr)}
              </span>
            </div>
            <div>
              Gain diff:{" "}
              <span
                className={
                  endPoint.investment_gain_value - startPoint.investment_gain_value >= 0
                    ? "text-green-700"
                    : "text-red-700"
                }
              >
                {formatSignedCurrency(
                  endPoint.investment_gain_value - startPoint.investment_gain_value,
                  curr,
                )}
              </span>
            </div>
            <div>
              Total value diff:{" "}
              <span
                className={
                  endPoint.total_value - startPoint.total_value >= 0
                    ? "text-green-700"
                    : "text-red-700"
                }
              >
                {formatSignedCurrency(endPoint.total_value - startPoint.total_value, curr)}
              </span>
            </div>
          </div>
        )}
        <div className="text-sm font-medium">
          Total (preferred): <span className="text-blue-600">{formatCurrency(balance, curr)}</span>
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
        <div className="text-sm">
          Investment Gain:{" "}
          <span className={investmentGain >= 0 ? "text-green-600" : "text-red-600"}>
            {investmentGain >= 0 ? "+" : ""}
            {formatCurrency(investmentGain, curr)}
          </span>
        </div>
        <div className="text-sm">
          Total value (preferred):{" "}
          <span className="text-blue-500">{formatCurrency(totalValue, curr)}</span>
        </div>
      </div>
    </div>
  );
}

export function WealthChart({
  startDate,
  endDate,
  periodType = "month",
  headerActions,
  selectedRange = null,
  onSelectedRangeChange,
}: WealthChartProps) {
  const { preferredCurrency } = usePreferredCurrency();
  const { data: wealthData, isLoading } = useWealthOverTimeWithGains();
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [selectionStartIndex, setSelectionStartIndex] = React.useState<number | null>(null);
  const [isDraggingSelection, setIsDraggingSelection] = React.useState(false);
  const lastClickRef = React.useRef<{ time: number; index: number | null }>({
    time: 0,
    index: null,
  });
  React.useEffect(() => {
    if (!isDraggingSelection) return;
    const bodyStyle = document.body.style;
    const previousUserSelect = bodyStyle.userSelect;
    const previousWebkitUserSelect = bodyStyle.getPropertyValue("-webkit-user-select");
    bodyStyle.userSelect = "none";
    bodyStyle.setProperty("-webkit-user-select", "none");
    const handleWindowMouseUp = () => {
      setIsDraggingSelection(false);
      setSelectionStartIndex(null);
      setHoveredIndex(null);
    };
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleWindowMouseUp);
      bodyStyle.userSelect = previousUserSelect;
      if (previousWebkitUserSelect) {
        bodyStyle.setProperty("-webkit-user-select", previousWebkitUserSelect);
      } else {
        bodyStyle.removeProperty("-webkit-user-select");
      }
    };
  }, [isDraggingSelection]);
  const chartConfig = React.useMemo(
    () => ({
      balance: {
        label: "Balance",
        color: "hsl(217, 91%, 60%)", // Bright blue
        gradientFrom: "hsl(217, 91%, 60%)",
        gradientTo: "hsl(217, 91%, 97%)", // Very light blue
      },
      investmentGain: {
        label: "Investment Gain",
        color: "hsl(142, 76%, 36%)", // Green
        gradientFrom: "hsl(142, 76%, 36%)",
        gradientTo: "hsl(142, 76%, 90%)", // Very light green
      },
    }),
    [],
  );

  // Convert the data into chart format with stacked values
  // The investment gain should always stick to the balance line
  const chartData = wealthData
    ? Object.entries(wealthData).map(([date, data]) => ({
        date,
        balance: data.balance,
        balance_by_currency: data.balance_by_currency,
        total_value: data.balance + data.investment_gain,
        investment_gain_value: data.investment_gain,
        investment_gain_display:
          data.investment_gain >= 0 ? data.balance + data.investment_gain : data.balance,
        balance_with_negative_gains:
          data.investment_gain < 0 ? data.balance + data.investment_gain : data.balance,
      }))
    : [];
  // Filter data based on provided date range
  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date);
    return date >= startDate && date <= endDate;
  });
  const zoomedData = selectedRange
    ? filteredData.filter(
        (item) => item.date >= selectedRange.startDate && item.date <= selectedRange.endDate,
      )
    : filteredData;
  const activeData = zoomedData.length > 0 ? zoomedData : filteredData;
  const hasData = activeData.length > 0;

  const visibleBalances = activeData.map((item) => item.balance);
  const visibleTotalValues = activeData.map((item) => item.total_value);
  const visibleNegativeValues = activeData.map((item) => item.balance_with_negative_gains);

  const minBalance = hasData ? Math.min(...visibleBalances) : 0;
  const maxBalance = hasData ? Math.max(...visibleBalances) : 0;
  const minTotal = hasData ? Math.min(...visibleTotalValues, ...visibleNegativeValues) : 0;
  const maxTotal = hasData ? Math.max(...visibleTotalValues, ...visibleBalances) : 0;

  const balanceRange = maxBalance - minBalance;
  const totalRange = maxTotal - minTotal;
  const padding = {
    top: Math.max(balanceRange, totalRange) * 0.1,
    bottom: Math.max(balanceRange, totalRange) * 0.1,
  };

  const shouldStartFromZero = minBalance < maxBalance * 0.05;
  const yDomain = [
    shouldStartFromZero ? 0 : Math.min(minBalance, minTotal) - padding.bottom,
    Math.max(maxBalance, maxTotal) + padding.top,
  ] as [number, number];

  const currentBalance = activeData[activeData.length - 1]?.balance || 0;
  const currentGainValue = activeData[activeData.length - 1]?.investment_gain_value || 0;
  const balanceChange = currentBalance - (activeData[0]?.balance || 0);
  const gainChange = currentGainValue - (activeData[0]?.investment_gain_value || 0);
  const currentTooltipIndex = hoveredIndex ?? (hasData ? activeData.length - 1 : null);

  const dragRange = React.useMemo(() => {
    if (selectionStartIndex === null || currentTooltipIndex === null) return null;
    const start = Math.min(selectionStartIndex, currentTooltipIndex);
    const end = Math.max(selectionStartIndex, currentTooltipIndex);
    const startPoint = activeData[start];
    const endPoint = activeData[end];
    if (!startPoint || !endPoint) return null;
    return {
      start,
      end,
      startPoint,
      endPoint,
    };
  }, [selectionStartIndex, currentTooltipIndex, activeData]);

  // Dynamic date formatting based on period type
  const formatDate = (date: string) => {
    const dateObj = new Date(date);
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
    };

    switch (periodType) {
      case "week":
        options.month = "short";
        options.day = "numeric";
        break;
      case "month":
        options.month = "short";
        options.day = "numeric";
        break;
      case "quarter": {
        const quarter = Math.floor(dateObj.getMonth() / 3) + 1;
        return `Q${quarter} ${dateObj.getFullYear()}`;
      }
      case "year":
        return dateObj.getFullYear().toString();
      default:
        options.month = "short";
        options.day = "numeric";
    }

    return dateObj.toLocaleDateString(undefined, options);
  };

  // Calculate appropriate tick spacing based on data length and period type
  const getTickSpacing = () => {
    const dataLength = activeData.length;
    if (dataLength <= 12) return 1;
    if (dataLength <= 24) return 2;
    if (dataLength <= 36) return 3;
    return Math.ceil(dataLength / 12);
  };

  if (isLoading) return <div>Loading...</div>;
  if (!wealthData) return null;

  return (
    <>
      <div className="pb-4 sm:pb-6 border-b px-6 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:gap-x-3 text-xs sm:text-sm">
              <span>
                Balance:{" "}
                <span className="font-medium text-blue-600">
                  {formatCurrency(currentBalance, preferredCurrency)}
                </span>
              </span>
              <span>
                Change:{" "}
                <span className={balanceChange >= 0 ? "text-green-500" : "text-red-500"}>
                  {balanceChange >= 0 ? "+" : ""}
                  {formatCurrency(balanceChange, preferredCurrency)}
                </span>
              </span>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:gap-x-3 text-xs sm:text-sm">
              <span>
                Investment Gain:{" "}
                <span
                  className={`font-medium ${currentGainValue >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {currentGainValue >= 0 ? "+" : ""}
                  {formatCurrency(currentGainValue, preferredCurrency)}
                </span>
              </span>
              <span>
                Change:{" "}
                <span className={gainChange >= 0 ? "text-green-500" : "text-red-500"}>
                  {gainChange >= 0 ? "+" : ""}
                  {formatCurrency(gainChange, preferredCurrency)}
                </span>
              </span>
            </div>
          </div>
          {headerActions && <div className="flex gap-2 shrink-0">{headerActions}</div>}
        </div>
      </div>
      <div className="pt-4 sm:pt-6 px-6 pb-6">
        <div className="h-[240px] w-full sm:h-[300px] select-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={activeData}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              onMouseDown={(state: any) => {
                if (typeof state?.activeTooltipIndex !== "number") return;
                const index = state.activeTooltipIndex;
                const now = Date.now();
                if (lastClickRef.current.index === index && now - lastClickRef.current.time < 280) {
                  onSelectedRangeChange?.(null);
                  setSelectionStartIndex(null);
                  setHoveredIndex(null);
                  setIsDraggingSelection(false);
                  lastClickRef.current = { time: 0, index: null };
                  return;
                }
                lastClickRef.current = { time: now, index };
                setSelectionStartIndex(state.activeTooltipIndex);
                setHoveredIndex(state.activeTooltipIndex);
                setIsDraggingSelection(true);
              }}
              onMouseMove={(state: any) => {
                if (typeof state?.activeTooltipIndex !== "number") return;
                setHoveredIndex(state.activeTooltipIndex);
              }}
              onMouseLeave={() => {
                setHoveredIndex(null);
              }}
              onMouseUp={() => {
                if (isDraggingSelection && dragRange && dragRange.start !== dragRange.end) {
                  onSelectedRangeChange?.({
                    startDate: dragRange.startPoint.date,
                    endDate: dragRange.endPoint.date,
                  });
                }
                setIsDraggingSelection(false);
                setSelectionStartIndex(null);
                setHoveredIndex(null);
              }}
            >
              <defs>
                <linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={chartConfig.balance.gradientFrom}
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor={chartConfig.balance.gradientTo}
                    stopOpacity={0.05}
                  />
                </linearGradient>
                <linearGradient id="fillInvestmentGain" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={chartConfig.investmentGain.gradientFrom}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={chartConfig.investmentGain.gradientTo}
                    stopOpacity={0.05}
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
              {/* Base balance area - always visible */}
              <Area
                type="monotone"
                dataKey="balance_with_negative_gains"
                stroke="none"
                fill="url(#fillBalance)"
                strokeWidth={0}
                isAnimationActive={false}
              />

              {/* Balance line - the reference line that gains stick to */}
              <Area
                type="monotone"
                dataKey="balance"
                stroke={chartConfig.balance.color}
                fill="url(#fillBalance)"
                strokeWidth={2}
                isAnimationActive={false}
              />

              {/* Investment gains area - sticks to balance line */}
              <Area
                type="monotone"
                dataKey="total_value"
                stroke={chartConfig.investmentGain.color}
                fill="url(#fillInvestmentGain)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Tooltip
                content={
                  <CustomTooltip preferredCurrency={preferredCurrency} rangeSelection={dragRange} />
                }
                wrapperStyle={{ outline: "none" }}
                active={currentTooltipIndex !== null}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {isDraggingSelection
            ? "Comparing range... drag to another date for live delta."
            : selectedRange
              ? "Range applied to chart. Drag again to refine, or double-click to reset."
              : "Click a point to anchor, then drag to compare live values. Double-click to reset selection."}
        </div>
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
    </>
  );
}
