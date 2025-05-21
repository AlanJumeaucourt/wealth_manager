import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { format, parseISO } from "date-fns"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface AmortizationScheduleItem {
  payment_number: number
  payment_date: string
  payment_amount: number
  principal_amount: number
  interest_amount: number
  remaining_principal: number
  status: 'scheduled' | 'paid' | 'missed' | 'partial'
  extra_payment?: number
  is_deferred: boolean
}

interface LiabilityBalanceChartProps {
  schedule: AmortizationScheduleItem[]
  title?: string
  description?: string
}

export function LiabilityBalanceChart({
  schedule,
  title = "Balance Over Time",
  description = "Remaining balance throughout the loan term"
}: LiabilityBalanceChartProps) {

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value)
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "MMM yyyy")
    } catch (e) {
      return dateStr
    }
  }

  // Prepare chart data
  const chartData = schedule.map(item => ({
    date: item.payment_date,
    balance: item.remaining_principal,
    payment_number: item.payment_number,
    is_deferred: item.is_deferred
  }))

  // Calculate metrics
  const initialBalance = schedule.length > 0 ? schedule[0].remaining_principal + schedule[0].principal_amount : 0
  const currentBalance = schedule.length > 0 ? schedule[0].remaining_principal : 0
  const totalPaid = initialBalance - currentBalance
  const percentagePaid = (totalPaid / initialBalance) * 100

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null

    const paymentItem = payload[0].payload

    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid gap-2">
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              Payment #{paymentItem.payment_number}
            </span>
            <span className="font-bold text-muted-foreground">
              {formatDate(label)}
            </span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between gap-4">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              Remaining Balance
            </span>
            <span className="font-bold text-primary">
              {formatCurrency(paymentItem.balance)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              Paid Off
            </span>
            <span className="font-bold text-success">
              {formatCurrency(initialBalance - paymentItem.balance)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              Percentage Paid
            </span>
            <span className="font-bold text-success">
              {(((initialBalance - paymentItem.balance) / initialBalance) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="rounded-lg border bg-card p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Initial Balance
            </h4>
            <div className="text-2xl font-bold">{formatCurrency(initialBalance)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              Total loan amount
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Current Balance
            </h4>
            <div className="text-2xl font-bold">{formatCurrency(currentBalance)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              Remaining to be paid
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Paid Off
            </h4>
            <div className="text-2xl font-bold">{formatCurrency(totalPaid)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {percentagePaid.toFixed(1)}% of total loan
            </div>
          </div>
        </div>

        {/* Area Chart */}
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{
                top: 10,
                right: 30,
                left: 0,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                interval={Math.max(1, Math.floor(chartData.length / 12))}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={formatCurrency}
                width={80}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorBalance)"
                name="Remaining Balance"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
