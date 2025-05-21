import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { format, parseISO } from "date-fns"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts"
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent"

interface AmortizationScheduleItem {
  payment_number: number
  payment_date: string
  payment_amount: number
  principal_amount: number
  interest_amount: number
  remaining_principal: number
  status: 'scheduled' | 'paid' | 'missed' | 'partial'
  extra_payment?: number
  capitalized_interest?: number
  is_deferred?: boolean
  deferral_type?: string
}

interface LiabilityAmortizationChartProps {
  schedule: AmortizationScheduleItem[]
  title?: string
  description?: string
}

export function LiabilityAmortizationChart({
  schedule,
  title = "Amortization Schedule",
  description = "Breakdown of principal and interest payments over time"
}: LiabilityAmortizationChartProps) {

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
    principal: item.principal_amount,
    interest: item.interest_amount,
    capitalized: item.capitalized_interest || 0,
    balance: item.remaining_principal,
    payment_number: item.payment_number,
    is_deferred: item.is_deferred,
    deferral_type: item.deferral_type
  }))

  // Calculate metrics and summary stats
  const totalPrincipal = schedule.reduce((sum, item) => sum + item.principal_amount, 0)
  const totalInterest = schedule.reduce((sum, item) => sum + item.interest_amount, 0)
  const totalCapitalized = schedule.reduce((sum, item) => sum + (item.capitalized_interest || 0), 0)
  const totalPayments = totalPrincipal + totalInterest  // Does not include capitalized interest
  const interestRatio = (totalInterest / totalPayments) * 100

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: TooltipProps<ValueType, NameType>) => {
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
          {payload.map((entry) => (
            <div key={entry.name} className="flex justify-between gap-4">
              <span className="text-[0.70rem] uppercase text-muted-foreground">
                {entry.name}
              </span>
              <span
                className="font-bold"
                style={{ color: entry.color }}
              >
                {formatCurrency(entry.value as number)}
              </span>
            </div>
          ))}
          <div className="h-px bg-border" />
          <div className="flex justify-between gap-4">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              Remaining
            </span>
            <span className="font-bold">
              {formatCurrency(paymentItem.balance)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              Status
            </span>
            <span className={`font-bold ${
              paymentItem.status === 'paid' ? 'text-success' :
              paymentItem.status === 'missed' ? 'text-destructive' :
              paymentItem.status === 'partial' ? 'text-warning' :
              'text-muted-foreground'
            }`}>
              {paymentItem.status.charAt(0).toUpperCase() + paymentItem.status.slice(1)}
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
              Total Principal
            </h4>
            <div className="text-2xl font-bold">{formatCurrency(totalPrincipal)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {((totalPrincipal / totalPayments) * 100).toFixed(1)}% of total payments
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Total Interest
            </h4>
            <div className="text-2xl font-bold">{formatCurrency(totalInterest)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {interestRatio.toFixed(1)}% of total payments
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Total Payments
            </h4>
            <div className="text-2xl font-bold">{formatCurrency(totalPayments)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {schedule.length} payments over {Math.ceil(schedule.length / 12)} years
            </div>
          </div>
        </div>

        {/* Stacked Bar Chart */}
        <div className="mb-8 h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
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
              <Legend />
              <Bar
                dataKey="principal"
                stackId="a"
                name="Principal"
                fill="hsl(var(--primary))"
              />
              <Bar
                dataKey="interest"
                stackId="a"
                name="Interest"
                fill="hsl(var(--muted))"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Area Chart for Remaining Balance */}
        <div className="h-[300px]">
          <h3 className="text-lg font-semibold mb-4">Remaining Balance</h3>
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
                <linearGradient id="colorRemaining" x1="0" y1="0" x2="0" y2="1">
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
              <Tooltip
                formatter={(value) => [formatCurrency(value as number), 'Remaining Balance']}
                labelFormatter={formatDate}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="hsl(var(--primary))"
                fillOpacity={1}
                fill="url(#colorRemaining)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
