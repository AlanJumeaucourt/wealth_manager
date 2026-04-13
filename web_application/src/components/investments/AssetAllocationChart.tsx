import { usePortfolioSummary } from "@/api/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function AssetAllocationChart() {
  const { data: portfolioSummary, isLoading } = usePortfolioSummary();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-3 w-full rounded-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-3 rounded-full shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!portfolioSummary) {
    return null;
  }

  const data = portfolioSummary.assets
    .filter((asset) => asset.current_value > 0)
    .map((asset, index) => ({
      name: asset.name,
      value: asset.portfolio_percentage,
      amount: asset.current_value,
      symbol: asset.symbol,
      color: COLORS[index % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  const currencyFormatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: portfolioSummary.currency,
  });

  return (
    <div className="space-y-4">
      {/* Stacked allocation bar */}
      <TooltipProvider delayDuration={100}>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {data.map((item) => (
            <Tooltip key={item.symbol}>
              <TooltipTrigger asChild>
                <div
                  className="h-full transition-all hover:opacity-80 first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${Math.max(item.value, 0.5)}%`,
                    backgroundColor: item.color,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-medium">{item.name}</p>
                <p className="text-muted-foreground">
                  {item.value.toFixed(1)}% &middot; {currencyFormatter.format(item.amount)}
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {/* Asset list */}
      <div className="space-y-2.5">
        {data.map((item) => (
          <div key={item.symbol} className="flex items-center gap-3">
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium truncate">{item.symbol}</p>
                <span className="text-sm tabular-nums font-medium shrink-0">
                  {item.value.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 mt-0.5">
                <p className={cn("text-xs text-muted-foreground truncate", "max-w-[60%]")}>
                  {item.name}
                </p>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {currencyFormatter.format(item.amount)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
