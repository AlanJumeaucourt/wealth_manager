import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import * as React from "react"
import { useMemo } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"

interface Props {
  currentBalance: number
  balanceHistory?: Array<{ date: string; value: number }>
}

const timeRangeOptions = {
  "3m": 90,
  "1y": 365,
  "5y": 365 * 5,
  max: Infinity,
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
  let lastYearShown = 0 // Keep track of the last year we showed

  return (date: string, index: number) => {
    if (timeRange === "3m") return "" // No secondary label for 3m view

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
    year: "numeric",
  })
}

export function AccountBalanceChart({ currentBalance, balanceHistory }: Props) {
  const [timeRange, setTimeRange] = React.useState("3m")

  // Memoize all data transformations
  const {
    filteredData,
    yDomain,
    valueChange,
    mainAxisFormatter,
    secondaryAxisFormatter,
  } = useMemo(() => {
    if (!balanceHistory || !Array.isArray(balanceHistory))
      return {
        filteredData: [],
        yDomain: [0, 0] as [number, number],
        valueChange: 0,
        mainAxisFormatter: getMainAxisFormatter(timeRange),
        secondaryAxisFormatter: getSecondaryAxisFormatter(timeRange),
      }

    // Filter data based on time range
    const referenceDate = new Date(
      balanceHistory[balanceHistory.length - 1].date
    )
    const daysToSubtract =
      timeRangeOptions[timeRange as keyof typeof timeRangeOptions]

    const filteredData =
      timeRange === "max"
        ? balanceHistory
        : balanceHistory.filter(item => {
            const date = new Date(item.date)
            const startDate = new Date(referenceDate)
            startDate.setDate(startDate.getDate() - daysToSubtract)
            return date >= startDate
          })

    const visibleValues = filteredData.map(item => item.value)
    const minValue = Math.min(...visibleValues)
    const maxValue = Math.max(...visibleValues)
    const valueRange = maxValue - minValue

    const padding =
      timeRange === "3m"
        ? { top: valueRange * 0.1, bottom: valueRange * 0.1 }
        : timeRange === "1y"
          ? { top: valueRange * 0.15, bottom: valueRange * 0.075 }
          : { top: valueRange * 0.2, bottom: valueRange * 0.1 }

    const shouldStartFromZero = minValue > 0 && minValue < maxValue * 0.05
    const yDomain = [
      shouldStartFromZero ? 0 : minValue - padding.bottom,
      maxValue + padding.top,
    ] as [number, number]

    // Calculate value change based on filtered data
    const valueChange =
      currentBalance - (filteredData[0]?.value ?? currentBalance)

    return {
      filteredData,
      yDomain,
      valueChange,
      mainAxisFormatter: getMainAxisFormatter(timeRange),
      secondaryAxisFormatter: getSecondaryAxisFormatter(timeRange),
    }
  }, [balanceHistory, timeRange, currentBalance])

  if (!balanceHistory) {
    return (
      <Card>
        <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5">
          <div className="h-16 w-full animate-pulse bg-muted rounded" />
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="h-[250px] w-full animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle>Balance History</CardTitle>
          <CardDescription>
            Current:{" "}
            {new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: "EUR",
            }).format(currentBalance)}
            {" · "}
            Change:{" "}
            <span
              className={valueChange >= 0 ? "text-green-500" : "text-red-500"}
            >
              {valueChange >= 0 ? "+" : "-"}
              {new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: "EUR",
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
          <ResponsiveContainer
            width="99%"
            height="100%"
            style={{ overflowY: "hidden" }}
          >
            <AreaChart
              data={filteredData}
              margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
            >
              <defs>
                <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(210, 100%, 50%)" // Changed to a more vibrant blue
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(210, 100%, 50%)" // Changed to a more vibrant blue
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
                tickFormatter={value =>
                  new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: "EUR",
                  }).format(value)
                }
                width={80}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(210, 100%, 50%)" // Changed to a more vibrant blue
                fill="url(#fillValue)"
                strokeWidth={2}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    active={true}
                    payload={[
                      {
                        name: "Balance",
                        value: currentBalance,
                        payload: {
                          date: filteredData[filteredData.length - 1]?.date,
                        },
                      },
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
