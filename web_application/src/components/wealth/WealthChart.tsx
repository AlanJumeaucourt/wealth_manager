"use client"

import { useWealthOverTime } from "@/api/queries"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import * as React from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface WealthChartProps {
  startDate: Date;
  endDate: Date;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border bg-background p-2 shadow-sm">
      <div className="text-xs text-muted-foreground">
        {new Date(label).toLocaleDateString('fr-FR', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })}
      </div>
      <div className="text-sm font-medium">
        {new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(payload[0].value)}
      </div>
    </div>
  )
}

export function WealthChart({ startDate, endDate }: WealthChartProps) {
  const { data: wealthData, isLoading } = useWealthOverTime()

  const chartConfig = React.useMemo(() => ({
    value: {
      label: "Wealth",
      color: "hsl(217, 91%, 60%)", // Bright blue
      gradientFrom: "hsl(217, 91%, 60%)",
      gradientTo: "hsl(217, 91%, 97%)" // Very light blue
    }
  }), [])

  // Show loading state or return null if no data
  if (isLoading) return <div>Loading...</div>
  if (!wealthData) return null

  // Convert the array data into a Record<string, number> format
  const data = Object.fromEntries(
    wealthData.map(point => [point.date, point.value])
  )

  // Filter and transform data
  const dates = Object.keys(data)
  const values = Object.values(data)
  const chartData = dates.map((date, index) => ({
    date,
    value: values[index],
  }))

  // Filter data based on provided date range
  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date)
    return date >= startDate && date <= endDate
  })

  const visibleValues = filteredData.map(item => item.value)
  const minValue = Math.min(...visibleValues)
  const maxValue = Math.max(...visibleValues)
  const valueRange = maxValue - minValue
  const padding = { top: valueRange * 0.1, bottom: valueRange * 0.1 }

  const shouldStartFromZero = minValue < maxValue * 0.05
  const yDomain = [
    shouldStartFromZero ? 0 : minValue - padding.bottom,
    maxValue + padding.top
  ] as [number, number]

  const currentValue = filteredData[filteredData.length - 1]?.value || 0
  const valueChange = currentValue - (filteredData[0]?.value || 0)

  return (
    <Card>
      <CardHeader className="pb-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Wealth Evolution</CardTitle>
            <CardDescription className="mt-1">
              Current:{" "}
              <span className="font-medium">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                }).format(currentValue)}
              </span>
              {" · "}
              Change:{" "}
              <span className={valueChange >= 0 ? "text-green-500" : "text-red-500"}>
                {valueChange >= 0 ? '+' : ''}
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                }).format(valueChange)}
              </span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={filteredData}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <defs>
                <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={chartConfig.value.gradientFrom}
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor={chartConfig.value.gradientTo}
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
                tickFormatter={(date) => new Date(date).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short'
                })}
                stroke="#9CA3AF"
              />
              <YAxis
                domain={yDomain}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  notation: 'compact',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 1
                }).format(value)}
                width={80}
                stroke="#9CA3AF"
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartConfig.value.color}
                fill="url(#fillValue)"
                strokeWidth={2}
              />
              <Tooltip
                content={<CustomTooltip />}
                wrapperStyle={{ outline: 'none' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
