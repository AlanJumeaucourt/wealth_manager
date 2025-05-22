import { usePortfolioPerformance, usePortfolioSummary } from "@/api/queries"
import { AssetAllocationChart } from "@/components/investments/AssetAllocationChart"
import { AssetPerformanceChart } from "@/components/investments/AssetPerformanceChart"
import { AssetStatistics } from "@/components/investments/AssetStatistics"
import { PortfolioPerformanceChart } from "@/components/investments/PortfolioPerformanceChart"
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
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { TimePeriod } from "@/types"
import { useNavigate } from "@tanstack/react-router"
import {
  ArrowDown,
  ArrowUp,
  GiftIcon,
  PercentIcon,
  PieChart,
  Plus,
  TrendingUp,
} from "lucide-react"
import { useState } from "react"

export function InvestmentsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1Y")
  const { data: portfolioSummary, isLoading: isLoadingSummary } = usePortfolioSummary()
  const { data: performanceData, isLoading: isLoadingPerformance } = usePortfolioPerformance(selectedPeriod)
  const navigate = useNavigate()

  const lastUpdate = portfolioSummary?.last_update
    ? new Date(portfolioSummary.last_update).toLocaleString()
    : "Unknown"

  // Check if there's no investment data
  const hasNoInvestments = !isLoadingSummary && (!portfolioSummary ||
    !portfolioSummary.assets ||
    portfolioSummary.assets.length === 0 ||
    (portfolioSummary.total_value === 0 &&
     portfolioSummary.initial_investment === 0 &&
     portfolioSummary.net_investment === 0))

  // Handle adding first investment
  const handleAddFirstInvestment = () => {
    navigate({
      to: "/investmentTransactions",
      search: {
        addNew: "true"
      }
    })
  }

  const isLoading = isLoadingSummary || isLoadingPerformance

  // Empty state for no investments
  if (hasNoInvestments) {
    return (
      <PageContainer title="Investment Portfolio">
        <div className="flex flex-col items-center justify-center h-[70vh] text-center">
          <div className="bg-muted/30 p-6 rounded-full mb-6">
            <TrendingUp className="h-12 w-12 text-primary/60" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">No investments yet</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            Start tracking your investments by adding your first investment transaction.
          </p>
          <Button onClick={handleAddFirstInvestment}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Investment
          </Button>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title="Investment Portfolio"
      action={
        <p className="text-sm text-muted-foreground">
          Last updated: {lastUpdate}
        </p>
      }
    >
      <div className="space-y-6">
        {/* Portfolio Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {isLoading ? (
            <>
              <Card className="p-6">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-8 w-40" />
              </Card>
              <Card className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-28 mt-1" />
              </Card>
              <Card className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <div className="flex items-center gap-2 mt-2">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </Card>
              <Card className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <div className="flex items-center gap-2 mt-2">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-8 w-24" />
                </div>
                <Skeleton className="h-3 w-32 mt-1" />
              </Card>
            </>
          ) : (
            <>
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">
                  Total Portfolio Value
                </p>
                <p className="text-2xl font-semibold mt-2">
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: portfolioSummary?.currency ?? "EUR",
                  }).format(portfolioSummary?.total_value ?? 0)}
                </p>
              </Card>
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">Total Return</p>
                <p
                  className={cn(
                    "text-2xl font-semibold mt-2",
                    (portfolioSummary?.total_gain_loss ?? 0) > 0
                      ? "text-green-500"
                      : "text-red-500"
                  )}
                >
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: portfolioSummary?.currency ?? "EUR",
                    signDisplay: "always",
                  }).format(portfolioSummary?.total_gain_loss ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {portfolioSummary?.returns_include_dividends
                    ? "Including dividends"
                    : "Excluding dividends"}
                </p>
              </Card>
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">Return %</p>
                <div className="flex items-center gap-2 mt-2">
                  {(portfolioSummary?.total_gain_loss_percentage ?? 0) > 0 ? (
                    <ArrowUp className="h-5 w-5 text-green-500" />
                  ) : (
                    <ArrowDown className="h-5 w-5 text-red-500" />
                  )}
                  <p
                    className={cn(
                      "text-2xl font-semibold",
                      (portfolioSummary?.total_gain_loss_percentage ?? 0) > 0
                        ? "text-green-500"
                        : "text-red-500"
                    )}
                  >
                    {Math.abs(
                      portfolioSummary?.total_gain_loss_percentage ?? 0
                    ).toFixed(2)}
                    %
                  </p>
                </div>
              </Card>
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">Dividend Yield</p>
                <div className="flex items-center gap-2 mt-2">
                  <GiftIcon className="h-5 w-5 text-blue-500" />
                  <p className="text-2xl font-semibold text-blue-500">
                    {(portfolioSummary?.dividend_metrics?.portfolio_yield ?? 0) *
                      100}
                    %
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: portfolioSummary?.currency ?? "EUR",
                  }).format(
                    portfolioSummary?.dividend_metrics?.monthly_income_estimate ?? 0
                  )}{" "}
                  monthly est.
                </p>
              </Card>
            </>
          )}
        </div>

        {/* Investment & Metrics Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isLoading ? (
            <>
              <Card className="p-6">
                <Skeleton className="h-6 w-40 mb-4" />
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex justify-between items-center">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-6">
                <Skeleton className="h-6 w-40 mb-4" />
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <>
              <Card className="p-6">
                <div className="flex items-center mb-4">
                  <h2 className="text-lg font-semibold">Investment Summary</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Initial Investment
                    </span>
                    <span className="font-medium">
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: portfolioSummary?.currency ?? "EUR",
                      }).format(portfolioSummary?.initial_investment ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Net Investment</span>
                    <span className="font-medium">
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: portfolioSummary?.currency ?? "EUR",
                      }).format(portfolioSummary?.net_investment ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Withdrawals</span>
                    <span className="font-medium">
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: portfolioSummary?.currency ?? "EUR",
                      }).format(portfolioSummary?.total_withdrawals ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-muted-foreground">Total Gain/Loss</span>
                    <span
                      className={cn(
                        "font-semibold",
                        (portfolioSummary?.total_gain_loss ?? 0) > 0
                          ? "text-green-500"
                          : "text-red-500"
                      )}
                    >
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: portfolioSummary?.currency ?? "EUR",
                        signDisplay: "always",
                      }).format(portfolioSummary?.total_gain_loss ?? 0)}
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center mb-4">
                  <h2 className="text-lg font-semibold">Portfolio Metrics</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <PieChart className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Diversification Score
                      </span>
                    </div>
                    <span className="font-medium">
                      {portfolioSummary?.metrics?.diversification_score?.toFixed(
                        1
                      ) ?? 0}
                      /100
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <PercentIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Largest Position
                      </span>
                    </div>
                    <span className="font-medium">
                      {portfolioSummary?.metrics?.largest_position_percentage?.toFixed(
                        1
                      ) ?? 0}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <ArrowUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Total Dividends</span>
                    </div>
                    <span className="font-medium">
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: portfolioSummary?.currency ?? "EUR",
                      }).format(
                        portfolioSummary?.dividend_metrics
                          ?.total_dividends_received ?? 0
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <ArrowUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Dividend Growth (YoY)
                      </span>
                    </div>
                    <span
                      className={cn(
                        "font-medium",
                        (portfolioSummary?.dividend_metrics?.dividend_growth ?? 0) >
                          0
                          ? "text-green-500"
                          : "text-red-500"
                      )}
                    >
                      {(portfolioSummary?.dividend_metrics?.dividend_growth ?? 0) >
                      0
                        ? "+"
                        : ""}
                      {portfolioSummary?.dividend_metrics?.dividend_growth?.toFixed(
                        2
                      ) ?? 0}
                      %
                    </span>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Performance Chart */}
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-10 w-[100px]" />
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold">Portfolio Performance</h2>
                  <Select
                    value={selectedPeriod}
                    onValueChange={(value: TimePeriod) => setSelectedPeriod(value)}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1D">1D</SelectItem>
                      <SelectItem value="1W">1W</SelectItem>
                      <SelectItem value="1M">1M</SelectItem>
                      <SelectItem value="3M">3M</SelectItem>
                      <SelectItem value="6M">6M</SelectItem>
                      <SelectItem value="1Y">1Y</SelectItem>
                      <SelectItem value="3Y">3Y</SelectItem>
                      <SelectItem value="5Y">5Y</SelectItem>
                      <SelectItem value="max">Max</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
            {isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : (
              <PortfolioPerformanceChart period={selectedPeriod} />
            )}
          </Card>

          {/* Asset Allocation */}
          <Card className="p-6 h-[90vh]">
            {isLoading ? (
              <>
                <Skeleton className="h-6 w-40 mb-4" />
                <Skeleton className="h-[calc(90vh-8rem)] w-full" />
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-4">Asset Allocation</h2>
                <AssetAllocationChart />
              </>
            )}
          </Card>
        </div>

        {/* Asset Performance Chart */}
        <Card className="p-6">
          {isLoading ? (
            <>
              <Skeleton className="h-6 w-48 mb-4" />
              <Skeleton className="h-[400px] w-full" />
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-4">
                Individual Asset Performance
              </h2>
              <AssetPerformanceChart period={selectedPeriod} />
            </>
          )}
        </Card>

        {/* Detailed Asset Statistics */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            {isLoading ? (
              <>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-10 w-[100px]" />
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Asset Details</h2>
                <Button variant="outline" onClick={handleAddFirstInvestment}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Asset
                </Button>
              </>
            )}
          </div>
          {isLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : (
            <AssetStatistics />
          )}
        </Card>
      </div>
    </PageContainer>
  )
}
