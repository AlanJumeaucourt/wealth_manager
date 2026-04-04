import { usePortfolioPerformance } from "@/api/queries";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TimePeriod } from "@/types";
import * as React from "react";
import {
  Area,
  AreaChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MetricType = "performance" | "total_value" | "absolute_gain";

const metricLabels: Record<MetricType, string> = {
  performance: "Performance (%)",
  total_value: "Total Value (€)",
  absolute_gain: "Absolute Gain (€)",
};

function formatSignedMetricValue(value: number, metric: MetricType) {
  const sign = value >= 0 ? "+" : "";
  if (metric === "performance") return `${sign}${value.toFixed(2)}%`;
  return `${sign}${new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
  }).format(value)}`;
}

const periodToDays: Record<TimePeriod, number> = {
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "3Y": 1095,
  "5Y": 1825,
  max: Infinity,
};

interface PortfolioPerformanceChartProps {
  period: TimePeriod;
  selectedRange?: { startDate: string; endDate: string } | null;
  onSelectedRangeChange?: (range: { startDate: string; endDate: string } | null) => void;
}

export function PortfolioPerformanceChart({
  period,
  selectedRange = null,
  onSelectedRangeChange,
}: PortfolioPerformanceChartProps) {
  const { data: performanceData, isLoading } = usePortfolioPerformance();
  const [selectedMetric, setSelectedMetric] = React.useState<MetricType>("performance");
  const [showStacked, setShowStacked] = React.useState(false);
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

  const formatDate = (date: string) => {
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: period === "3Y" || period === "5Y" || period === "max" ? "numeric" : undefined,
    };
    return new Date(date).toLocaleDateString(undefined, options);
  };

  const formatValue = (value: number) => {
    switch (selectedMetric) {
      case "performance":
        return `${value.toFixed(2)}%`;
      case "total_value":
      case "absolute_gain":
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: "EUR",
        }).format(value);
    }
  };

  const formatTooltipDate = (date: string) =>
    new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const filterDataByPeriod = (data: typeof performanceData) => {
    if (!data) return [];

    // Sort data points by date first
    const sortedDataPoints = [...data.data_points].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    if (period === "max") return sortedDataPoints;

    const days = periodToDays[period];
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return sortedDataPoints.filter((point) => {
      const pointDate = new Date(point.date);
      return pointDate >= cutoffDate;
    });
  };

  const transformDataForStackedView = (data: typeof performanceData) => {
    if (!data) return [];

    const filteredData = filterDataByPeriod(data);

    // Transform data to include individual asset values
    return filteredData.map((point) => {
      const transformedPoint: any = {
        date: point.date,
      };

      // Add individual asset values based on selected metric
      Object.entries(point.assets).forEach(([symbol, asset]) => {
        switch (selectedMetric) {
          case "total_value":
            transformedPoint[symbol] = asset.total_value;
            break;
          case "performance": {
            // Calculate individual asset performance relative to cost basis
            const costBasis = asset.cost_basis_per_share || 0;
            const currentPrice = asset.price;
            if (costBasis > 0) {
              transformedPoint[symbol] = ((currentPrice - costBasis) / costBasis) * 100;
            } else {
              transformedPoint[symbol] = 0;
            }
            break;
          }
          case "absolute_gain": {
            // Calculate individual asset absolute gain
            const gain = (asset.price - (asset.cost_basis_per_share || 0)) * asset.shares;
            transformedPoint[symbol] = gain;
            break;
          }
        }
      });

      return transformedPoint;
    });
  };

  const chartData = !performanceData
    ? []
    : showStacked
      ? transformDataForStackedView(performanceData)
      : filterDataByPeriod(performanceData);
  const activeData = selectedRange
    ? chartData.filter((p) => p.date >= selectedRange.startDate && p.date <= selectedRange.endDate)
    : chartData;
  const renderedData = activeData.length > 0 ? activeData : chartData;
  const currentTooltipIndex =
    hoveredIndex ?? (renderedData.length > 0 ? renderedData.length - 1 : null);
  const dragRange = React.useMemo(() => {
    if (selectionStartIndex === null || currentTooltipIndex === null) return null;
    const start = Math.min(selectionStartIndex, currentTooltipIndex);
    const end = Math.max(selectionStartIndex, currentTooltipIndex);
    const startPoint = renderedData[start];
    const endPoint = renderedData[end];
    if (!startPoint || !endPoint) return null;
    return { start, end, startPoint, endPoint };
  }, [selectionStartIndex, currentTooltipIndex, renderedData]);

  if (isLoading) {
    return <Skeleton className="w-full h-[400px]" />;
  }

  if (!performanceData) {
    return null;
  }

  // Get unique asset symbols for stacked view
  const assetSymbols = showStacked
    ? Array.from(new Set(performanceData.data_points.flatMap((point) => Object.keys(point.assets))))
    : [];

  // Generate colors for assets
  const colors = [
    "#22c55e",
    "#3b82f6",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#f97316",
    "#6366f1",
    "#84cc16",
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Select
            value={selectedMetric}
            onValueChange={(value: MetricType) => setSelectedMetric(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(metricLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch checked={showStacked} onCheckedChange={setShowStacked} id="stacked-view" />
            <label htmlFor="stacked-view" className="text-sm">
              Show Asset Breakdown
            </label>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={400} className="select-none">
        <AreaChart
          data={renderedData}
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
          onMouseLeave={() => setHoveredIndex(null)}
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
          <XAxis
            dataKey="date"
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatDate}
          />
          <YAxis
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatValue}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                const totalNow = payload.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
                const totalStart = dragRange
                  ? Object.entries(dragRange.startPoint)
                      .filter(([k]) => k !== "date")
                      .reduce((sum, [, v]) => sum + (Number(v) || 0), 0)
                  : 0;
                const selectedMetricDiff = dragRange
                  ? Number(dragRange.endPoint[selectedMetric] ?? 0) -
                    Number(dragRange.startPoint[selectedMetric] ?? 0)
                  : 0;
                return (
                  <Card className="p-3">
                    <p className="text-sm text-muted-foreground">{formatTooltipDate(data.date)}</p>
                    <div className="space-y-1 mt-1">
                      {dragRange && (
                        <div className="text-xs rounded-md border border-blue-200 bg-blue-50 p-2 mb-1 space-y-0.5">
                          <div className="font-medium text-blue-700">
                            Selected: {formatTooltipDate(dragRange.startPoint.date)} {"->"}{" "}
                            {formatTooltipDate(dragRange.endPoint.date)}
                          </div>
                          <div>
                            {showStacked ? "Total diff" : `${metricLabels[selectedMetric]} diff`}:{" "}
                            <span
                              className={
                                (showStacked ? totalNow - totalStart : selectedMetricDiff) >= 0
                                  ? "text-green-700"
                                  : "text-red-700"
                              }
                            >
                              {showStacked
                                ? formatSignedMetricValue(totalNow - totalStart, selectedMetric)
                                : formatSignedMetricValue(selectedMetricDiff, selectedMetric)}
                            </span>
                          </div>
                        </div>
                      )}
                      {showStacked ? (
                        <>
                          <p className="font-medium">
                            Total:{" "}
                            {formatValue(
                              payload.reduce((sum, item) => sum + (Number(item.value) || 0), 0),
                            )}
                          </p>
                          {payload.map((item) => (
                            <p key={item.dataKey} className="text-sm text-muted-foreground">
                              {item.dataKey}: {formatValue(Number(item.value) || 0)}
                            </p>
                          ))}
                        </>
                      ) : (
                        <>
                          <p className="font-medium">
                            {metricLabels[selectedMetric]}: {formatValue(data[selectedMetric])}
                          </p>
                          {selectedMetric === "total_value" && (
                            <>
                              <p className="text-sm text-muted-foreground">
                                Net Invested: {formatValue(data.net_invested)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Absolute Gain: {formatValue(data.absolute_gain)}
                              </p>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </Card>
                );
              }
              return null;
            }}
          />
          {dragRange && (
            <ReferenceArea
              x1={renderedData[dragRange.start]?.date}
              x2={renderedData[dragRange.end]?.date}
              strokeOpacity={0}
              fill="#22c55e"
              fillOpacity={0.08}
            />
          )}
          {showStacked ? (
            // Render stacked areas for each asset
            assetSymbols.map((symbol, index) => (
              <Area
                key={symbol}
                type="monotone"
                dataKey={symbol}
                stackId={selectedMetric === "performance" ? undefined : "1"}
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.2}
                strokeWidth={1}
                isAnimationActive={false}
              />
            ))
          ) : (
            // Render single area for total value
            <>
              <Area
                type="monotone"
                dataKey={selectedMetric}
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.2}
                strokeWidth={2}
                isAnimationActive={false}
              />
              {selectedMetric === "total_value" && (
                <Area
                  type="monotone"
                  dataKey="net_invested"
                  stroke="#888888"
                  fill="none"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              )}
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground">
        {isDraggingSelection
          ? "Comparing range... drag to another date for live delta."
          : selectedRange
            ? "Range applied to investments charts. Double-click to reset."
            : "Click a point, drag, and release to apply the same date range to all investments charts."}
      </p>
      {selectedRange && (
        <button
          type="button"
          className="text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2"
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
