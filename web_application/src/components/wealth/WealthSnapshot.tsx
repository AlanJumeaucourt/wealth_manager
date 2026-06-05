import { Skeleton } from "@/components/ui/skeleton";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { cn } from "@/lib/utils";
import type { WealthBreakdownMetrics } from "@/utils/wealthBreakdown";
import { formatCompactCurrency, formatCurrency } from "@/utils/currency";
import { PiggyBank, Wallet } from "lucide-react";

interface WealthSnapshotProps {
  breakdown: WealthBreakdownMetrics | null;
  periodChangePct: number;
  periodChangeAbs: number;
  periodTrend: "up" | "down" | "neutral";
  savingsRate: number;
  isLoading?: boolean;
}

function BreakdownItem({
  label,
  value,
  currency,
  className,
}: {
  label: string;
  value: number;
  currency: string;
  className?: string;
}) {
  return (
    <div className="min-w-[4.5rem]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-semibold tabular-nums", className)}>
        {formatCurrency(value, currency)}
      </p>
    </div>
  );
}

export function WealthSnapshot({
  breakdown,
  periodChangePct,
  periodChangeAbs,
  periodTrend,
  savingsRate,
  isLoading,
}: WealthSnapshotProps) {
  const { preferredCurrency: curr } = usePreferredCurrency();

  if (isLoading || !breakdown) {
    return (
      <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const trendColor =
    periodTrend === "up"
      ? "text-emerald-600"
      : periodTrend === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/5 via-background to-primary/10 p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Wallet className="h-4 w-4" />
            Net worth
          </p>
          <p
            className={cn(
              "text-3xl sm:text-4xl font-bold tracking-tight tabular-nums mt-0.5",
              breakdown.bookNetWorth >= 0 ? "text-foreground" : "text-destructive",
            )}
          >
            {formatCurrency(breakdown.bookNetWorth, curr)}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums mt-0.5">
            Market value {formatCurrency(breakdown.marketNetWorth, curr)}
          </p>
        </div>

        <div className="flex gap-4 sm:gap-6 shrink-0 text-right">
          <div>
            <p className="text-xs text-muted-foreground">Period</p>
            <p className={cn("text-base font-semibold tabular-nums", trendColor)}>
              {periodChangePct >= 0 ? "+" : ""}
              {periodChangePct.toFixed(1)}%
            </p>
            <p className={cn("text-xs tabular-nums", trendColor)}>
              {periodChangeAbs >= 0 ? "+" : ""}
              {formatCompactCurrency(periodChangeAbs, curr)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
              <PiggyBank className="h-3 w-3" />
              Savings
            </p>
            <p
              className={cn(
                "text-base font-semibold tabular-nums",
                savingsRate >= 20
                  ? "text-emerald-600"
                  : savingsRate >= 0
                    ? "text-foreground"
                    : "text-destructive",
              )}
            >
              {savingsRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-3 mt-4 pt-4 border-t border-border/60">
        <BreakdownItem label="Cash & savings" value={breakdown.cashAndSavings} currency={curr} />
        <BreakdownItem label="Investments" value={breakdown.investmentsAtCost} currency={curr} />
        {breakdown.loans !== 0 && (
          <BreakdownItem
            label="Loans"
            value={breakdown.loans}
            currency={curr}
            className="text-destructive"
          />
        )}
        {Math.abs(breakdown.allTimeInvestmentGain) > 0.01 && (
          <BreakdownItem
            label="Return"
            value={breakdown.allTimeInvestmentGain}
            currency={curr}
            className={
              breakdown.allTimeInvestmentGain >= 0 ? "text-emerald-600" : "text-destructive"
            }
          />
        )}
      </div>
    </div>
  );
}
