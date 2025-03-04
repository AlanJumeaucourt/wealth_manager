import { usePortfolioSummary } from "@/api/queries"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export function AssetAllocationChart() {
  const { data: portfolioSummary, isLoading } = usePortfolioSummary()

  if (isLoading) {
    return <Skeleton className="w-full h-[300px]" />
  }

  if (!portfolioSummary) {
    return null
  }

  const data = portfolioSummary.assets
    .filter(asset => asset.current_value > 0)
    .map(asset => ({
      name: asset.name,
      value: (asset.current_value / portfolioSummary.total_value) * 100,
      amount: asset.current_value
    }))

  return (
    <ResponsiveContainer>
      <PieChart
        style={{
          height: "90%"
        }}
      >
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
          nameKey="name"
          label={({ name, value, amount }) => `(${value.toFixed(1)}%)`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Legend
          formatter={(value, entry: any) => {
            const item = data.find(d => d.name === value)
            if (!item) return value
            return `${value} - $${item.amount.toLocaleString()})`
          }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload?.[0]?.value != null) {
              const item = payload[0].payload
              return (
                <Card className="p-2">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {`${Number(item.value).toFixed(1)}% - $${item.amount.toLocaleString()}`}
                  </p>
                </Card>
              )
            }
            return null
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
