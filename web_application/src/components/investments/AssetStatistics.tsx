import { usePortfolioSummary } from "@/api/queries"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useNavigate } from "@tanstack/react-router"
import { ArrowDown, ArrowUp, ExternalLink, Info } from "lucide-react"

export function AssetStatistics() {
  const { data: portfolioSummary, isLoading } = usePortfolioSummary()
  const navigate = useNavigate()

  if (isLoading) {
    return <Skeleton className="w-full h-[400px]" />
  }

  if (!portfolioSummary?.assets) return null

  const sortedAssets = [...portfolioSummary.assets]
    .filter(asset => asset.shares > 0)
    .sort((a, b) => b.current_value - a.current_value)

  // Calculate portfolio metrics
  const totalValue = portfolioSummary.total_value
  const metrics = sortedAssets.map(asset => ({
    ...asset,
    averageCost: asset.cost_basis / asset.shares,
    portfolioWeight: (asset.current_value / totalValue) * 100,
    unrealizedGain: asset.gain_loss,
    unrealizedGainPercentage: asset.gain_loss_percentage,
  }))

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Number of Assets</p>
          <p className="text-2xl font-semibold">{metrics.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Best Performer</p>
          <p className="text-2xl font-semibold text-green-500">
            {
              metrics.reduce((max, asset) =>
                asset.gain_loss_percentage > max.gain_loss_percentage
                  ? asset
                  : max
              ).symbol
            }
          </p>
          <p className="text-sm text-green-500">
            +{Math.max(...metrics.map(m => m.gain_loss_percentage)).toFixed(2)}%
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Worst Performer</p>
          <p className="text-2xl font-semibold text-red-500">
            {
              metrics.reduce((min, asset) =>
                asset.gain_loss_percentage < min.gain_loss_percentage
                  ? asset
                  : min
              ).symbol
            }
          </p>
          <p className="text-sm text-red-500">
            {Math.min(...metrics.map(m => m.gain_loss_percentage)).toFixed(2)}%
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Largest Position</p>
          <p className="text-2xl font-semibold">
            {
              metrics.reduce((max, asset) =>
                asset.portfolioWeight > max.portfolioWeight ? asset : max
              ).symbol
            }
          </p>
          <p className="text-sm text-muted-foreground">
            {Math.max(...metrics.map(m => m.portfolioWeight)).toFixed(2)}% of
            portfolio
          </p>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Holdings</TableHead>
              <TableHead>Avg Cost</TableHead>
              <TableHead>Total Cost</TableHead>
              <TableHead>Market Value</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Unrealized P/L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map(asset => (
              <TableRow key={asset.symbol}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-medium">{asset.name}</p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="link"
                          className="h-6 p-0 text-sm text-muted-foreground hover:text-primary"
                          onClick={() =>
                            navigate({
                              to: "/investments/assets/$symbol/",
                              params: { symbol: asset.symbol },
                            })
                          }
                        >
                          {asset.symbol}
                        </Button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  window.open(
                                    `https://finance.yahoo.com/quote/${asset.symbol}`,
                                    "_blank"
                                  )
                                }
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View on Yahoo Finance</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                    }).format(asset.current_price)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{asset.shares}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                    }).format(asset.averageCost)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                    }).format(asset.cost_basis)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                    }).format(asset.current_value)}
                  </div>
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="w-full">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {asset.portfolioWeight.toFixed(2)}%
                          </p>
                          <Progress
                            value={asset.portfolioWeight}
                            className="h-1"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Portfolio Weight: {asset.portfolioWeight.toFixed(2)}%
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      {asset.unrealizedGain > 0 ? (
                        <ArrowUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <ArrowDown className="h-4 w-4 text-red-500" />
                      )}
                      <p
                        className={cn(
                          "font-medium",
                          asset.unrealizedGain > 0
                            ? "text-green-500"
                            : "text-red-500"
                        )}
                      >
                        {new Intl.NumberFormat(undefined, {
                          style: "currency",
                          currency: "EUR",
                          signDisplay: "always",
                        }).format(asset.unrealizedGain)}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "text-sm",
                        asset.unrealizedGainPercentage > 0
                          ? "text-green-500"
                          : "text-red-500"
                      )}
                    >
                      {asset.unrealizedGainPercentage > 0 ? "+" : ""}
                      {asset.unrealizedGainPercentage.toFixed(2)}%
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Legend/Info */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4" />
        <p>
          Click on asset symbols to view detailed information and transaction
          history
        </p>
      </div>
    </div>
  )
}
