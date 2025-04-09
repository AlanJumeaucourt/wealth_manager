import { API_URL, useStockHistory } from "@/api/queries"
import { CustomPriceDialog } from "@/components/investments/CustomPriceDialog"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { TimePeriod } from "@/types"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useParams } from "@tanstack/react-router"
import { format } from "date-fns"
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Building2,
  DollarSign,
  LineChart,
  PieChart,
  Wallet,
} from "lucide-react"
import { useState } from "react"
import {
  Area,
  AreaChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"

interface AssetTransaction {
  activity_type:
    | "Buy"
    | "Sell"
    | "Dividend"
    | "Interest"
    | "Deposit"
    | "Withdrawal"
  amount: number
  date: string
  fee: number
  id: number
  quantity: number
  tax: number
  total_paid: number
  unit_price: number
}

interface AssetInfo {
  currency: string
  current_price: number | null
  description: string
  exchange: string
  market_cap: number | null
  name: string
  previous_close: number
  symbol: string
  type: string
  volume: number
}

interface AssetDetails {
  actions?: {
    "Capital Gains": Record<string, number>
    Dividends: Record<string, number>
    "Stock Splits": Record<string, number>
  }
  calendar?: Record<string, any>
  dividends?: Record<string, number>
  fund_holding_info?: {
    bondPosition: number
    cashPosition: number
    convertiblePosition: number
    otherPosition: number
    preferredPosition: number
    stockPosition: number
  }
  fund_performance?: {
    categoryName: string | null
    family: string
    legalType: string
  }
  fund_profile?: {
    [key: string]: {
      "Annual Holdings Turnover": number
      "Annual Report Expense Ratio": number
      "Total Net Assets": number
    }
  }
  fund_sector_weightings?: Record<string, number>
  fund_top_holdings?: {
    "Holding Percent": Record<string, number>
    Name: Record<string, string>
  }
  info?: {
    currency: string
    exchange: string
    firstTradeDateEpochUtc: number
    fundFamily: string
    fundInceptionDate: number
    legalType: string
    longName: string
    navPrice: number
    shortName: string
    symbol: string
    totalAssets: number
    yield: number
    ytdReturn: number
  }
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
  "max": Infinity
}

export function InvestmentDetailPage() {
  const { symbol } = useParams({ from: "/investments/assets/$symbol" })
  const navigate = useNavigate()
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1Y")

  const { data: transactions } = useQuery<AssetTransaction[]>({
    queryKey: ["asset", symbol, "transactions"],
    queryFn: async () => {
      const token = localStorage.getItem("access_token")
      const response = await fetch(
        `${API_URL}/investments/assets/${symbol}/transactions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      if (!response.ok) throw new Error("Failed to fetch transactions")
      const data = await response.json()
      // Remove duplicate transactions (each transaction appears twice in the data)
      const uniqueTransactions = data.filter((transaction: AssetTransaction, index: number, self: AssetTransaction[]) =>
        index === self.findIndex((t) => t.id === transaction.id)
      )
      return uniqueTransactions
    },
  })

  const { data: assetInfo } = useQuery<AssetInfo>({
    queryKey: ["asset", symbol],
    queryFn: async () => {
      const token = localStorage.getItem("access_token")
      const response = await fetch(`${API_URL}/stocks/${symbol}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) throw new Error("Failed to fetch asset info")
      return response.json()
    },
  })

  const { data: assetDetails } = useQuery<AssetDetails>({
    queryKey: ["asset", symbol, "details"],
    queryFn: async () => {
      const token = localStorage.getItem("access_token")
      const response = await fetch(`${API_URL}/stocks/${symbol}/details`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) throw new Error("Failed to fetch asset details")
      return response.json()
    },
  })

  const { data: priceHistory } = useStockHistory(symbol)

  const filterDataByPeriod = (data: typeof priceHistory) => {
    if (!data) return []

    const sortedDataPoints = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    if (selectedPeriod === "max") return sortedDataPoints

    const days = periodToDays[selectedPeriod]
    const now = new Date()
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    return sortedDataPoints.filter(point => {
      const pointDate = new Date(point.date)
      return pointDate >= cutoffDate
    })
  }

  const filteredPriceHistory = filterDataByPeriod(priceHistory)
  const latestPrice = filteredPriceHistory?.[filteredPriceHistory.length - 1]
  const previousPrice = filteredPriceHistory?.[filteredPriceHistory.length - 2]
  const priceChange =
    latestPrice && previousPrice ? latestPrice.close - previousPrice.close : 0
  const priceChangePercentage =
    latestPrice && previousPrice ? (priceChange / previousPrice.close) * 100 : 0

  const formatDate = (date: string) => {
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year:
        selectedPeriod === "3Y" ||
        selectedPeriod === "5Y" ||
        selectedPeriod === "max"
          ? "numeric"
          : undefined,
    }
    return new Date(date).toLocaleDateString(undefined, options)
  }

  return (
    <PageContainer>
      <div className="space-y-6 p-6">
        {/* Header with Navigation and Title */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => navigate({ to: "/investments" })}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Investments
              </Button>
              <div className="text-muted-foreground">/</div>
              <div className="text-sm text-muted-foreground">
                {assetInfo?.symbol}
              </div>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {assetInfo?.name}
            </h1>
          </div>
        </div>

        {/* Add the custom price dialog component */}
        <CustomPriceDialog symbol={symbol} currency={assetInfo?.currency || "USD"} />

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm font-medium">Current Price</span>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-semibold">
                {new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency: assetInfo?.currency || "USD",
                }).format(latestPrice?.close || 0)}
              </div>
              <div
                className={cn(
                  "flex items-center gap-1 text-sm",
                  priceChange > 0 ? "text-green-500" : "text-red-500"
                )}
              >
                {priceChange > 0 ? (
                  <ArrowUp className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                )}
                {Math.abs(priceChange).toFixed(2)} (
                {Math.abs(priceChangePercentage).toFixed(2)}%)
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <Building2 className="h-4 w-4" />
              <span className="text-sm font-medium">Exchange</span>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-semibold">
                {assetInfo?.exchange}
              </div>
              <div className="text-sm text-muted-foreground">
                {assetInfo?.type}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <LineChart className="h-4 w-4" />
              <span className="text-sm font-medium">Volume</span>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-semibold">
                {new Intl.NumberFormat().format(assetInfo?.volume || 0)}
              </div>
              <div className="text-sm text-muted-foreground">24h Volume</div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <Wallet className="h-4 w-4" />
              <span className="text-sm font-medium">Previous Close</span>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-semibold">
                {new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency: assetInfo?.currency || "USD",
                }).format(assetInfo?.previous_close || 0)}
              </div>
              <div className="text-sm text-muted-foreground">Last Close</div>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Price Chart */}
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Price History</h2>
              <div className="flex items-center gap-4">
                <Select
                  value={selectedPeriod}
                  onValueChange={(value: TimePeriod) =>
                    setSelectedPeriod(value)
                  }
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(periodToDays).map(period => (
                      <SelectItem key={period} value={period}>
                        {period}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LineChart className="h-4 w-4" />
                  <span>{filteredPriceHistory?.length || 0} days</span>
                </div>
              </div>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={filteredPriceHistory || []}
                  margin={{ top: 10, right: 10, bottom: 0, left: 10 }}
                >
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.1}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tickFormatter={formatDate} />
                  <YAxis
                    tickFormatter={value =>
                      new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: assetInfo?.currency || "USD",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(value)
                    }
                    domain={[
                      (dataMin: number) => {
                        // Calculate the minimum value with 5% padding below
                        const min = Math.min(...filteredPriceHistory.map(d => d.close));
                        return min * 0.95;
                      },
                      (dataMax: number) => {
                        // Calculate the maximum value with 5% padding above
                        const max = Math.max(...filteredPriceHistory.map(d => d.close));
                        return max * 1.05;
                      }
                    ]}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const data = payload[0].payload

                      // Find transactions on this date
                      const dateTransactions = transactions?.filter(
                        t =>
                          new Date(t.date).toISOString().split("T")[0] ===
                          new Date(data.date).toISOString().split("T")[0]
                      )

                      return (
                        <div className="bg-background border rounded-lg shadow-lg p-3 space-y-2">
                          <div className="text-sm text-muted-foreground">
                            {formatDate(data.date)}
                          </div>
                          <div className="font-medium">
                            {new Intl.NumberFormat(undefined, {
                              style: "currency",
                              currency: assetInfo?.currency || "USD",
                            }).format(data.close)}
                          </div>
                          {dateTransactions?.map((t, i) => (
                            <div key={i} className="border-t pt-2 mt-2 text-sm">
                              <div
                                className={cn(
                                  "flex items-center gap-2",
                                  t.activity_type === "Buy"
                                    ? "text-green-500"
                                    : "text-red-500"
                                )}
                              >
                                {t.activity_type === "Buy" ? (
                                  <ArrowUp className="h-3 w-3" />
                                ) : (
                                  <ArrowDown className="h-3 w-3" />
                                )}
                                <span className="capitalize">
                                  {t.activity_type}
                                </span>
                              </div>
                              <div className="text-muted-foreground">
                                {t.quantity} shares @{" "}
                                {new Intl.NumberFormat(undefined, {
                                  style: "currency",
                                  currency: assetInfo?.currency || "USD",
                                }).format(t.unit_price)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorPrice)"
                  />
                  {/* Transaction markers - only show Buy/Sell transactions */}
                  {transactions?.filter(t => t.activity_type === "Buy" || t.activity_type === "Sell").map(transaction => {
                    // Find the closest price data point to the transaction date
                    const transactionDate = new Date(transaction.date)
                    const closestDataPoint = filteredPriceHistory?.length
                      ? filteredPriceHistory.reduce((prev, curr) => {
                          const prevDate = new Date(prev.date)
                          const currDate = new Date(curr.date)
                          const prevDiff = Math.abs(
                            prevDate.getTime() - transactionDate.getTime()
                          )
                          const currDiff = Math.abs(
                            currDate.getTime() - transactionDate.getTime()
                          )
                          return prevDiff < currDiff ? prev : curr
                        })
                      : null

                    if (!closestDataPoint) return null

                    return (
                      <ReferenceDot
                        key={`${transaction.id}-${transaction.activity_type}`}
                        x={closestDataPoint.date}
                        y={closestDataPoint.close}
                        r={4}
                        fill={
                          transaction.activity_type === "Buy"
                            ? "hsl(var(--success))"
                            : "hsl(var(--destructive))"
                        }
                        stroke="white"
                        strokeWidth={1}
                      />
                    )
                  })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Right Column - Asset Details */}
          <div className="space-y-6">
            {/* Fund Info */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Fund Information</h2>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-4">
                {assetDetails?.fund_profile?.[symbol] && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Annual Turnover
                      </span>
                      <span className="font-medium">
                        {(
                          assetDetails.fund_profile[symbol][
                            "Annual Holdings Turnover"
                          ] * 100
                        ).toFixed(2)}
                        %
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Expense Ratio
                      </span>
                      <span className="font-medium">
                        {(
                          assetDetails.fund_profile[symbol][
                            "Annual Report Expense Ratio"
                          ] * 100
                        ).toFixed(2)}
                        %
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Total Assets
                      </span>
                      <span className="font-medium">
                        {new Intl.NumberFormat(undefined, {
                          style: "currency",
                          currency: assetInfo?.currency || "USD",
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(
                          assetDetails.fund_profile[symbol]["Total Net Assets"]
                        )}
                      </span>
                    </div>
                  </>
                )}
                {assetDetails?.fund_holding_info && (
                  <div className="pt-4 border-t">
                    <div className="text-sm font-medium text-muted-foreground mb-3">
                      Asset Allocation
                    </div>
                    <div className="space-y-2">
                      {Object.entries(assetDetails.fund_holding_info)
                        .filter(([, value]) => value > 0)
                        .sort(([, a], [, b]) => b - a)
                        .map(([key, value]) => (
                          <div key={key} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="capitalize">
                                {key
                                  .replace(/([A-Z])/g, " $1")
                                  .trim()
                                  .toLowerCase()}
                              </span>
                              <span className="font-medium">
                                {(value * 100).toFixed(2)}%
                              </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${value * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Holdings */}
            {assetDetails?.fund_top_holdings && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">Top Holdings</h2>
                  <PieChart className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-4">
                  {Object.entries(
                    assetDetails.fund_top_holdings["Holding Percent"]
                  )
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([symbol, percentage]) => (
                      <div
                        key={symbol}
                        className="flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium">
                            {assetDetails?.fund_top_holdings?.["Name"]?.[
                              symbol
                            ] ?? symbol}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {symbol}
                          </div>
                        </div>
                        <div className="font-medium">
                          {(percentage * 100).toFixed(2)}%
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            )}

            {/* Sector Allocation */}
            {assetDetails?.fund_sector_weightings && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">Sector Allocation</h2>
                  <PieChart className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-4">
                  {Object.entries(assetDetails.fund_sector_weightings)
                    .sort(([, a], [, b]) => b - a)
                    .map(([sector, weight]) => (
                      <div key={sector} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="capitalize">
                            {sector.replace(/_/g, " ")}
                          </span>
                          <span className="font-medium">
                            {(weight * 100).toFixed(2)}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${weight * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Transactions and Dividends */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Transaction History</h2>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {transactions
              ?.sort(
                (a, b) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime()
              )
              .map(transaction => (
                <div
                  key={`${transaction.id}-${transaction.activity_type}`}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg",
                    transaction.activity_type === "Buy"
                      ? "bg-green-500/5 border border-green-500/20"
                      : transaction.activity_type === "Sell"
                      ? "bg-red-500/5 border border-red-500/20"
                      : "bg-primary/5 border border-primary/20"
                  )}
                >
                  <div
                    className={cn(
                      "p-2 rounded-full",
                      transaction.activity_type === "Buy"
                        ? "bg-green-500/10"
                        : transaction.activity_type === "Sell"
                        ? "bg-red-500/10"
                        : "bg-primary/10"
                    )}
                  >
                    {transaction.activity_type === "Buy" ? (
                      <ArrowUp className="h-4 w-4 text-green-500" />
                    ) : transaction.activity_type === "Sell" ? (
                      <ArrowDown className="h-4 w-4 text-red-500" />
                    ) : (
                      <DollarSign className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-2">
                    <div className="md:col-span-3">
                      <div className="text-xs text-muted-foreground font-medium">
                        {transaction.activity_type === "Dividend" ? "DIVIDEND" : transaction.activity_type.toUpperCase()} • {format(new Date(transaction.date), "MMM d, yyyy")}
                      </div>
                      <div className="font-medium">
                        {transaction.activity_type === "Dividend"
                          ? `Dividend Payment`
                          : `${transaction.activity_type === "Buy" ? "Bought" : "Sold"} ${transaction.quantity} shares`}
                      </div>
                    </div>
                    <div className="col-span-1 md:col-span-3 flex items-end justify-end space-x-2">
                      {transaction.activity_type === "Dividend" ? (
                        <>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Gross</div>
                            <div className="font-medium">
                              {new Intl.NumberFormat(undefined, {
                                style: "currency",
                                currency: assetInfo?.currency || "USD",
                              }).format(transaction.amount)}
                            </div>
                          </div>
                          {transaction.fee > 0 && (
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Fee</div>
                              <div className="font-medium text-red-500">
                                -{new Intl.NumberFormat(undefined, {
                                  style: "currency",
                                  currency: assetInfo?.currency || "USD",
                                }).format(transaction.fee)}
                              </div>
                            </div>
                          )}
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Net</div>
                            <div className="font-medium font-bold">
                              {new Intl.NumberFormat(undefined, {
                                style: "currency",
                                currency: assetInfo?.currency || "USD",
                              }).format(transaction.amount - transaction.fee)}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Price</div>
                            <div className="font-medium">
                              {new Intl.NumberFormat(undefined, {
                                style: "currency",
                                currency: assetInfo?.currency || "USD",
                              }).format(transaction.unit_price)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Total</div>
                            <div className="font-medium font-bold">
                              {new Intl.NumberFormat(undefined, {
                                style: "currency",
                                currency: assetInfo?.currency || "USD",
                              }).format(transaction.total_paid)}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            {(!transactions || transactions.length === 0) && (
              <div className="text-center py-6 text-muted-foreground">
                No transactions found
              </div>
            )}
          </div>
        </Card>
      </div>
    </PageContainer>
  )
}
