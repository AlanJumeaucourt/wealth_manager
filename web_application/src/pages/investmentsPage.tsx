import { usePortfolioSummary } from "@/api/queries"
import { AssetAllocationChart } from "@/components/investments/AssetAllocationChart"
import { AssetPerformanceChart } from "@/components/investments/AssetPerformanceChart"
import { AssetStatistics } from "@/components/investments/AssetStatistics"
import { PerformanceMetrics } from "@/components/investments/PerformanceMetrics"
import { PortfolioPerformanceChart } from "@/components/investments/PortfolioPerformanceChart"
import { RiskMetricsCard } from "@/components/investments/RiskMetricsCard"
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
import { ArrowDown, ArrowUp, Plus } from "lucide-react"
import { useState } from "react"

type TimePeriod = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "max"

export function InvestmentsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1Y")
  const { data: portfolioSummary } = usePortfolioSummary()

  return (
    <PageContainer title="Investment Portfolio">
      <div className="space-y-6">
        {/* Portfolio Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
            <p className="text-2xl font-semibold mt-2">
              {new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: "EUR",
              }).format(portfolioSummary?.total_value ?? 0)}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Total Return</p>
            <p className={cn(
              "text-2xl font-semibold mt-2",
              (portfolioSummary?.total_gain_loss ?? 0) > 0 ? "text-green-500" : "text-red-500"
            )}>
              {new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: "EUR",
                signDisplay: "always"
              }).format(portfolioSummary?.total_gain_loss ?? 0)}
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
              <p className={cn(
                "text-2xl font-semibold",
                (portfolioSummary?.total_gain_loss_percentage ?? 0) > 0 ? "text-green-500" : "text-red-500"
              )}>
                {Math.abs(portfolioSummary?.total_gain_loss_percentage ?? 0).toFixed(2)}%
              </p>
            </div>
          </Card>
        </div>

        {/* Performance Metrics */}
        <PerformanceMetrics period={selectedPeriod} />

        {/* Risk Metrics */}
        <RiskMetricsCard />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Performance Chart */}
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Portfolio Performance</h2>
              <Select value={selectedPeriod} onValueChange={(value: TimePeriod) => setSelectedPeriod(value)}>
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
            </div>
            <PortfolioPerformanceChart period={selectedPeriod} />
          </Card>

          {/* Asset Allocation */}
          <Card className="p-6 h-[90vh]">
            <h2 className="text-lg font-semibold mb-4">Asset Allocation</h2>
            <AssetAllocationChart />
          </Card>
        </div>

        {/* Asset Performance Chart */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Individual Asset Performance</h2>
          <AssetPerformanceChart period={selectedPeriod} />
        </Card>

        {/* Detailed Asset Statistics */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Asset Details</h2>
            <Button variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Asset
            </Button>
          </div>
          <AssetStatistics />
        </Card>
      </div>
    </PageContainer>
  )
}
