import {
  useAccounts,
  useBanks,
  useTransactions,
  useWealthOverTime,
} from "@/api/queries"
import { AccountSummary } from "@/components/dashboard/AccountSummary"
import { RecentTransactions } from "@/components/dashboard/RecentTransactions"
import { WealthChart } from "@/components/dashboard/WealthChart"
import { PageContainer } from "@/components/layout/PageContainer"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Icons } from "@/components/ui/icons"
import { Skeleton } from "@/components/ui/skeleton"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowUpRight, Clock, CreditCard, DollarSign, PiggyBank, Plus, TrendingUp, Wallet } from "lucide-react"
import { useEffect, useState } from "react"

export function Dashboard() {
  const navigate = useNavigate()
  const [greeting, setGreeting] = useState("Good day")
  const [currentTime, setCurrentTime] = useState(new Date())

  // Set appropriate greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Good morning")
    else if (hour < 18) setGreeting("Good afternoon")
    else setGreeting("Good evening")

    // Update time every minute
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const {
    data: banksResponse,
    isLoading: isLoadingBanks,
    error: banksError,
  } = useBanks({
    page: 1,
    per_page: 1000,
  })

  const {
    data: accountsResponse,
    isLoading: isLoadingAccounts,
    error: accountsError,
  } = useAccounts({
    type: "checking,savings,investment",
    page: 1,
    per_page: 1000,
  })

  const {
    data: wealthData,
    isLoading: isLoadingWealth,
    error: wealthError,
  } = useWealthOverTime()

  const {
    data: transactionsResponse,
    isLoading: isLoadingTransactions,
    error: transactionsError,
  } = useTransactions({
    page: 1,
    per_page: 5,
    sort_by: "date",
    sort_order: "desc",
  })

  const isLoading =
    isLoadingBanks ||
    isLoadingAccounts ||
    isLoadingWealth ||
    isLoadingTransactions
  const hasError =
    banksError || accountsError || wealthError || transactionsError

  const banks = banksResponse?.items || []
  const accounts = accountsResponse?.items || []
  const transactions = transactionsResponse?.items || []

  // Calculate summary statistics if data is available
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0) || 0

  // Get checking, savings and investment balances
  const checkingBalance = accounts
    .filter(account => account.type === "checking")
    .reduce((sum, account) => sum + account.balance, 0) || 0

  const savingsBalance = accounts
    .filter(account => account.type === "savings")
    .reduce((sum, account) => sum + account.balance, 0) || 0

  const investmentBalance = accounts
    .filter(account => account.type === "investment")
    .reduce((sum, account) => sum + account.balance, 0) || 0

  useKeyboardShortcuts({
    onNew: () => navigate({ to: "/accounts/all" }),
    onEdit: () => navigate({ to: "/accounts/all" }),
    onDelete: () => navigate({ to: "/accounts/all" }),
    onHome: () => window.scrollTo({ top: 0, behavior: "smooth" }),
    onEnd: () =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }),
    onPrevPage: () => navigate({ to: "/transactions/all" }),
    onNextPage: () => navigate({ to: "/accounts/all" }),
  })

  if (hasError) {
    return (
      <PageContainer title="Financial Dashboard">
        <Alert variant="destructive">
          <AlertDescription>
            There was an error loading your dashboard. Please try again later.
          </AlertDescription>
        </Alert>
      </PageContainer>
    )
  }

  const NoDataMessage = ({ message, actionLabel, actionUrl }: { message: string, actionLabel?: string, actionUrl?: string }) => (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <Icons.noData className="h-16 w-16 mb-6 opacity-50 text-muted-foreground" />
      <p className="text-muted-foreground mb-4">{message}</p>
      {actionLabel && actionUrl && (
        <Button
          variant="outline"
          className="mt-2"
          onClick={() => navigate({ to: actionUrl as any })}
        >
          <Plus className="mr-2 h-4 w-4" /> {actionLabel}
        </Button>
      )}
    </div>
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(Math.abs(amount))
  }

  return (
    <PageContainer title="Financial Dashboard">
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-8">
          {/* Header with greeting and quick action buttons */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
              <p className="text-muted-foreground">
                {currentTime.toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate({ to: "/accounts/all" })}
              >
                <Wallet className="mr-2 h-4 w-4" /> View Accounts
              </Button>
              <Button
                size="sm"
                onClick={() => navigate({ to: "/accounts/all" })}
              >
                <Plus className="mr-2 h-4 w-4" /> Add Account
              </Button>
            </div>
          </div>

          {/* Net Worth Summary Card */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="col-span-4 md:col-span-4">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium">Total Net Worth</CardTitle>
                  <CardDescription>Your overall financial position</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(totalBalance)}</div>
                <div className="flex items-center pt-4 space-x-4">
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center">
                      <CreditCard className="h-3 w-3 mr-1" /> Checking
                    </p>
                    <p className="text-sm font-medium">{formatCurrency(checkingBalance)}</p>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center">
                      <PiggyBank className="h-3 w-3 mr-1" /> Savings
                    </p>
                    <p className="text-sm font-medium">{formatCurrency(savingsBalance)}</p>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center">
                      <TrendingUp className="h-3 w-3 mr-1" /> Investments
                    </p>
                    <p className="text-sm font-medium">{formatCurrency(investmentBalance)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Wealth Chart */}
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Wealth Growth Over Time</CardTitle>
              <CardDescription>Track your wealth progression</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(wealthData || {}).length > 0 ? (
                <WealthChart />
              ) : (
                <NoDataMessage
                  message="No wealth data available. Add some accounts to see your wealth growth over time."
                  actionLabel="Add Account"
                  actionUrl="/accounts/all"
                />
              )}
            </CardContent>
          </Card>

          {/* Dashboard Tabs */}
          <Tabs defaultValue="accounts" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
              <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
            </TabsList>

            <TabsContent value="accounts" className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  {accounts.length > 0 ? (
                    <AccountSummary accounts={accounts} banks={banks} />
                  ) : (
                    <NoDataMessage
                      message="No accounts found. Add your first account to get started."
                      actionLabel="Add Account"
                      actionUrl="/accounts/all"
                    />
                  )}
                </CardContent>
                {accounts.length > 0 && (
                  <CardFooter>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate({ to: "/accounts/all" })}
                    >
                      <ArrowUpRight className="mr-2 h-4 w-4" /> View All Accounts
                    </Button>
                  </CardFooter>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="transactions" className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  {transactions.length > 0 ? (
                    <RecentTransactions transactions={transactions} />
                  ) : (
                    <NoDataMessage
                      message="No recent transactions found."
                      actionLabel="View Transactions"
                      actionUrl="/transactions/all"
                    />
                  )}
                </CardContent>
                {transactions.length > 0 && (
                  <CardFooter>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate({ to: "/transactions/all" })}
                    >
                      <Clock className="mr-2 h-4 w-4" /> View All Transactions
                    </Button>
                  </CardFooter>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </PageContainer>
  )
}

// Skeleton loader for the dashboard
function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2">
        <div>
          <Skeleton className="h-8 w-[250px] mb-2" />
          <Skeleton className="h-5 w-[200px]" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-[120px]" />
          <Skeleton className="h-9 w-[120px]" />
        </div>
      </div>

      {/* Net Worth Card Skeleton */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="col-span-4 md:col-span-4">
          <Skeleton className="h-[180px] w-full rounded-xl" />
        </div>
      </div>

      {/* Wealth Chart Skeleton */}
      <Skeleton className="h-[400px] w-full rounded-xl" />

      {/* Tabs Skeleton */}
      <div>
        <Skeleton className="h-10 w-full mb-6 rounded-lg" />
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    </div>
  )
}
