import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Account } from "@/types"
import { ArrowDownRight, ArrowUpRight, CreditCard, PiggyBank, TrendingUp } from "lucide-react"
import { useMemo } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface FinancialSummaryProps {
  accounts: Account[]
  wealthData: Array<{ date: string; value: number }>
  onAccountClick?: (accountId: number) => void
  isLoading?: boolean
}

export function FinancialSummary({ accounts, wealthData, onAccountClick, isLoading }: FinancialSummaryProps) {
  // Calculate total balance and balances by account type
  const { totalBalance, checkingBalance, savingsBalance, investmentBalance, loanBalance, investmentMarketValue, monthlyChange, percentChange } = useMemo(() => {
    // Calculate total balance using market values for investments
    const total = accounts.reduce((sum, account) => {
      if (account.type === "investment") {
        return sum + (account.market_value || account.balance)
      }
      return sum + account.balance
    }, 0) || 0

    const checking = accounts
      .filter(account => account.type === "checking")
      .reduce((sum, account) => sum + account.balance, 0) || 0

    const savings = accounts
      .filter(account => account.type === "savings")
      .reduce((sum, account) => sum + account.balance, 0) || 0

    const investment = accounts
      .filter(account => account.type === "investment")
      .reduce((sum, account) => sum + account.balance, 0) || 0

    const investmentMarketValue = accounts
      .filter(account => account.type === "investment")
      .reduce((sum, account) => sum + (account.market_value || account.balance), 0) || 0

    const loan = accounts
      .filter(account => account.type === "loan")
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
      investmentMarketValue,
      loanBalance: loan,
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

  // Get first account of each type for navigation
  const getFirstAccountByType = (type: string) => {
    const account = accounts.find(a => a.type === type)
    return account ? account.id : null
  }

  const handleAccountTypeClick = (type: string) => {
    if (!onAccountClick) return

    const accountId = getFirstAccountByType(type)
    if (accountId) {
      onAccountClick(accountId)
    }
  }

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50 pb-4">
          <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <Skeleton className="h-6 w-32" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="w-full md:w-[40%]">
              <Skeleton className="h-12 w-48 mb-6" />
              <div className="grid grid-cols-3 gap-4 mt-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2 p-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full md:w-[60%] h-[150px] mt-6 md:mt-0">
              <Skeleton className="h-full w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/50 pb-4">
        <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div className="flex items-center gap-2">
            <span>Net Worth</span>
            <div className="relative group">
              <span className="text-xs text-muted-foreground cursor-help">(incl. market value)</span>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-sm rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-48">
                <div className="space-y-1">
                  <p className="font-medium">Net Worth Breakdown:</p>
                  <div className="flex justify-between">
                    <span>Checking:</span>
                    <span>{formatCurrency(checkingBalance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Savings:</span>
                    <span>{formatCurrency(savingsBalance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Investments:</span>
                    <span>{formatCurrency(investmentMarketValue)}</span>
                  </div>
                  <div className="flex justify-between text-red-500">
                    <span>Loans:</span>
                    <span>-{formatCurrency(loanBalance)}</span>
                  </div>
                  <div className="border-t pt-1 mt-1">
                    <div className="flex justify-between font-medium">
                      <span>Total:</span>
                      <span>{formatCurrency(totalBalance)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
          <div className="w-full md:w-[40%]">
            <h3 className="text-4xl font-bold text-primary">
              {formatCurrency(totalBalance)}
            </h3>
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div
                className="space-y-1 transition-colors hover:bg-muted/50 p-2 rounded cursor-pointer"
                onClick={() => handleAccountTypeClick("checking")}
                role="button"
                tabIndex={0}
              >
                <p className="text-xs text-muted-foreground flex items-center">
                  <CreditCard className="h-3 w-3 mr-1" /> Checking
                </p>
                <p className="text-sm font-medium">{formatCurrency(checkingBalance)}</p>
              </div>
              <div
                className="space-y-1 transition-colors hover:bg-muted/50 p-2 rounded cursor-pointer"
                onClick={() => handleAccountTypeClick("savings")}
                role="button"
                tabIndex={0}
              >
                <p className="text-xs text-muted-foreground flex items-center">
                  <PiggyBank className="h-3 w-3 mr-1" /> Savings
                </p>
                <p className="text-sm font-medium">{formatCurrency(savingsBalance)}</p>
              </div>
              <div
                className="space-y-1 transition-colors hover:bg-muted/50 p-2 rounded cursor-pointer"
                onClick={() => handleAccountTypeClick("loan")}
                role="button"
                tabIndex={0}
              >
                <p className="text-xs text-muted-foreground flex items-center">
                  <CreditCard className="h-3 w-3 mr-1" /> Loans
                </p>
                <p className="text-sm font-medium text-red-500">
                  -{formatCurrency(loanBalance)}
                </p>
              </div>
              <div
                className="space-y-1 transition-colors hover:bg-muted/50 p-2 rounded cursor-pointer col-span-3"
                onClick={() => handleAccountTypeClick("investment")}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" /> Investments
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Market Value: {formatCurrency(investmentMarketValue)}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm font-medium">{formatCurrency(investmentBalance)}</p>
                  <p className={`text-xs ${investmentMarketValue > investmentBalance ? 'text-green-500' : 'text-red-500'}`}>
                    {investmentMarketValue > investmentBalance ? '+' : ''}
                    {formatCurrency(investmentMarketValue - investmentBalance)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full md:w-[60%] h-[150px] mt-6 md:mt-0 flex items-center justify-center">
            {sparklineData.length > 0 && (
              <ResponsiveContainer width="80%" height="100%" className="translate-y-4">
                <AreaChart data={sparklineData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(217, 91%, 97%)" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(date) => {
                      const d = new Date(date)
                      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    }}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis
                    hide={true}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border border-border p-2 rounded-lg shadow-sm text-xs">
                            <p>{new Date(payload[0].payload.date).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}</p>
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
