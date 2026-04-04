import { usePortfolioPerformance, usePortfolioSummary } from "@/api/queries";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TimePeriod } from "@/types";
import * as React from "react";
import {
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MetricType =
  | "price"
  | "relative_price"
  | "total_value"
  | "performance"
  | "tri"
  | "cost_basis_comparison";

interface AssetPerformanceChartProps {
  period: TimePeriod;
  selectedRange?: { startDate: string; endDate: string } | null;
  onSelectedRangeChange?: (range: { startDate: string; endDate: string } | null) => void;
}

const ALL_ASSETS = "all_assets" as const;

const METRIC_LABELS: Record<MetricType, string> = {
  price: "Price per Share",
  relative_price: "Relative Price (%)",
  total_value: "Total Value",
  performance: "Performance (%)",
  tri: "Total Return Index",
  cost_basis_comparison: "Price vs Cost Basis",
};

function formatSignedMetricValue(value: number, metric: MetricType) {
  const sign = value >= 0 ? "+" : "";
  switch (metric) {
    case "performance":
    case "relative_price":
      return `${sign}${value.toFixed(2)}%`;
    case "price":
    case "total_value":
      return `${sign}€${Math.abs(value).toFixed(2)}`;
    case "tri":
      return `${sign}${value.toFixed(2)}`;
    default:
      return `${sign}${value.toFixed(2)}`;
  }
}

interface AssetData {
  symbol: string;
  price: number;
}

interface AssetMetrics {
  price: number;
  shares: number;
  total_value: number;
  cost_basis_per_share: number;
}

export function AssetPerformanceChart({
  selectedRange = null,
  onSelectedRangeChange,
}: AssetPerformanceChartProps) {
  const { data: performanceData, isLoading: isLoadingPerformance } = usePortfolioPerformance();
  const { data: summaryData, isLoading: isLoadingSummary } = usePortfolioSummary();
  const [selectedAsset, setSelectedAsset] = React.useState<string>(ALL_ASSETS);
  const [selectedMetric, setSelectedMetric] = React.useState<MetricType>("relative_price");
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

  if (isLoadingPerformance || isLoadingSummary) {
    return <Skeleton className="w-full h-[300px]" />;
  }

  if (!performanceData?.data_points || !summaryData?.assets) return null;

  // Get available assets from summary and sort them by price range
  const assetData: AssetData[] = summaryData.assets
    .filter((asset) => asset.shares > 0)
    .map((asset) => ({
      symbol: asset.symbol,
      price:
        performanceData.data_points[performanceData.data_points.length - 1]?.assets[asset.symbol]
          ?.price || 0,
    }))
    .sort((a, b) => a.price - b.price);

  const highPriceThreshold = 100;
  const lowPriceAssets = assetData
    .filter((asset) => asset.price <= highPriceThreshold)
    .map((asset) => asset.symbol);
  const highPriceAssets = assetData
    .filter((asset) => asset.price > highPriceThreshold)
    .map((asset) => asset.symbol);

  const usesSingleAxis = selectedMetric === "performance" || selectedMetric === "relative_price";

  // Build baseline prices and start offsets for relative_price.
  // Assets starting later get an offset equal to the average relative change
  // of already-active assets at that point, so lines visually "join" the chart.
  const baselinePrices: Record<string, number> = {};
  const startOffsets: Record<string, number> = {};
  if (selectedMetric === "relative_price") {
    const runningRelative: Record<string, number> = {};
    for (const point of performanceData.data_points) {
      // Update relative values for already-tracked assets
      for (const [symbol, data] of Object.entries(point.assets)) {
        if (symbol in baselinePrices && data.price > 0) {
          runningRelative[symbol] =
            ((data.price - baselinePrices[symbol]) / baselinePrices[symbol]) * 100;
        }
      }

      // Register new assets with offset from current average
      for (const [symbol, data] of Object.entries(point.assets)) {
        if (!(symbol in baselinePrices) && data.price > 0) {
          const activeValues = Object.values(runningRelative);
          const avgRelative =
            activeValues.length > 0
              ? activeValues.reduce((s, v) => s + v, 0) / activeValues.length
              : 0;
          baselinePrices[symbol] = data.price;
          startOffsets[symbol] = avgRelative;
          runningRelative[symbol] = avgRelative;
        }
      }
    }
  }

  const allAssetSymbols = assetData.map((a) => a.symbol);

  // Transform data for individual asset performance
  const chartData = performanceData.data_points.map((point) => {
    const baseData = { date: point.date };

    if (selectedAsset === ALL_ASSETS) {
      if (selectedMetric === "performance") {
        const performanceData = Object.fromEntries(
          Object.entries(point.assets)
            .filter(([symbol]) => allAssetSymbols.includes(symbol))
            .map(([symbol, data]) => {
              const assetSummary = summaryData.assets.find((a) => a.symbol === symbol);
              if (!assetSummary) return [symbol, 0];
              return [
                symbol,
                ((data.total_value - assetSummary.cost_basis) / assetSummary.cost_basis) * 100,
              ];
            }),
        );
        return { ...baseData, ...performanceData };
      }

      if (selectedMetric === "relative_price") {
        const relativeData = Object.fromEntries(
          Object.entries(point.assets)
            .filter(([symbol]) => allAssetSymbols.includes(symbol))
            .map(([symbol, data]) => {
              const baseline = baselinePrices[symbol];
              if (!baseline) return [symbol, 0];
              const offset = startOffsets[symbol] || 0;
              return [symbol, ((data.price - baseline) / baseline) * 100 + offset];
            }),
        );
        return { ...baseData, ...relativeData };
      }

      const filteredAssets = Object.entries(point.assets);
      const lowPriceEntries = filteredAssets
        .filter(([symbol]) => lowPriceAssets.includes(symbol))
        .map(([symbol, data]) => [
          symbol,
          selectedMetric === "total_value"
            ? data.total_value
            : selectedMetric === "price"
              ? data.price
              : point.tri,
        ]);
      const highPriceEntries = filteredAssets
        .filter(([symbol]) => highPriceAssets.includes(symbol))
        .map(([symbol, data]) => [
          symbol + "_high",
          selectedMetric === "total_value"
            ? data.total_value
            : selectedMetric === "price"
              ? data.price
              : point.tri,
        ]);

      return {
        ...baseData,
        ...Object.fromEntries(lowPriceEntries),
        ...Object.fromEntries(highPriceEntries),
      };
    }

    // Single asset view
    const assetMetrics = point.assets[selectedAsset] as AssetMetrics | undefined;
    if (!assetMetrics) return baseData;

    const isHighPriceAsset = !usesSingleAxis && highPriceAssets.includes(selectedAsset);
    const assetKey = isHighPriceAsset ? selectedAsset + "_high" : selectedAsset;

    let value: number;
    switch (selectedMetric) {
      case "performance": {
        const assetSummary = summaryData.assets.find((a) => a.symbol === selectedAsset);
        value = assetSummary
          ? ((assetMetrics.total_value - assetSummary.cost_basis) / assetSummary.cost_basis) * 100
          : 0;
        break;
      }
      case "relative_price": {
        const baseline = baselinePrices[selectedAsset];
        const offset = startOffsets[selectedAsset] || 0;
        value = baseline ? ((assetMetrics.price - baseline) / baseline) * 100 + offset : 0;
        break;
      }
      case "total_value":
        value = assetMetrics.total_value;
        break;
      case "price":
        value = assetMetrics.price;
        break;
      case "tri":
        value = point.tri;
        break;
      default:
        value = 0;
    }

    return {
      ...baseData,
      [assetKey]: value,
    };
  });
  const activeData = selectedRange
    ? chartData.filter((p) => p.date >= selectedRange.startDate && p.date <= selectedRange.endDate)
    : chartData;
  const renderedData = activeData.length > 0 ? activeData : chartData;
  const currentTooltipIndex =
    hoveredIndex ?? (renderedData.length > 0 ? renderedData.length - 1 : null);
  // eslint-disable-next-line react-hooks/rules-of-hooks -- depends on chart transforms that only run after portfolio data is loaded (early return above)
  const dragRange = React.useMemo(() => {
    if (selectionStartIndex === null || currentTooltipIndex === null) return null;
    const start = Math.min(selectionStartIndex, currentTooltipIndex);
    const end = Math.max(selectionStartIndex, currentTooltipIndex);
    const startPoint = renderedData[start];
    const endPoint = renderedData[end];
    if (!startPoint || !endPoint) return null;
    return { start, end, startPoint, endPoint };
  }, [selectionStartIndex, currentTooltipIndex, renderedData]);

  const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  const assetsToShow =
    selectedAsset === ALL_ASSETS
      ? usesSingleAxis
        ? allAssetSymbols
        : [...lowPriceAssets, ...highPriceAssets.map((symbol) => symbol + "_high")]
      : usesSingleAxis
        ? [selectedAsset]
        : [selectedAsset + (highPriceAssets.includes(selectedAsset) ? "_high" : "")];

  const formatValue = (value: number) => {
    switch (selectedMetric) {
      case "performance":
      case "relative_price":
        return `${value.toFixed(2)}%`;
      case "price":
      case "total_value":
        return `€${value.toFixed(2)}`;
      case "tri":
        return value.toFixed(2);
      default:
        return value.toString();
    }
  };

  const formatTooltipDate = (date: string) =>
    new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Select value={selectedAsset} onValueChange={setSelectedAsset}>
          <SelectTrigger>
            <SelectValue placeholder="Select an asset to display..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ASSETS}>All Assets</SelectItem>
            {assetData.map(({ symbol }) => {
              const asset = summaryData.assets.find((a) => a.symbol === symbol);
              return (
                <SelectItem key={symbol} value={symbol}>
                  {asset?.name || symbol}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Select
          value={selectedMetric}
          onValueChange={(value: MetricType) => setSelectedMetric(value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select metric..." />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(METRIC_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ResponsiveContainer width="100%" height={300} className="select-none">
        <LineChart
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
          <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="left"
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatValue}
            domain={["auto", "auto"]}
          />
          {!usesSingleAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatValue}
              domain={["auto", "auto"]}
            />
          )}
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const baseKey = payload[0].dataKey?.toString() || "";
                const startValue = dragRange ? Number(dragRange.startPoint[baseKey] ?? 0) : 0;
                const currentValue = Number(payload[0].value ?? 0);
                return (
                  <Card className="p-3">
                    <p className="text-sm text-muted-foreground">{formatTooltipDate(label)}</p>
                    <div className="space-y-1 mt-1">
                      {dragRange && (
                        <div className="text-xs rounded-md border border-blue-200 bg-blue-50 p-2 mb-1 space-y-0.5">
                          <div className="font-medium text-blue-700">
                            Selected: {formatTooltipDate(dragRange.startPoint.date)} {"->"}{" "}
                            {formatTooltipDate(dragRange.endPoint.date)}
                          </div>
                          <div>
                            {METRIC_LABELS[selectedMetric]} diff:{" "}
                            <span
                              className={
                                currentValue - startValue >= 0 ? "text-green-700" : "text-red-700"
                              }
                            >
                              {formatSignedMetricValue(currentValue - startValue, selectedMetric)}
                            </span>
                          </div>
                        </div>
                      )}
                      {payload.map((entry, index) => {
                        const dataKey = entry.dataKey?.toString() || "";
                        const symbol = dataKey.replace("_high", "");
                        const asset = summaryData.assets.find((a) => a.symbol === symbol);
                        return (
                          <p key={index} className="text-sm" style={{ color: entry.color }}>
                            {`${asset?.name || symbol}: ${formatValue(Number(entry.value))}`}
                          </p>
                        );
                      })}
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
              fill="#3b82f6"
              fillOpacity={0.08}
            />
          )}
          {assetsToShow.map((symbol, index) => {
            const isHighPrice = !usesSingleAxis && symbol.endsWith("_high");
            return (
              <Line
                key={symbol}
                type="monotone"
                dataKey={symbol}
                yAxisId={isHighPrice ? "right" : "left"}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
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
