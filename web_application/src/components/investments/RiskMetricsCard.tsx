import { usePortfolioRiskMetrics } from "@/api/queries"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"
import { AlertTriangle } from "lucide-react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function RiskMetricsCard() {
  const { data, isLoading, error } = usePortfolioRiskMetrics()

  if (isLoading) {
    return <Card>
      <CardHeader>
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-4 w-[300px]" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <Skeleton className="h-[200px]" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  }

  if (error) {
    return <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>Failed to load risk metrics</AlertDescription>
    </Alert>
  }

  if (!data) return null

  const sortedRollingMetrics = data.rolling_metrics
    ? [...data.rolling_metrics].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    : []

  const sortedAssetsByRisk = data.risk_metrics_by_asset
    ? Object.entries(data.risk_metrics_by_asset)
        .sort(([, a], [, b]) => b.max_drawdown - a.max_drawdown)
    : []

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Portfolio Risk Analysis</CardTitle>
        <CardDescription>
          Detailed risk metrics and performance analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rolling">Rolling Metrics</TabsTrigger>
            <TabsTrigger value="assets">Asset Risk</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Portfolio Sharpe Ratio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.sharpe_ratio.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Risk-adjusted return measure
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Maximum Drawdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">
                    {data.max_drawdown.toFixed(2)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Largest peak-to-trough decline
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rolling">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Rolling Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={sortedRollingMetrics}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => format(new Date(date), 'MMM d')}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                      formatter={(value: number) => [value.toFixed(2)]}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="sharpe_ratio"
                      stroke="#10b981"
                      name="Sharpe Ratio"
                      dot={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="volatility"
                      stroke="#6366f1"
                      name="Volatility"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assets">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Asset Risk Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sortedAssetsByRisk.map(([symbol, metrics]) => (
                    <div key={symbol} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{symbol}</p>
                        <p className="text-sm text-muted-foreground">
                          Risk Contribution: {metrics.contribution_to_risk.toFixed(2)}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-red-500">
                          {metrics.max_drawdown.toFixed(2)}%
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Max Drawdown
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
