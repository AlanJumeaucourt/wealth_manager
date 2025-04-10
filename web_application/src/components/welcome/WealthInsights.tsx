import { Account, Transaction } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart, LightbulbIcon, TrendingUp, BellOff, AlertTriangle, Check, ArrowUpRight } from "lucide-react"
import { useMemo } from "react"
import { useTransactions } from "@/api/queries"

interface WealthInsightsProps {
  wealthData: Array<{ date: string; value: number }>
  accounts: Account[]
  onAccountClick?: (accountId: number) => void
}

export function WealthInsights({ wealthData, accounts, onAccountClick }: WealthInsightsProps) {
  // todo: remove this once we have a way to treat loans in backend
  const accountsb = accounts.filter(account => !account.name.includes("Prêt"))
  // Fetch expense transactions from the last 3 months to calculate average monthly expenses
  const today = new Date()
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(today.getMonth() - 3)

  const fromDate = threeMonthsAgo.toISOString().split('T')[0]
  const toDate = today.toISOString().split('T')[0]

  const { data: transactionsResponse } = useTransactions({
    type: "expense",
    from_date: fromDate,
    to_date: toDate,
    page: 1,
    per_page: 1000, // Large enough to get all transactions
  })

  const insights = useMemo(() => {
    const insights = []
    const totalBalance = accountsb.reduce((sum, account) => sum + account.balance, 0) || 0

    // Format currency values
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "EUR",
      }).format(Math.abs(amount))
    }

    // Calculate monthly growth rate
    let monthlyGrowthRate = 0
    if (wealthData.length > 30) {
      const currentValue = wealthData[wealthData.length - 1]?.value || 0
      const monthAgoIndex = Math.max(0, wealthData.length - 31)
      const monthAgoValue = wealthData[monthAgoIndex]?.value || 0

      monthlyGrowthRate = monthAgoValue ? (currentValue - monthAgoValue) / monthAgoValue : 0
    }

    // Calculate savings rate (example)
    const checkingAccounts = accountsb.filter(a => a.type === "checking")
    const checkingBalance = checkingAccounts.reduce((sum, a) => sum + a.balance, 0) || 0
    const savingsAccounts = accountsb.filter(a => a.type === "savings" || a.type === "investment")
    const savingsBalance = savingsAccounts.reduce((sum, a) => sum + a.balance, 0) || 0

    const savingsRate = totalBalance > 0 ? savingsBalance / totalBalance : 0

    // Calculate average monthly expenses based on transaction data
    let estimatedMonthlyExpenses = 3000 // Fallback default value

    if (transactionsResponse?.items && transactionsResponse.items.length > 0) {
      const expenseTransactions = transactionsResponse.items

      // Calculate net expenses (expenses minus refunded amounts)
      const totalExpenses = expenseTransactions.reduce((sum, transaction) => {
        // Include the transaction amount minus any refunded amount
        return sum + (transaction.amount - (transaction.refunded_amount || 0))
      }, 0)

      // Calculate number of months in the date range (at least 1 to avoid division by zero)
      const startDate = new Date(fromDate)
      const endDate = new Date(toDate)
      const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                         (endDate.getMonth() - startDate.getMonth())
      const monthsPeriod = Math.max(1, monthsDiff)

      // Calculate average monthly expenses
      estimatedMonthlyExpenses = totalExpenses / monthsPeriod
    }

    // Emergency fund check (typically 3-6 months of expenses)
    const emergencyFundTarget = estimatedMonthlyExpenses * 6
    const savingsBalanceMinusInvestments = accountsb
      .filter(a => a.type === "savings")
      .reduce((sum, a) => sum + a.balance, 0) || 0

    const emergencyFundRatio = savingsBalanceMinusInvestments / emergencyFundTarget
    console.log("savingsBalanceMinusInvestments", savingsBalanceMinusInvestments)
    console.log("emergencyFundTarget", emergencyFundTarget)
    console.log("emergencyFundRatio", emergencyFundRatio)

    // Add insights based on calculated metrics

    // Wealth growth insight
    if (monthlyGrowthRate > 0.05) {
      insights.push({
        type: "positive",
        icon: <TrendingUp className="h-5 w-5" />,
        title: "Strong Growth",
        description: `Your net worth is growing at ${(monthlyGrowthRate * 100).toFixed(1)}% monthly - keep it up!`,
        action: "View Trends",
        actionLink: "/dashboard"
      })
    } else if (monthlyGrowthRate < 0) {
      insights.push({
        type: "warning",
        icon: <AlertTriangle className="h-5 w-5" />,
        title: "Declining Net Worth",
        description: "Your net worth has declined over the past month. Review your spending.",
        action: "Review Expenses",
        actionLink: "/transactions/all"
      })
    }

    // Savings rate insight
    if (savingsRate > 0.5) {
      insights.push({
        type: "positive",
        icon: <Check className="h-5 w-5" />,
        title: "Excellent Savings",
        description: `You're saving ${(savingsRate * 100).toFixed(0)}% of your wealth - great job!`,
        action: "View Accounts",
        actionLink: "/accounts/all"
      })
    } else if (savingsRate < 0.2) {
      insights.push({
        type: "warning",
        icon: <AlertTriangle className="h-5 w-5" />,
        title: "Low Savings Rate",
        description: "Consider increasing your savings rate to build wealth faster.",
        action: "Set Budget",
        actionLink: "/accounts/all"
      })
    }

    // Emergency fund insight
    if (emergencyFundRatio < 0.5) {
      insights.push({
        type: "warning",
        icon: <AlertTriangle className="h-5 w-5" />,
        title: "Boost Emergency Fund",
        description: `Your emergency fund covers ${(emergencyFundRatio * 6).toFixed(1)} months of expenses. Aim for 6 months.`,
        action: "View Savings",
        actionLink: "/accounts/all"
      })
    } else if (emergencyFundRatio >= 1) {
      insights.push({
        type: "positive",
        icon: <Check className="h-5 w-5" />,
        title: "Emergency Fund Complete",
        description: `Your emergency fund of ${formatCurrency(savingsBalanceMinusInvestments)} covers 6+ months of expenses.`,
        action: "Learn More",
        actionLink: "/accounts/all"
      })
    }

    // Add monthly expense insight
    if (estimatedMonthlyExpenses > 0) {
      insights.push({
        type: "neutral",
        icon: <BarChart className="h-5 w-5" />,
        title: "Monthly Expenses",
        description: `Your average monthly expenses are ${formatCurrency(estimatedMonthlyExpenses)} based on the last 3 months.`,
        action: "View Transactions",
        actionLink: "/transactions/expense"
      })
    }

    // Add generic insights if we don't have enough personalized ones
    if (insights.length < 2) {
      insights.push({
        type: "neutral",
        icon: <LightbulbIcon className="h-5 w-5" />,
        title: "Investment Opportunity",
        description: "Regular investing in index funds can help build long-term wealth.",
        action: "Explore Investments",
        actionLink: "/investments"
      })
    }

    return insights.slice(0, 3)
  }, [wealthData, accountsb, transactionsResponse, fromDate, toDate])

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'positive':
        return 'bg-green-500/10 text-green-500 border-green-200'
      case 'warning':
        return 'bg-amber-500/10 text-amber-500 border-amber-200'
      case 'negative':
        return 'bg-red-500/10 text-red-500 border-red-200'
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-200'
    }
  }

  // Handler for button click with custom navigation
  const handleActionClick = (actionLink: string, e: React.MouseEvent) => {
    e.preventDefault();

    // Check if it's an account-related link
    if (actionLink.startsWith('/accounts/') && onAccountClick) {
      // Find first account of appropriate type if the link is to a filtered account view
      const getFirstAccountByType = (type: string) => {
        const account = accounts.find(a => a.type === type);
        return account ? account.id : null;
      };

      if (actionLink === '/accounts/all') {
        // If we have any account, use the first one's ID
        const firstAccount = accounts[0];
        if (firstAccount) {
          onAccountClick(firstAccount.id);
        }
      } else if (actionLink.includes('savings')) {
        const savingsAccountId = getFirstAccountByType('savings');
        if (savingsAccountId) {
          onAccountClick(savingsAccountId);
        }
      }
    } else {
      // Standard navigation for other links
      window.location.href = actionLink;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <LightbulbIcon className="h-5 w-5" />
          Financial Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${getTypeStyles(insight.type)}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${
                  insight.type === 'positive' ? 'bg-green-500/20' :
                  insight.type === 'warning' ? 'bg-amber-500/20' :
                  insight.type === 'negative' ? 'bg-red-500/20' :
                  'bg-blue-500/20'
                }`}>
                  {insight.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-1">{insight.title}</h4>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>

                  {insight.action && (
                    <Button
                      variant="link"
                      className="px-0 h-auto text-sm mt-2"
                      onClick={(e) => handleActionClick(insight.actionLink, e)}
                    >
                      {insight.action}
                      <ArrowUpRight className="ml-1 h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {insights.length === 0 && (
            <div className="flex items-center justify-center p-6 text-center">
              <div className="flex flex-col items-center">
                <BellOff className="h-8 w-8 text-muted-foreground opacity-40 mb-2" />
                <p className="text-sm text-muted-foreground">No insights available yet</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
