import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Account } from "@/types"
import { ArrowDownRight, ArrowUpRight, CreditCard, PiggyBank, TrendingUp } from "lucide-react"
import { useMemo } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface FinancialSummaryProps {
  accounts: Account[]
  wealthData: Array<{ date: string; value: number }>
}

export function FinancialSummary({ accounts, wealthData }: FinancialSummaryProps) {
  // Calculate total balance and balances by account type
  const { totalBalance, checkingBalance, savingsBalance, investmentBalance, monthlyChange, percentChange } = useMemo(() => {
    const total = accounts.reduce((sum, account) => sum + account.balance, 0) || 0
    console.log("accounts", accounts)

    const checking = accounts
      .filter(account => account.type === "checking")
      .reduce((sum, account) => sum + account.balance, 0) || 0

    const savings = accounts
      .filter(account => account.type === "savings")
      .reduce((sum, account) => sum + account.balance, 0) || 0

    const investment = accounts
      .filter(account => account.type === "investment")
      .reduce((sum, account) => sum + account.balance, 0) || 0

    // Calculate monthly change if we have wealth data
    let monthlyChange = 0
    let percentChange = 0

    if (wealthData.length > 30) {
      const currentValue = wealthData[wealthData.length - 1]?.value || 0
      const monthAgoIndex = Math.max(0, wealthData.length - 31)
      const monthAgoValue = wealthData[monthAgoIndex]?.value || 0

      monthlyChange = currentValue - monthAgoValue
      percentChange = monthAgoValue ? (monthlyChange / monthAgoValue) * 100 : 0
    }

    return {
      totalBalance: total,
      checkingBalance: checking,
      savingsBalance: savings,
      investmentBalance: investment,
      monthlyChange,
      percentChange
    }
  }, [accounts, wealthData])

  // Format miniature chart data for the past 3 months
  const sparklineData = useMemo(() => {
    if (wealthData.length === 0) return []

    // Get the last 90 days of data for the sparkline
    const recentData = wealthData.slice(-90)
    return recentData.map(item => ({
      date: item.date,
      value: item.value
    }))
  }, [wealthData])

  // Format currency values
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(Math.abs(amount))
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/50 pb-4">
        <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <span>Net Worth</span>
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <span className={`text-sm px-2 py-1 rounded-md flex items-center gap-1 ${
              monthlyChange >= 0 ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
            }`}>
              {monthlyChange >= 0
                ? <ArrowUpRight className="h-4 w-4" />
                : <ArrowDownRight className="h-4 w-4" />}
              {formatCurrency(Math.abs(monthlyChange))} ({percentChange.toFixed(1)}%)
              <span className="text-xs ml-1 text-muted-foreground">30d</span>
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h3 className="text-4xl font-bold text-primary">
              {formatCurrency(totalBalance)}
            </h3>
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center">
                  <CreditCard className="h-3 w-3 mr-1" /> Checking
                </p>
                <p className="text-sm font-medium">{formatCurrency(checkingBalance)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center">
                  <PiggyBank className="h-3 w-3 mr-1" /> Savings
                </p>
                <p className="text-sm font-medium">{formatCurrency(savingsBalance)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" /> Investments
                </p>
                <p className="text-sm font-medium">{formatCurrency(investmentBalance)}</p>
              </div>
            </div>
          </div>

          <div className="w-full md:w-[40%] h-[80px]">
            {sparklineData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(217, 91%, 97%)" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide={true} />
                  <YAxis hide={true} domain={['auto', 'auto']} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border border-border p-2 rounded-lg shadow-sm text-xs">
                            <p>{new Date(payload[0].payload.date).toLocaleDateString()}</p>
                            <p className="font-semibold">
                              {formatCurrency(payload[0].value as number)}
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(217, 91%, 60%)"
                    fillOpacity={1}
                    fill="url(#colorValue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
