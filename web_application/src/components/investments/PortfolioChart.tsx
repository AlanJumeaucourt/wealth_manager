import { usePortfolioPerformance } from "@/api/queries"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type TimePeriod = "1M" | "3M" | "1Y" | "3Y" | "5Y"

interface PortfolioChartProps {
  period: TimePeriod
}

export function PortfolioChart({ period }: PortfolioChartProps) {
  // Convert TimePeriod to API period format
  const periodMap: Record<TimePeriod, "1M" | "3M" | "1Y" | "3Y" | "5Y"> = {
    "1M": "1M",
    "3M": "3M",
    "1Y": "1Y",
    "3Y": "3Y",
    "5Y": "5Y",
  }

  const { data: performanceData, isLoading } = usePortfolioPerformance(
    periodMap[period]
  )

  const formatDate = (date: string) => {
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: period === "3Y" || period === "5Y" ? "numeric" : undefined,
    }
    return new Date(date).toLocaleDateString(undefined, options)
  }

  if (isLoading) {
    return <Skeleton className="w-full h-full" />
  }

  if (!performanceData) {
    return null
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={performanceData.data_points.map(point => ({
          date: point.date,
          value:
            ((point.absolute_gain + point.total_value) / point.total_value) *
              100 -
            100,
        }))}
      >
        <XAxis
          dataKey="date"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatDate}
          interval={
            period === "1M" ? 6 : period === "3M" ? 14 : period === "1Y" ? 8 : 6
          }
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={value => `€${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <Card className="p-2">
                  <p className="text-sm text-muted-foreground">
                    {formatDate(payload[0].payload.date)}
                  </p>
                  <p className="font-medium">
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                    }).format(payload[0].value as number)}
                  </p>
                </Card>
              )
            }
            return null
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#008000"
          strokeWidth={2}
          dot={false}
          fill="#008000"
          fillOpacity={0.1}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
