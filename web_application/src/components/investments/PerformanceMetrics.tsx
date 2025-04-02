import { usePortfolioPerformance } from "@/api/queries"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { ArrowDown, ArrowUp } from "lucide-react"

interface PerformanceMetricsProps {
  period: string
}

export function PerformanceMetrics({ period }: PerformanceMetricsProps) {
  const { data, isLoading } = usePortfolioPerformance(period)

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  }

  if (!data?.summary) return null

  const metrics = [
    {
      label: "Initial Investment",
      value: data.summary.initial_investment,
      type: "currency",
    },
    {
      label: "Net Investment",
      value: data.summary.net_investment,
      type: "currency",
    },
    {
      label: "Total Return",
      value: data.summary.total_return,
      type: "currency",
      isPerformance: true,
    },
    {
      label: "Total Withdrawals",
      value: data.summary.total_withdrawals,
      type: "currency",
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metrics.map(metric => (
        <Card key={metric.label} className="p-4">
          <p className="text-sm text-muted-foreground">{metric.label}</p>
          <div className="flex items-center gap-2 mt-1">
            {metric.isPerformance &&
              (metric.value > 0 ? (
                <ArrowUp className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDown className="h-4 w-4 text-red-500" />
              ))}
            <p
              className={cn(
                "text-lg font-semibold",
                metric.isPerformance &&
                  (metric.value > 0 ? "text-green-500" : "text-red-500")
              )}
            >
              {new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: "EUR",
                signDisplay: metric.isPerformance ? "always" : "auto",
              }).format(metric.value)}
            </p>
          </div>
        </Card>
      ))}
    </div>
  )
}
