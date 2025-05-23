import { PortfolioPerformance } from "@/api/queries"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PortfolioSummary } from "@/types"
import { ArrowDownRight, ArrowUpRight, BarChart3, DollarSign, Leaf, LineChart as LineChartIcon, PiggyBank, PlusCircle } from "lucide-react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface PortfolioHighlightsProps {
  portfolioSummary?: PortfolioSummary
  performanceData?: PortfolioPerformance
  onAssetClick?: (assetId: number, assetName?: string) => void
  isLoading?: boolean
}

export function PortfolioHighlights({ portfolioSummary, performanceData, onAssetClick, isLoading }: PortfolioHighlightsProps) {
  // Show loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">
            <Skeleton className="h-6 w-48" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3 bg-muted/40 rounded-lg">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </div>
                <Skeleton className="h-6 w-32 mt-1" />
                <Skeleton className="h-4 w-24 mt-1" />
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Skeleton className="h-[200px] w-full" />
          </div>
          <div className="mt-4">
            <Skeleton className="h-5 w-32 mb-3" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <div>
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16 mt-1" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show empty state when no portfolio data is available
  if (!portfolioSummary || !portfolioSummary.assets || portfolioSummary.assets.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Investment Portfolio</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center text-center py-6">
            <div className="bg-primary/10 p-4 rounded-full mb-4">
              <LineChartIcon className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">No investments yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Start building your investment portfolio to track your performance and returns.
            </p>
            <Button onClick={() => window.location.href = "/investments/add"} className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Add Investment
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: portfolioSummary?.currency || "EUR",
    }).format(Math.abs(amount))
  }

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  // Format date for tooltip
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Get performance chart data from performance data if available
  const chartData = performanceData?.data_points?.map((point) => ({
    date: point.date,
    value: point.total_gains
  })) || []

  const isPositiveReturn = (portfolioSummary?.total_gain_loss || 0) >= 0

  // Custom tooltip component for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border shadow-sm rounded-lg p-2 text-xs">
          <p className="font-medium">{formatDate(payload[0].payload.date)}</p>
          <p className={`${payload[0].value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {payload[0].value >= 0 ? "+" : ""}
            {payload[0].value} €
          </p>
        </div>
      )
    }
    return null
  }

  const handleAssetClick = (symbol: string, assetName?: string) => {
    if (onAssetClick) {
      onAssetClick(0, symbol);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Investment Portfolio</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Portfolio Value */}
          <div className="p-3 bg-muted/40 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Portfolio Value</p>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold mt-1">
              {formatCurrency(portfolioSummary.total_value)}
            </p>
          </div>

          {/* Total Return */}
          <div className="p-3 bg-muted/40 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Total Return</p>
              {isPositiveReturn ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
            </div>
            <p className={`text-lg font-semibold mt-1 ${
              isPositiveReturn ? "text-green-500" : "text-red-500"
            }`}>
              {formatCurrency(portfolioSummary.total_gain_loss)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatPercent(portfolioSummary.total_gain_loss_percentage)}
            </p>
          </div>

          {/* Dividend Yield */}
          <div className="p-3 bg-muted/40 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Dividend Yield</p>
              <Leaf className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold mt-1">
              {formatPercent(portfolioSummary.dividend_metrics.portfolio_yield)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(portfolioSummary.dividend_metrics.monthly_income_estimate)} monthly
            </p>
          </div>

          {/* Diversification */}
          <div className="p-3 bg-muted/40 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Diversification</p>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold mt-1">
              {portfolioSummary.metrics.number_of_positions} assets
            </p>
            <p className="text-xs text-muted-foreground">
              {portfolioSummary.metrics.diversification_score.toFixed(1)}/10 score
            </p>
          </div>
        </div>

        {/* Performance Chart */}
        {chartData.length > 0 && (
          <div className="mt-4 h-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="colorPerformance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="hsl(217, 91%, 97%)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide={true} />
                <YAxis hide={true} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={isPositiveReturn ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)"}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Holdings */}
        {portfolioSummary.assets.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-3">Top Holdings</h4>
            <div className="space-y-2">
              {portfolioSummary.assets
                .sort((a, b) => b.current_value - a.current_value)
                .slice(0, 3)
                .map((asset) => (
                  <div
                    key={asset.symbol}
                    className="flex items-center justify-between text-sm hover:bg-muted/50 p-2 rounded-lg cursor-pointer transition-colors"
                    onClick={() => handleAssetClick(asset.symbol, asset.name)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-center gap-2">
                      <div className="bg-primary/10 p-1 rounded-md">
                        <PiggyBank className="h-3 w-3 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">{asset.symbol}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(asset.current_value)}</p>
                      <p className={`text-xs ${
                        asset.gain_loss_percentage >= 0 ? "text-green-500" : "text-red-500"
                      }`}>
                        {formatPercent(asset.gain_loss_percentage)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
