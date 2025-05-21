import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Liability, LiabilityPayment } from '@/types'
import { formatCurrency } from '@/utils/format'
import { addMonths, format, isBefore, parseISO } from 'date-fns'
import { AlertTriangleIcon, CalendarIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

interface LiabilityDashboardProps {
  liabilities: Liability[]
  payments: LiabilityPayment[]
}

export function LiabilityDashboard({ liabilities, payments }: LiabilityDashboardProps) {
  // Calculate dashboard statistics
  const stats = useMemo(() => {
    const totalLiabilities = liabilities.length

    // Filter liabilities by direction
    const iOweLiabilities = liabilities.filter(l => l.direction === 'i_owe')
    const theyOweLiabilities = liabilities.filter(l => l.direction === 'they_owe')

    // Calculate totals
    const totalDebt = iOweLiabilities.reduce((sum, l) => sum + (l.remaining_balance || 0), 0)
    const totalOwed = theyOweLiabilities.reduce((sum, l) => sum + (l.remaining_balance || 0), 0)

    const totalPrincipalPaid = liabilities.reduce((sum, l) => sum + (l.principal_paid || 0), 0)
    const totalInterestPaid = liabilities.reduce((sum, l) => sum + (l.interest_paid || 0), 0)

    // Calculate missed payments
    const missedPaymentsCount = liabilities.reduce((sum, l) => sum + (l.missed_payments_count || 0), 0)

    // Get upcoming payments (next 30 days)
    const today = new Date()
    const nextMonth = addMonths(today, 1)
    const upcomingPayments = payments
      .filter(p =>
        p.status === 'scheduled' &&
        isBefore(parseISO(p.payment_date), nextMonth)
      )
      .sort((a, b) =>
        parseISO(a.payment_date).getTime() - parseISO(b.payment_date).getTime()
      )
      .slice(0, 5)

    return {
      totalLiabilities,
      totalDebt,
      totalOwed,
      totalPrincipalPaid,
      totalInterestPaid,
      missedPaymentsCount,
      upcomingPayments,
      netLiabilityPosition: totalOwed - totalDebt
    }
  }, [liabilities, payments])

  // Prepare data for pie charts
  const principalVsInterestData = [
    { name: 'Principal Paid', value: stats.totalPrincipalPaid },
    { name: 'Interest Paid', value: stats.totalInterestPaid }
  ]

  const debtVsOwedData = [
    { name: 'I Owe', value: stats.totalDebt },
    { name: 'They Owe', value: stats.totalOwed }
  ]

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Liabilities</CardDescription>
            <CardTitle className="text-2xl">{stats.totalLiabilities}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {stats.totalLiabilities === 1 ? '1 active liability' : `${stats.totalLiabilities} active liabilities`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Debt (I Owe)</CardDescription>
            <CardTitle className="text-2xl text-destructive">{formatCurrency(stats.totalDebt)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              <TrendingDownIcon className="h-3 w-3 inline mr-1" />
              Obligations to pay
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Owed (They Owe)</CardDescription>
            <CardTitle className="text-2xl text-green-600">{formatCurrency(stats.totalOwed)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              <TrendingUpIcon className="h-3 w-3 inline mr-1" />
              Expected to receive
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net Position</CardDescription>
            <CardTitle className={`text-2xl ${stats.netLiabilityPosition >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {formatCurrency(stats.netLiabilityPosition)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {stats.netLiabilityPosition >= 0 ? 'Net positive position' : 'Net negative position'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Principal vs Interest Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Principal vs Interest Paid</CardTitle>
            <CardDescription>
              Total paid: {formatCurrency(stats.totalPrincipalPaid + stats.totalInterestPaid)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={principalVsInterestData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {principalVsInterestData.map((entry, index) => (
                      <Cell key={`principal-interest-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* I Owe vs They Owe Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Debt vs Receivables</CardTitle>
            <CardDescription>
              Total outstanding: {formatCurrency(stats.totalDebt + stats.totalOwed)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={debtVsOwedData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {debtVsOwedData.map((entry, index) => (
                      <Cell key={`debt-owed-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Payments and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2" />
              Upcoming Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.upcomingPayments.length > 0 ? (
              <div className="space-y-4">
                {stats.upcomingPayments.map((payment) => {
                  const liability = liabilities.find(l => l.id === payment.liability_id)
                  return (
                    <div key={payment.id} className="flex justify-between items-center border-b pb-2">
                      <div>
                        <div className="font-medium">{liability?.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(parseISO(payment.payment_date), 'MMMM d, yyyy')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(payment.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          Principal: {formatCurrency(payment.principal_amount)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No upcoming payments in the next 30 days
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangleIcon className="h-5 w-5 mr-2" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.missedPaymentsCount > 0 ? (
              <div className="space-y-4">
                {liabilities
                  .filter(l => l.missed_payments_count && l.missed_payments_count > 0)
                  .map(liability => (
                    <div key={liability.id} className="flex justify-between items-center border-b pb-2">
                      <div>
                        <div className="font-medium">{liability.name}</div>
                        <div className="text-sm text-destructive">
                          {liability.missed_payments_count} missed payment{liability.missed_payments_count !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(liability.remaining_balance || 0)}</div>
                        <div className="text-xs text-muted-foreground">
                          Remaining balance
                        </div>
                      </div>
                    </div>
                  ))
              }
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No missed payments or alerts
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
