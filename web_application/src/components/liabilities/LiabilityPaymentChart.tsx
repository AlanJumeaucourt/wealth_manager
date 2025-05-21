import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { format, parseISO } from "date-fns"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
  is_deferred: boolean
  deferral_type: string
  capitalized_interest?: number
}

interface LiabilityPaymentChartProps {
  schedule: AmortizationScheduleItem[]
  title?: string
  description?: string
}

export function LiabilityPaymentChart({
  schedule,
  title = "Principal vs Interest Over Time",
  description = "Breakdown of payments over the loan term"
}: LiabilityPaymentChartProps) {

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

  // Prepare chart data - filter out zero payments
  const chartData = schedule.filter(item => item.payment_amount > 0).map(item => ({
    date: item.payment_date,
    principal: item.principal_amount,
    interest: item.interest_amount,
    payment_number: item.payment_number,
    is_deferred: item.is_deferred,
    deferral_type: item.deferral_type
  }))

  // Calculate metrics
  const totalPrincipal = schedule.reduce((sum, item) => sum + item.principal_amount, 0)
  const totalInterest = schedule.reduce((sum, item) => sum + item.interest_amount, 0)
  const totalCapitalizedInterest = schedule.reduce((sum, item) => sum + (item.capitalized_interest || 0), 0)
  const totalPayments = totalPrincipal + totalInterest

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
              Total Payment
            </span>
            <span className="font-bold">
              {formatCurrency(paymentItem.principal + paymentItem.interest)}
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
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                interval={Math.max(1, Math.floor(chartData.length / 10))}
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
              <Line
                type="monotone"
                dataKey="principal"
                name="Principal"
                stroke="hsl(var(--primary))"
                activeDot={{ r: 8 }}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="interest"
                name="Interest"
                stroke="hsl(var(--muted))"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
