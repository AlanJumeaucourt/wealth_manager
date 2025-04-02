import { usePortfolioPerformance } from "@/api/queries"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useState } from "react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type TimePeriod = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "ALL"

type MetricType = "performance" | "total_value" | "absolute_gain"

const metricLabels: Record<MetricType, string> = {
  performance: "Performance (%)",
  total_value: "Total Value (€)",
  absolute_gain: "Absolute Gain (€)",
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
  ALL: Infinity,
}

interface PortfolioPerformanceChartProps {
  period: TimePeriod
}

export function PortfolioPerformanceChart({
  period,
}: PortfolioPerformanceChartProps) {
  const { data: performanceData, isLoading } = usePortfolioPerformance()
  const [selectedMetric, setSelectedMetric] =
    useState<MetricType>("performance")
  const [showStacked, setShowStacked] = useState(false)

  const formatDate = (date: string) => {
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year:
        period === "3Y" || period === "5Y" || period === "ALL"
          ? "numeric"
          : undefined,
    }
    return new Date(date).toLocaleDateString(undefined, options)
  }

  const formatValue = (value: number) => {
    switch (selectedMetric) {
      case "performance":
        return `${value.toFixed(2)}%`
      case "total_value":
      case "absolute_gain":
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: "EUR",
        }).format(value)
    }
  }

  const filterDataByPeriod = (data: typeof performanceData) => {
    if (!data) return []

    // Sort data points by date first
    const sortedDataPoints = [...data.data_points].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    if (period === "ALL") return sortedDataPoints

    const days = periodToDays[period]
    const now = new Date()
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    return sortedDataPoints.filter(point => {
      const pointDate = new Date(point.date)
      return pointDate >= cutoffDate
    })
  }

  const transformDataForStackedView = (data: typeof performanceData) => {
    if (!data) return []

    const filteredData = filterDataByPeriod(data)

    // Transform data to include individual asset values
    return filteredData.map(point => {
      const transformedPoint: any = {
        date: point.date,
      }

      // Calculate total portfolio value for percentage calculations
      const totalValue = Object.values(point.assets).reduce(
        (sum, asset) => sum + asset.total_value,
        0
      )

      // Add individual asset values based on selected metric
      Object.entries(point.assets).forEach(([symbol, asset]) => {
        switch (selectedMetric) {
          case "total_value":
            transformedPoint[symbol] = asset.total_value
            break
          case "performance":
            // Calculate individual asset performance relative to cost basis
            const costBasis = asset.cost_basis_per_share || 0
            const currentPrice = asset.price
            if (costBasis > 0) {
              transformedPoint[symbol] =
                ((currentPrice - costBasis) / costBasis) * 100
            } else {
              transformedPoint[symbol] = 0
            }
            break
          case "absolute_gain":
            // Calculate individual asset absolute gain
            const gain =
              (asset.price - (asset.cost_basis_per_share || 0)) * asset.quantity
            transformedPoint[symbol] = gain
            break
        }
      })

      return transformedPoint
    })
  }

  if (isLoading) {
    return <Skeleton className="w-full h-[400px]" />
  }

  if (!performanceData) {
    return null
  }

  const chartData = showStacked
    ? transformDataForStackedView(performanceData)
    : filterDataByPeriod(performanceData)

  // Get unique asset symbols for stacked view
  const assetSymbols = showStacked
    ? Array.from(
        new Set(
          performanceData.data_points.flatMap(point =>
            Object.keys(point.assets)
          )
        )
      )
    : []

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
  ]

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
            <Switch
              checked={showStacked}
              onCheckedChange={setShowStacked}
              id="stacked-view"
            />
            <label htmlFor="stacked-view" className="text-sm">
              Show Asset Breakdown
            </label>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={chartData}>
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
                const data = payload[0].payload
                return (
                  <Card className="p-2">
                    <p className="text-sm text-muted-foreground">
                      {formatDate(data.date)}
                    </p>
                    {showStacked ? (
                      <>
                        <p className="font-medium">
                          Total:{" "}
                          {formatValue(
                            payload.reduce(
                              (sum, item) => sum + (Number(item.value) || 0),
                              0
                            )
                          )}
                        </p>
                        {payload.map(item => (
                          <p
                            key={item.dataKey}
                            className="text-sm text-muted-foreground"
                          >
                            {item.dataKey}:{" "}
                            {formatValue(Number(item.value) || 0)}
                          </p>
                        ))}
                      </>
                    ) : (
                      <>
                        <p className="font-medium">
                          {metricLabels[selectedMetric]}:{" "}
                          {formatValue(data[selectedMetric])}
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
                  </Card>
                )
              }
              return null
            }}
          />
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
              />
              {selectedMetric === "total_value" && (
                <Area
                  type="monotone"
                  dataKey="net_invested"
                  stroke="#888888"
                  fill="none"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )}
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
