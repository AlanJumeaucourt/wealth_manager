"use client"

import { useWealthOverTime } from "@/api/queries"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartTooltip,
  ChartTooltipContent
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import * as React from "react"
import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts"

const timeRangeOptions = {
  "3m": 90,
  "1y": 365,
  "5y": 365 * 5,
  "max": Infinity
} as const

function getMainAxisFormatter(timeRange: string) {
  switch (timeRange) {
    case "3m":
      return (date: string) => {
        return new Date(date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      }
    case "1y":
    case "5y":
      return (date: string) => {
        const d = new Date(date)
        return d.toLocaleDateString(undefined, { month: "short" })
      }
    case "max":
      return (date: string) => {
        return new Date(date).toLocaleDateString(undefined, { month: "short" })
      }
    default:
      return (date: string) => date
  }
}

function getSecondaryAxisFormatter(timeRange: string) {
  let lastYearShown = 0  // Keep track of the last year we showed

  return (date: string, index: number) => {
    if (timeRange === "3m") return ""  // No secondary label for 3m view

    const d = new Date(date)
    const year = d.getFullYear()

    // If we haven't shown this year yet, show it and update lastYearShown
    if (year !== lastYearShown) {
      lastYearShown = year
      return year.toString()
    }

    return ""
  }
}

function getTooltipFormatter(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  })
}

export function WealthChart() {
  const [timeRange, setTimeRange] = React.useState("3m")

  // Add the wealth data query
  const { data: wealthData, isLoading } = useWealthOverTime()

  // Show loading state or return null if no data
  if (isLoading) return <div>Loading...</div>
  if (!wealthData) return null

  // Convert the array data into a Record<string, number> format
  const data = Object.fromEntries(
    wealthData.map(point => [point.date, point.value])
  )

  // Memoize all data transformations
  const {
    dates,
    values,
    filteredData,
    yDomain,
    currentValue,
    valueChange,
    mainAxisFormatter,
    secondaryAxisFormatter
  } = useMemo(() => {
    const dates = Object.keys(data)
    const values = Object.values(data)
    const chartData = dates.map((date, index) => ({
      date,
      value: values[index],
    }))

    const referenceDate = new Date(dates[dates.length - 1])
    const daysToSubtract = timeRangeOptions[timeRange as keyof typeof timeRangeOptions]

    const filteredData = timeRange === "max"
      ? chartData
      : chartData.filter((item) => {
          const date = new Date(item.date)
          const startDate = new Date(referenceDate)
          startDate.setDate(startDate.getDate() - daysToSubtract)
          return date >= startDate
        })

    const visibleValues = filteredData.map(item => item.value)
    const minValue = Math.min(...visibleValues)
    const maxValue = Math.max(...visibleValues)
    const valueRange = maxValue - minValue

    const padding = timeRange === "3m"
      ? { top: valueRange * 0.1, bottom: valueRange * 0.1 }
      : timeRange === "1y"
      ? { top: valueRange * 0.15, bottom: valueRange * 0.075 }
      : { top: valueRange * 0.2, bottom: valueRange * 0.1 }

    const shouldStartFromZero = minValue < maxValue * 0.05
    const yDomain = [
      shouldStartFromZero ? 0 : minValue - padding.bottom,
      maxValue + padding.top
    ] as [number, number]

    // Calculate value change based on filtered data
    const currentValue = filteredData[filteredData.length - 1].value
    const valueChange = currentValue - filteredData[0].value

    return {
      dates,
      values,
      filteredData,
      yDomain,
      currentValue,
      valueChange,
      mainAxisFormatter: getMainAxisFormatter(timeRange),
      secondaryAxisFormatter: getSecondaryAxisFormatter(timeRange)
    }
  }, [data, timeRange])

  // Update the chartConfig to include blue colors
  const chartConfig = useMemo(() => {
    const isPositive = valueChange >= 0
    return {
      value: {
        label: "Wealth",
        color: "hsl(217, 91%, 60%)", // Bright blue
        gradientFrom: "hsl(217, 91%, 60%)",
        gradientTo: "hsl(217, 91%, 97%)" // Very light blue
      }
    }
  }, [valueChange])

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle>Wealth Evolution</CardTitle>
          <CardDescription>
            Current: {new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: 'EUR'
            }).format(Math.abs(currentValue))}
            {" · "}
            Change:{" "}
            <span className={valueChange >= 0 ? "text-green-500" : "text-red-500"}>
              {valueChange >= 0 ? '+' : '-'}
              {new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: 'EUR'
              }).format(Math.abs(valueChange))}
            </span>
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto"
            aria-label="Select time range"
          >
            <SelectValue placeholder="3 months" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="3m" className="rounded-lg">
              3 months
            </SelectItem>
            <SelectItem value="1y" className="rounded-lg">
              1 year
            </SelectItem>
            <SelectItem value="5y" className="rounded-lg">
              5 years
            </SelectItem>
            <SelectItem value="max" className="rounded-lg">
              Max
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%" style={{ overflowY: "hidden" }}>
            <AreaChart
              data={filteredData}
              margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
            >
              <defs>
                <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={chartConfig.value.gradientFrom}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor={chartConfig.value.gradientTo}
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                interval="preserveStartEnd"
                tickFormatter={mainAxisFormatter}
              />
              <YAxis
                domain={yDomain}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => new Intl.NumberFormat(undefined, {
                  style: 'currency',
                  currency: 'EUR',
                  notation: 'compact',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 1
                }).format(Math.abs(value))}
                width={80}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartConfig.value.color}
                fill="url(#fillValue)"
                strokeWidth={2}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    active={true}
                    payload={[
                      {
                        name: "Wealth",
                        value: currentValue,
                        payload: { date: filteredData[filteredData.length - 1]?.date }
                      }
                    ]}
                  />
                }
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
