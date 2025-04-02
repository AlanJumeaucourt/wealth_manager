import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { DatePicker } from "@/components/ui/datePicker"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AccountDetailPage } from "@/pages/AccountDetailPage"
import { AccountsPage } from "@/pages/AccountsPage"
import Categories from "@/pages/Categories"
import { Dashboard } from "@/pages/Dashboard"
import GoCardlessAccounts from "@/pages/GoCardlessAccounts"
import { InvestmentDetailPage } from "@/pages/InvestmentDetailPage"
import { useDateRangeStore } from '@/store/dateRangeStore'
import { Outlet, RootRoute, Route, Router, redirect, useRouter } from "@tanstack/react-router"
import { parse } from "date-fns"
import { KeyboardShortcutsHelp } from "./components/keyboard-shortcuts-help"
import ConnectBank from "./pages/ConnectBank"
import GoCardlessCallback from "./pages/GoCardlessCallback"
import { InvestmentsTransactionPage } from "./pages/InvestmentsTransactionPage"
import { Landing } from "./pages/Landing"
import { RefundsPage } from "./pages/RefundsPage"
import { TransactionDetailPage } from "./pages/TransactionDetailPage"
import { TransactionsPage } from "./pages/TransactionsPage"
import { Wealth } from "./pages/Wealth"
import { InvestmentsPage } from "./pages/investmentsPage"
import { Signup } from "./pages/Signup"

// Create a root route without search params validation
const rootRoute = new RootRoute({
  component: Root,
})

const authenticatedLayout = new Route({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  beforeLoad: async () => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      throw redirect({
        to: "/",
      })
    }
  },
  component: AuthenticatedLayout,
})

const dataMinDate = parse('2020-01-01', 'yyyy-MM-dd', new Date())
const dataMaxDate = parse('2025-12-31', 'yyyy-MM-dd', new Date())

function AuthenticatedLayout() {
  const router = useRouter()
  const currentPath = router.state.location.pathname
  const { fromDate, toDate, setFromDate, setToDate } = useDateRangeStore()

  // Helper function to get breadcrumb title
  const getBreadcrumbTitle = (path: string) => {
    const segments = path.split('/').filter(Boolean)
    const lastSegment = segments[segments.length - 1]

    if (!lastSegment) return 'Dashboard'

    // Handle nested routes
    if (segments.length > 1) {
      const parentSegment = segments[segments.length - 2]
      switch (parentSegment) {
        case 'accounts':
          switch (lastSegment) {
            case 'all': return 'All Accounts'
            case 'regular': return 'Regular Accounts'
            case 'expense': return 'Expense Accounts'
            case 'income': return 'Income Accounts'
            default: return 'Accounts'
          }
        case 'transactions':
          switch (lastSegment) {
            case 'all': return 'All Transactions'
            case 'income': return 'Income Transactions'
            case 'expense': return 'Expense Transactions'
            case 'transfer': return 'Transfer Transactions'
            default: return 'Transactions'
          }
        default:
          return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)
      }
    }

    return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)
  }

  // Helper function to get home link
  const getHomeLink = (path: string) => {
    const segments = path.split('/').filter(Boolean)
    if (segments.length > 1) {
      return `/${segments[0]}`
    }
    return '/dashboard'
  }

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b sticky top-0 z-10 bg-background transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4 w-full justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href={getHomeLink(currentPath)}>
                      {currentPath.includes('/accounts') ? 'Accounts' :
                       currentPath.includes('/transactions') ? 'Transactions' :
                       'Home'}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{getBreadcrumbTitle(currentPath)}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            {/* DatePickers */}
            <div className="flex space-x-4 pt-2 pr-8">
              <DatePicker
                selectedDate={fromDate}
                onDateChange={(date) => {
                  if (date) {
                    setFromDate(date)
                  }
                }}
                minDate={dataMinDate}
                maxDate={dataMaxDate}
              />
              <DatePicker
                selectedDate={toDate}
                onDateChange={(date) => {
                  if (date) {
                    setToDate(date)
                  }
                }}
                minDate={dataMinDate}
                maxDate={dataMaxDate}
              />
            </div>
            <KeyboardShortcutsHelp />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function Root() {
  return <Outlet />
}

// Create routes
const landingRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Landing,
})

const signupRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/signup",
  component: Signup,
})

const dashboardRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/dashboard",
  component: Dashboard,
})

// Accounts routes
const accountsAllRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/accounts/all",
  component: () => <AccountsPage defaultType="all" />,
})

const accountsRegularRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/accounts/regular",
  component: () => <AccountsPage defaultType="checking,savings,investment" />,
})

const accountsExpenseRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/accounts/expense",
  component: () => <AccountsPage defaultType="expense" />,
})

const accountsIncomeRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/accounts/income",
  component: () => <AccountsPage defaultType="income" />,
})

// Add new account detail route
export const accountDetailRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/accounts/$accountId",
  validateSearch: (search: Record<string, unknown>) => ({}),
  component: AccountDetailPage,
  load: async ({ params: { accountId } }: { params: { accountId: string } }) => {
    return {
      accountId: parseInt(accountId)
    }
  }
})

// Transactions routes
export const transactionsAllRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/transactions/all",
  validateSearch: (search: Record<string, unknown>) => ({
    account: search.account as string | undefined,
    category: search.category as string | undefined,
    type: search.type as string | undefined,
    date_range: search.date_range as string | undefined,
    sort_field: search.sort_field as string | undefined,
    sort_direction: search.sort_direction as string | undefined,
    page: search.page as string | undefined,
    search: search.search as string | undefined,
  }),
  component: () => <TransactionsPage defaultType="all" />,
})

const transactionsIncomeRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/transactions/income",
  validateSearch: (search: Record<string, unknown>) => ({
    account: search.account as string | undefined,
    category: search.category as string | undefined,
    type: search.type as string | undefined,
    date_range: search.date_range as string | undefined,
    sort_field: search.sort_field as string | undefined,
    sort_direction: search.sort_direction as string | undefined,
    page: search.page as string | undefined,
    search: search.search as string | undefined,
  }),
  component: () => <TransactionsPage defaultType="income" />,
})

const transactionsExpenseRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/transactions/expense",
  validateSearch: (search: Record<string, unknown>) => ({
    account: search.account as string | undefined,
    category: search.category as string | undefined,
    type: search.type as string | undefined,
    date_range: search.date_range as string | undefined,
    sort_field: search.sort_field as string | undefined,
    sort_direction: search.sort_direction as string | undefined,
    page: search.page as string | undefined,
    search: search.search as string | undefined,
  }),
  component: () => <TransactionsPage defaultType="expense" />,
})

const transactionsTransferRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/transactions/transfer",
  validateSearch: (search: Record<string, unknown>) => ({
    account: search.account as string | undefined,
    category: search.category as string | undefined,
    type: search.type as string | undefined,
    date_range: search.date_range as string | undefined,
    sort_field: search.sort_field as string | undefined,
    sort_direction: search.sort_direction as string | undefined,
    page: search.page as string | undefined,
    search: search.search as string | undefined,
  }),
  component: () => <TransactionsPage defaultType="transfer" />,
})

// Add new transaction detail route
export const transactionDetailRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/transactions/$transactionId",
  component: () => <TransactionDetailPage />,
  load: async ({ params: { transactionId } }: { params: { transactionId: number } }) => {
    return {
      transactionId: transactionId
    }
  }
})

const categoriesRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/categories",
  component: Categories,
})

// Add this with the other routes
const wealthRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/wealth",
  component: Wealth,
})

// Add these with the other routes
const accountsIndexRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/accounts",
  validateSearch: (search: Record<string, unknown>) => ({}),
  component: () => null,
  beforeLoad: () => {
    throw redirect({
      to: "/accounts/all",
    })
  },
})

const transactionsIndexRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/transactions",
  validateSearch: (search: Record<string, unknown>) => ({}),
  component: () => null,
  beforeLoad: () => {
    throw redirect({
      to: "/transactions/all",
    })
  },
})

const refundsRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/refunds",
  component: RefundsPage,
})

const investmentsRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/investmentTransactions",
  component: InvestmentsTransactionPage,
})

const investmentsPageRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/investments",
  component: InvestmentsPage,
})

export const investmentDetailRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/investments/assets/$symbol",
  component: InvestmentDetailPage,
  load: async ({ params: { symbol } }: { params: { symbol: string } }) => {
    return {
      symbol
    }
  }
})

// GoCardless routes
const goCardlessCallbackRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/gocardless/callback",
  component: GoCardlessCallback,
})

const connectBankRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/connect-bank",
  component: ConnectBank,
})

// Add this with the other routes definition (around line 395)
const settingsRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/settings",
  component: () => <div className="p-8"><h1 className="text-3xl font-bold mb-4">Settings</h1><p>Settings page content will go here.</p></div>,
})

const gocardlessAccountsRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/accounts/gocardless",
  component: GoCardlessAccounts,
})

// Define the route tree
export const routeTree = rootRoute.addChildren([
  landingRoute,
  signupRoute,
  authenticatedLayout.addChildren([
    dashboardRoute,
    // Accounts routes
    accountsAllRoute,
    accountsRegularRoute,
    accountsExpenseRoute,
    accountsIncomeRoute,
    gocardlessAccountsRoute,
    accountDetailRoute,
    // Transactions routes
    transactionsAllRoute,
    transactionsIncomeRoute,
    transactionsExpenseRoute,
    transactionsTransferRoute,
    transactionDetailRoute,
    // Investments routes
    investmentsRoute,
    investmentDetailRoute,
    investmentsPageRoute,
    // Categories route
    categoriesRoute,
    // Wealth route
    wealthRoute,
    // Refunds route
    refundsRoute,
    // Settings routes
    settingsRoute,
    // GoCardless routes
    connectBankRoute,
    goCardlessCallbackRoute,
  ]),
])

// Create the router using your route tree
export const router = new Router({ routeTree })

// Register your router for maximum type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
