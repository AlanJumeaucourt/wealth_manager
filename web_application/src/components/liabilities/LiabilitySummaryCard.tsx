import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Liability } from "@/types"
import { format, parseISO } from "date-fns"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

interface LiabilitySummaryCardProps {
  liability: Liability
}

export function LiabilitySummaryCard({ liability }: LiabilitySummaryCardProps) {
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return "N/A"
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "N/A"
    try {
      return format(parseISO(dateStr), "MMM d, yyyy")
    } catch (e) {
      return dateStr
    }
  }

  // Calculate metrics
  const principalPaid = liability.principal_paid || 0
  const interestPaid = liability.interest_paid || 0
  const remainingBalance = liability.remaining_balance || liability.principal_amount
  const totalPaid = principalPaid + interestPaid
  const percentagePaid = (principalPaid / liability.principal_amount) * 100

  // Prepare data for pie chart
  const pieData = [
    { name: "Principal Paid", value: principalPaid, color: "hsl(var(--success))" },
    { name: "Interest Paid", value: interestPaid, color: "hsl(var(--warning))" },
    { name: "Remaining", value: remainingBalance, color: "hsl(var(--muted))" },
  ].filter(item => item.value > 0)

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null

    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="flex flex-col">
          <span className="text-[0.70rem] uppercase text-muted-foreground">
            {payload[0].name}
          </span>
          <span className="font-bold" style={{ color: payload[0].payload.color }}>
            {formatCurrency(payload[0].value)}
          </span>
          <span className="text-[0.65rem] text-muted-foreground">
            {((payload[0].value / (principalPaid + interestPaid + remainingBalance)) * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{liability.name}</CardTitle>
        <CardDescription>
          {liability.liability_type.replace(/_/g, " ")} • {formatCurrency(liability.principal_amount)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Interest Rate</h4>
                <div className="text-xl font-bold">{liability.interest_rate}%</div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Payment Frequency</h4>
                <div className="text-xl font-bold capitalize">{liability.payment_frequency}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Start Date</h4>
                <div className="text-sm font-medium">{formatDate(liability.start_date)}</div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">End Date</h4>
                <div className="text-sm font-medium">{formatDate(liability.end_date)}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Payment Progress</h4>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div 
                  className="bg-primary h-2.5 rounded-full" 
                  style={{ width: `${Math.min(100, percentagePaid)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{percentagePaid.toFixed(1)}% paid</span>
                <span>{formatCurrency(principalPaid)} of {formatCurrency(liability.principal_amount)}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Principal Paid</h4>
                <div className="text-xl font-bold text-success">{formatCurrency(principalPaid)}</div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Interest Paid</h4>
                <div className="text-xl font-bold text-warning">{formatCurrency(interestPaid)}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Remaining Balance</h4>
                <div className="text-xl font-bold">{formatCurrency(remainingBalance)}</div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Next Payment</h4>
                <div className="text-xl font-bold">{formatDate(liability.next_payment_date)}</div>
              </div>
            </div>
            
            {liability.missed_payments_count && liability.missed_payments_count > 0 && (
              <div className="rounded-lg bg-destructive/10 p-3 border border-destructive/20">
                <h4 className="text-sm font-medium text-destructive">Missed Payments</h4>
                <div className="text-xl font-bold text-destructive">{liability.missed_payments_count}</div>
              </div>
            )}
          </div>
          
          <div className="h-64">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Payment Breakdown</h4>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  formatter={(value) => <span className="text-xs">{value}</span>}
                  layout="vertical"
                  verticalAlign="middle"
                  align="right"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
