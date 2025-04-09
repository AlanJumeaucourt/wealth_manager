import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowDownRight, ArrowUpRight, BarChart3, DollarSign, PiggyBank, Leaf } from "lucide-react"
import { PortfolioSummary } from "@/types"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { PortfolioPerformance } from "@/api/queries"

interface PortfolioHighlightsProps {
  portfolioSummary?: PortfolioSummary
  performanceData?: PortfolioPerformance
}

export function PortfolioHighlights({ portfolioSummary, performanceData }: PortfolioHighlightsProps) {
  if (!portfolioSummary) {
    return null
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
            {formatPercent(payload[0].value)}
          </p>
        </div>
      )
    }
    return null
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
                  <div key={asset.symbol} className="flex items-center justify-between text-sm">
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
