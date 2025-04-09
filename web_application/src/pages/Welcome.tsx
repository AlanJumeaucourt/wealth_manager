import { Suspense, useEffect, useState } from "react"
import { useRouter } from "@tanstack/react-router"
import {
  useAccounts,
  useBanks,
  usePortfolioPerformance,
  usePortfolioSummary,
  useTransactions,
  useWealthOverTime
} from "@/api/queries"
import { PageContainer } from "@/components/layout/PageContainer"
import { FinancialSummary } from "@/components/welcome/FinancialSummary"
import { WelcomeHeader } from "@/components/welcome/WelcomeHeader"
import { PortfolioHighlights } from "@/components/welcome/PortfolioHighlights"
import { QuickActions } from "@/components/welcome/QuickActions"
import { RecentActivity } from "@/components/welcome/RecentActivity"
import { FinancialGoals } from "@/components/welcome/FinancialGoals"
import { WealthInsights } from "@/components/welcome/WealthInsights"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function Welcome() {
  const router = useRouter()
  const [greeting, setGreeting] = useState("Welcome back")
  const [currentTime, setCurrentTime] = useState(new Date())

  // Create a simplified navigation function for components
  const handleNavigate = (to: string) => {
    router.navigate({ to: to as any })
  }

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

  // Fetch main data
  const { data: accountsResponse, isLoading: isLoadingAccounts, error: accountsError } = useAccounts({
    page: 1,
    per_page: 9999,
  })

  const { data: banksResponse, isLoading: isLoadingBanks, error: banksError } = useBanks({
    page: 1,
    per_page: 100,
  })

  const { data: transactionsResponse, isLoading: isLoadingTransactions, error: transactionsError } = useTransactions({
    page: 1,
    per_page: 5,
    sort_by: "date",
    sort_order: "desc",
  })

  const { data: wealthData, isLoading: isLoadingWealth, error: wealthError } = useWealthOverTime()
  const { data: portfolioSummary, isLoading: isLoadingPortfolio, error: portfolioError } = usePortfolioSummary()
  const { data: performanceData, isLoading: isLoadingPerformance, error: performanceError } = usePortfolioPerformance("1Y")

  const isLoading = isLoadingAccounts || isLoadingBanks || isLoadingTransactions ||
                     isLoadingWealth || isLoadingPortfolio || isLoadingPerformance

  const hasError = accountsError || banksError || transactionsError ||
                    wealthError || portfolioError || performanceError

  const accounts = accountsResponse?.items || []
  const banks = banksResponse?.items || []
  const transactions = transactionsResponse?.items || []

  if (hasError) {
    return (
      <PageContainer title="Welcome to WealthManager">
        <Alert variant="destructive">
          <AlertDescription>
            There was an error loading your financial data. Please try again later.
          </AlertDescription>
        </Alert>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="p-0 overflow-hidden">
      {isLoading ? (
        <WelcomeSkeleton />
      ) : (
        <div className="flex flex-col gap-8">
          {/* Welcome Header */}
          <WelcomeHeader
            greeting={greeting}
            currentTime={currentTime}
            userName="User"
          />

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6">
            {/* Left Column - Financial Summary & Portfolio */}
            <div className="lg:col-span-2 space-y-6">
              <FinancialSummary
                accounts={accounts.filter(account => account.type == "checking" || account.type == "savings" || account.type == "investment")}
                wealthData={wealthData || []}
              />

              <Suspense fallback={<Skeleton className="h-[200px] w-full rounded-xl" />}>
                <PortfolioHighlights
                  portfolioSummary={portfolioSummary}
                  performanceData={performanceData}
                />
              </Suspense>

              <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}>
                <WealthInsights
                  wealthData={wealthData || []}
                  accounts={accounts.filter(account => account.type == "checking" || account.type == "savings" || account.type == "investment")}
                />
              </Suspense>
            </div>

            {/* Right Column - Quick Actions & Recent Activity */}
            <div className="space-y-6">
              <QuickActions navigate={handleNavigate} />

              <RecentActivity
                transactions={transactions}
                accounts={accounts}
                navigate={handleNavigate}
              />

              <FinancialGoals accounts={accounts} />
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}

function WelcomeSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {/* Header Skeleton */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-t-xl">
        <Skeleton className="h-8 w-[250px] mb-2" />
        <Skeleton className="h-5 w-[200px]" />
      </div>

      {/* Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <Skeleton className="h-[250px] w-full rounded-xl" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-[150px] w-full rounded-xl" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
