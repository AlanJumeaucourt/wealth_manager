import { usePortfolioPerformance, usePortfolioSummary } from "@/api/queries";
import { AssetAllocationChart } from "@/components/investments/AssetAllocationChart";
import { AssetPerformanceChart } from "@/components/investments/AssetPerformanceChart";
import { AssetStatistics } from "@/components/investments/AssetStatistics";
import { PortfolioPerformanceChart } from "@/components/investments/PortfolioPerformanceChart";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TimePeriod } from "@/types";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, GiftIcon, Plus, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function InvestmentsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1Y");
  const [selectedDateRange, setSelectedDateRange] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);
  const { data: portfolioSummary, isLoading: isLoadingSummary } = usePortfolioSummary();
  const { isLoading: isLoadingPerformance } = usePortfolioPerformance(selectedPeriod);
  const navigate = useNavigate();

  useEffect(() => {
    setSelectedDateRange(null);
  }, [selectedPeriod]);

  // Current holdings only: cost basis of what you still hold, and return on that
  const currentHoldingsMetrics = useMemo(() => {
    const assets = portfolioSummary?.assets ?? [];
    const costBasis = assets.reduce((s, a) => s + (a.cost_basis ?? 0), 0);
    const currentValue = portfolioSummary?.total_value ?? 0;
    const unrealizedGain = currentValue - costBasis;
    const returnPct = costBasis > 0 ? (unrealizedGain / costBasis) * 100 : 0;
    return { costBasis, unrealizedGain, returnPct };
  }, [portfolioSummary?.assets, portfolioSummary?.total_value]);

  const lastUpdate = portfolioSummary?.last_update
    ? new Date(portfolioSummary.last_update).toLocaleString()
    : "Unknown";

  // Check if there's no investment data
  const hasNoInvestments =
    !isLoadingSummary &&
    (!portfolioSummary ||
      !portfolioSummary.assets ||
      portfolioSummary.assets.length === 0 ||
      (portfolioSummary.total_value === 0 &&
        portfolioSummary.initial_investment === 0 &&
        portfolioSummary.net_investment === 0));

  // Handle adding first investment
  const handleAddFirstInvestment = () => {
    void navigate({
      to: "/investmentTransactions",
      search: {
        addNew: "true",
      },
    });
  };

  const isLoading = isLoadingSummary || isLoadingPerformance;

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
    );
  }

  return (
    <PageContainer
      title="Investment Portfolio"
      action={<p className="text-sm text-muted-foreground">Last updated: {lastUpdate}</p>}
    >
      <div className="space-y-6">
        {/* Portfolio Stats */}
        <div className="space-y-4">
          {isLoading ? (
            <Card className="p-6">
              <Skeleton className="h-4 w-32 mb-3" />
              <Skeleton className="h-10 w-48 mb-6" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-6 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
              <div className="space-y-5">
                {/* Primary value */}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total Portfolio Value
                  </p>
                  <p className="mt-1.5 text-3xl md:text-4xl font-semibold tracking-tight">
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: portfolioSummary?.currency ?? "EUR",
                    }).format(portfolioSummary?.total_value ?? 0)}
                  </p>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border/40">
                  {/* Net Invested */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium uppercase tracking-wide">
                        Net Invested
                      </span>
                    </div>
                    <p className="text-lg font-semibold">
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: portfolioSummary?.currency ?? "EUR",
                      }).format(portfolioSummary?.net_investment ?? 0)}
                    </p>
                  </div>

                  {/* Total Return (since inception) */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      {(portfolioSummary?.total_gain_loss ?? 0) >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      <span className="text-xs font-medium uppercase tracking-wide">
                        Total Return
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-lg font-semibold",
                        (portfolioSummary?.total_gain_loss ?? 0) >= 0
                          ? "text-emerald-600"
                          : "text-red-500",
                      )}
                    >
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: portfolioSummary?.currency ?? "EUR",
                        signDisplay: "always",
                      }).format(portfolioSummary?.total_gain_loss ?? 0)}
                    </p>
                    <p
                      className={cn(
                        "text-xs font-medium",
                        (portfolioSummary?.total_gain_loss_percentage ?? 0) >= 0
                          ? "text-emerald-600"
                          : "text-red-500",
                      )}
                    >
                      {(portfolioSummary?.total_gain_loss_percentage ?? 0) >= 0 ? "+" : ""}
                      {(portfolioSummary?.total_gain_loss_percentage ?? 0).toFixed(2)}%
                      <span className="text-muted-foreground font-normal ml-1">
                        since inception
                      </span>
                    </p>
                  </div>

                  {/* Unrealized P/L (current holdings) */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      {currentHoldingsMetrics.unrealizedGain >= 0 ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                      <span className="text-xs font-medium uppercase tracking-wide">
                        Unrealized P/L
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-lg font-semibold",
                        currentHoldingsMetrics.unrealizedGain >= 0
                          ? "text-emerald-600"
                          : "text-red-500",
                      )}
                    >
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: portfolioSummary?.currency ?? "EUR",
                        signDisplay: "always",
                      }).format(currentHoldingsMetrics.unrealizedGain)}
                    </p>
                    <p
                      className={cn(
                        "text-xs font-medium",
                        currentHoldingsMetrics.returnPct >= 0 ? "text-emerald-600" : "text-red-500",
                      )}
                    >
                      {currentHoldingsMetrics.returnPct >= 0 ? "+" : ""}
                      {currentHoldingsMetrics.returnPct.toFixed(2)}%
                      <span className="text-muted-foreground font-normal ml-1">on holdings</span>
                    </p>
                  </div>

                  {/* Dividend Yield */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <GiftIcon className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium uppercase tracking-wide">
                        Dividend Yield
                      </span>
                    </div>
                    <p className="text-lg font-semibold text-blue-500">
                      {((portfolioSummary?.dividend_metrics?.portfolio_yield ?? 0) * 100).toFixed(
                        1,
                      )}
                      %
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: portfolioSummary?.currency ?? "EUR",
                      }).format(
                        portfolioSummary?.dividend_metrics?.monthly_income_estimate ?? 0,
                      )}{" "}
                      /mo est.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
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
              <PortfolioPerformanceChart
                period={selectedPeriod}
                selectedRange={selectedDateRange}
                onSelectedRangeChange={setSelectedDateRange}
              />
            )}
          </Card>

          {/* Asset Allocation */}
          <Card className="p-6 flex flex-col">
            {isLoading ? (
              <>
                <Skeleton className="h-6 w-40 mb-4" />
                <Skeleton className="h-[280px] w-full" />
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">Asset Allocation</h2>
                  <span className="text-xs text-muted-foreground">
                    {portfolioSummary?.assets?.filter((a) => a.current_value > 0).length ?? 0}{" "}
                    holdings
                  </span>
                </div>
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
              <h2 className="text-lg font-semibold mb-4">Individual Asset Performance</h2>
              <AssetPerformanceChart
                period={selectedPeriod}
                selectedRange={selectedDateRange}
                onSelectedRangeChange={setSelectedDateRange}
              />
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
          {isLoading ? <Skeleton className="h-[400px] w-full" /> : <AssetStatistics />}
        </Card>
      </div>
    </PageContainer>
  );
}
