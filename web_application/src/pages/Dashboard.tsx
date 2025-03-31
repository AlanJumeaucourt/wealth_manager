import {
  useAccounts,
  useBanks,
  useTransactions,
  useWealthOverTime
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

export function Dashboard() {
  const navigate = useNavigate()

  const {
    data: banksResponse,
    isLoading: isLoadingBanks,
    error: banksError
  } = useBanks({
    page: 1,
    per_page: 1000
  })

  const {
    data: accountsResponse,
    isLoading: isLoadingAccounts,
    error: accountsError
  } = useAccounts({
    type: "checking,savings,investment",
    page: 1,
    per_page: 1000
  })

  const {
    data: wealthData,
    isLoading: isLoadingWealth,
    error: wealthError
  } = useWealthOverTime()

  const {
    data: transactionsResponse,
    isLoading: isLoadingTransactions,
    error: transactionsError
  } = useTransactions({
    page: 1,
    per_page: 5,
    sort_by: 'date',
    sort_order: 'desc'
  })

  const isLoading = isLoadingBanks || isLoadingAccounts || isLoadingWealth || isLoadingTransactions
  const hasError = banksError || accountsError || wealthError || transactionsError

  const banks = banksResponse?.items || []
  const accounts = accountsResponse?.items || []
  const transactions = transactionsResponse?.items || []

  useKeyboardShortcuts({
    onNew: () => navigate({ to: "/accounts/new" }),
    onEdit: () => navigate({ to: "/accounts" }),
    onDelete: () => navigate({ to: "/accounts" }),
    onHome: () => window.scrollTo({ top: 0, behavior: "smooth" }),
    onEnd: () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }),
    onPrevPage: () => navigate({ to: "/transactions" }),
    onNextPage: () => navigate({ to: "/wealth" }),
  })

  if (hasError) {
    return (
      <PageContainer title="Financial Dashboard">
        <div className="p-6">
          <Alert variant="destructive">
            <AlertDescription>
              There was an error loading your dashboard. Please try again later.
            </AlertDescription>
          </Alert>
        </div>
      </PageContainer>
    )
  }

  const NoDataMessage = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
      <Icons.noData className="h-12 w-12 mb-4 opacity-50" />
      <p>{message}</p>
    </div>
  )

  return (
    <PageContainer title="Financial Dashboard">
      <div className="space-y-6 p-6">
        {isLoading ? (
          <>
            {/* Wealth Chart Skeleton */}
            <div className="rounded-xl border bg-card p-6">
              <Skeleton className="h-[400px] w-full" />
            </div>


            {/* Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account Summary Skeleton */}
              <div className="rounded-xl border bg-card">
                <div className="p-6">
                  <Skeleton className="h-7 w-[200px] mb-4" />
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-[150px]" />
                          <Skeleton className="h-3 w-[100px]" />
                        </div>
                        <Skeleton className="h-4 w-[100px]" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Transactions Skeleton */}
              <div className="rounded-xl border bg-card">
                <div className="p-6">
                  <Skeleton className="h-7 w-[200px] mb-4" />
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-[200px]" />
                          <Skeleton className="h-3 w-[150px]" />
                        </div>
                        <Skeleton className="h-4 w-[100px]" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border bg-card">
              {Object.keys(wealthData || {}).length > 0 ? (
                <WealthChart />
              ) : (
                <NoDataMessage message="No wealth data available. Add some accounts to see your wealth growth over time." />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border bg-card">
                {accounts.length > 0 ? (
                  <AccountSummary accounts={accounts} banks={banks} />
                ) : (
                  <NoDataMessage message="No accounts found. Add your first account to get started." />
                )}
              </div>

              <div className="rounded-xl border bg-card">
                {transactions.length > 0 ? (
                  <RecentTransactions transactions={transactions} />
                ) : (
                  <NoDataMessage message="No recent transactions found." />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  )
}
