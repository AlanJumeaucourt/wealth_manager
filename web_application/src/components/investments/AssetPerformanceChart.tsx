import { usePortfolioPerformance, usePortfolioSummary } from "@/api/queries"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { TimePeriod } from "@/types"
import { useState } from "react"
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type MetricType =
  | "price"
  | "total_value"
  | "performance"
  | "tri"
  | "cost_basis_comparison"

interface AssetPerformanceChartProps {
  period: TimePeriod
}

const ALL_ASSETS = "all_assets" as const

const METRIC_LABELS: Record<MetricType, string> = {
  price: "Price per Share",
  total_value: "Total Value",
  performance: "Performance (%)",
  tri: "Total Return Index",
  cost_basis_comparison: "Price vs Cost Basis",
}

interface AssetData {
  symbol: string
  price: number
}

interface AssetMetrics {
  price: number
  shares: number
  total_value: number
  cost_basis_per_share: number
}

export function AssetPerformanceChart({ period }: AssetPerformanceChartProps) {
  const { data: performanceData, isLoading: isLoadingPerformance } =
    usePortfolioPerformance()
  const { data: summaryData, isLoading: isLoadingSummary } =
    usePortfolioSummary()
  const [selectedAsset, setSelectedAsset] = useState<string>(ALL_ASSETS)
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("price")

  if (isLoadingPerformance || isLoadingSummary) {
    return <Skeleton className="w-full h-[300px]" />
  }

  if (!performanceData?.data_points || !summaryData?.assets) return null

  // Get available assets from summary and sort them by price range
  const assetData: AssetData[] = summaryData.assets
    .filter(asset => asset.shares > 0)
    .map(asset => ({
      symbol: asset.symbol,
      price:
        performanceData.data_points[performanceData.data_points.length - 1]
          ?.assets[asset.symbol]?.price || 0,
    }))
    .sort((a, b) => a.price - b.price)

  const highPriceThreshold = 100 // Threshold to determine high-price assets
  const lowPriceAssets = assetData
    .filter(asset => asset.price <= highPriceThreshold)
    .map(asset => asset.symbol)
  const highPriceAssets = assetData
    .filter(asset => asset.price > highPriceThreshold)
    .map(asset => asset.symbol)

  // Transform data for individual asset performance
  const chartData = performanceData.data_points.map(point => {
    const baseData = { date: point.date }

    // Add global metrics if showing all assets
    if (selectedAsset === ALL_ASSETS) {
      if (selectedMetric === "performance") {
        const performanceData = Object.fromEntries(
          Object.entries(point.assets)
            .filter(
              ([symbol]) =>
                lowPriceAssets.includes(symbol) ||
                highPriceAssets.includes(symbol)
            )
            .map(([symbol, data]) => {
              // Get the asset's cost basis from summary data
              const assetSummary = summaryData.assets.find(
                a => a.symbol === symbol
              )
              if (!assetSummary) return [symbol, 0]
              const isHighPrice = highPriceAssets.includes(symbol)
              return [
                isHighPrice ? symbol + "_high" : symbol,
                ((data.total_value - assetSummary.cost_basis) /
                  assetSummary.cost_basis) *
                  100,
              ]
            })
        )
        return {
          ...baseData,
          ...performanceData,
        }
      }

      const filteredAssets = Object.entries(point.assets)
      const lowPriceEntries = filteredAssets
        .filter(([symbol]) => lowPriceAssets.includes(symbol))
        .map(([symbol, data]) => [
          symbol,
          selectedMetric === "total_value"
            ? data.total_value
            : selectedMetric === "price"
              ? data.price
              : point.tri,
        ])
      const highPriceEntries = filteredAssets
        .filter(([symbol]) => highPriceAssets.includes(symbol))
        .map(([symbol, data]) => [
          symbol + "_high",
          selectedMetric === "total_value"
            ? data.total_value
            : selectedMetric === "price"
              ? data.price
              : point.tri,
        ])

      return {
        ...baseData,
        ...Object.fromEntries(lowPriceEntries),
        ...Object.fromEntries(highPriceEntries),
      }
    }

    // Add metrics for single asset
    const assetData = point.assets[selectedAsset] as AssetMetrics | undefined
    if (!assetData) return baseData

    const isHighPriceAsset = highPriceAssets.includes(selectedAsset)
    const assetKey = isHighPriceAsset ? selectedAsset + "_high" : selectedAsset

    let value: number
    switch (selectedMetric) {
      case "performance": {
        const assetSummary = summaryData.assets.find(
          a => a.symbol === selectedAsset
        )
        value = assetSummary
          ? ((assetData.total_value - assetSummary.cost_basis) /
              assetSummary.cost_basis) *
            100
          : 0
        break
      }
      case "total_value":
        value = assetData.total_value
        break
      case "price":
        value = assetData.price
        break
      case "tri":
        value = point.tri
        break
      default:
        value = 0
    }

    return {
      ...baseData,
      [assetKey]: value,
    }
  })

  const COLORS = [
    "#22c55e",
    "#3b82f6",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
  ]

  // Show selected asset or all assets if ALL_ASSETS is selected
  const assetsToShow =
    selectedAsset === ALL_ASSETS
      ? [...lowPriceAssets, ...highPriceAssets.map(symbol => symbol + "_high")]
      : [
          selectedAsset +
            (highPriceAssets.includes(selectedAsset) ? "_high" : ""),
        ]

  const formatValue = (value: number) => {
    switch (selectedMetric) {
      case "performance":
        return `${value.toFixed(2)}%`
      case "price":
      case "total_value":
        return `€${value.toFixed(2)}`
      case "tri":
        return value.toFixed(2)
      default:
        return value.toString()
    }
  }

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
              const asset = summaryData.assets.find(a => a.symbol === symbol)
              return (
                <SelectItem key={symbol} value={symbol}>
                  {asset?.name || symbol}
                </SelectItem>
              )
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

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <XAxis
            dataKey="date"
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          {/* Left Y-axis for low-price assets */}
          <YAxis
            yAxisId="left"
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatValue}
            domain={["auto", "auto"]}
          />
          {/* Right Y-axis for high-price assets */}
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
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <Card className="p-2">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    {payload.map((entry, index) => {
                      const dataKey = entry.dataKey?.toString() || ""
                      const isHighPrice = dataKey.endsWith("_high")
                      const symbol = dataKey.replace("_high", "")
                      const asset = summaryData.assets.find(
                        a => a.symbol === symbol
                      )
                      return (
                        <p
                          key={index}
                          className="text-sm"
                          style={{ color: entry.color }}
                        >
                          {`${asset?.name || symbol}: ${formatValue(
                            Number(entry.value)
                          )}`}
                        </p>
                      )
                    })}
                  </Card>
                )
              }
              return null
            }}
          />
          {assetsToShow.map((symbol, index) => {
            const isHighPrice = symbol.endsWith("_high")
            return (
              <Line
                key={symbol}
                type="monotone"
                dataKey={symbol}
                yAxisId={isHighPrice ? "right" : "left"}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
