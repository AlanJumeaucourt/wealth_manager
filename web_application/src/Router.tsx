import { AppRoot } from "@/components/router/AppRoot";
import { AuthenticatedLayout } from "@/components/router/AuthenticatedLayout";
import { AccountDetailPage } from "@/pages/AccountDetailPage";
import { AccountsPage } from "@/pages/AccountsPage";
import BudgetSetup from "@/pages/BudgetSetup";
import Categories from "@/pages/Categories";
import GoCardlessAccounts from "@/pages/GoCardlessAccounts";
import { InvestmentDetailPage } from "@/pages/InvestmentDetailPage";
import Liabilities from "@/pages/Liabilities";
import LiabilityDetail from "@/pages/LiabilityDetail";
import { Welcome } from "@/pages/Welcome";

import { type AnyRoute, RootRoute, Route, Router, redirect } from "@tanstack/react-router";

import ConnectBank from "./pages/ConnectBank";
import { ExportImportPage } from "./pages/ExportImportPage";
import GoCardlessCallback from "./pages/GoCardlessCallback";
import { InvestmentsPage } from "./pages/investmentsPage";
import { InvestmentsTransactionPage } from "./pages/InvestmentsTransactionPage";
import { Landing } from "./pages/Landing";
import { PotentialRefundsPage } from "./pages/PotentialRefundsPage";
import { RefundsPage } from "./pages/RefundsPage";
import { SettingsPage } from "./pages/Settings";
import { Signup } from "./pages/Signup";
import { TransactionDetailPage } from "./pages/TransactionDetailPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { AssistantPage } from "./pages/AssistantPage";
import { Wealth } from "./pages/Wealth";

// Create a root route without search params validation
const rootRoute = new RootRoute({
  component: AppRoot,
});

const authenticatedLayout = new Route({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  beforeLoad: async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      throw redirect({
        to: "/",
      });
    }
  },
  component: AuthenticatedLayout,
});

// Create routes
const landingRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Landing,
});

const signupRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/signup",
  component: Signup,
});

const dashboardRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/dashboard",
  component: Welcome,
});

// Accounts routes
const accountsAllRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/accounts/all",
  component: () => <AccountsPage defaultType="all" />,
});

const accountsRegularRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/accounts/regular",
  component: () => <AccountsPage defaultType="owned" />,
});

const accountsExpenseRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/accounts/expense",
  component: () => <AccountsPage defaultType="expense" />,
});

const accountsIncomeRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/accounts/income",
  component: () => <AccountsPage defaultType="income" />,
});

// Add new account detail route
export const accountDetailRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/accounts/$accountId",
  validateSearch: () => ({}),
  component: AccountDetailPage,
  loader: async ({ params: { accountId } }: { params: { accountId: string } }) => {
    return {
      accountId: parseInt(accountId),
    };
  },
});

// Transactions routes
const transactionsAllRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/transactions/all",
  validateSearch: (search: Record<string, unknown>) => ({
    accountId: search.accountId as number | undefined,
    category: search.category as string | undefined,
    type: search.type as string | undefined,
    date_range: search.date_range as string | undefined,
    sort_field: search.sort_field as string | undefined,
    sort_direction: search.sort_direction as string | undefined,
    page: search.page as string | undefined,
    search: search.search as string | undefined,
  }),
  component: () => <TransactionsPage defaultType="all" />,
});

const transactionsIncomeRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/transactions/income",
  validateSearch: (search: Record<string, unknown>) => ({
    accountId: search.accountId as number | undefined,
    category: search.category as string | undefined,
    type: search.type as string | undefined,
    date_range: search.date_range as string | undefined,
    sort_field: search.sort_field as string | undefined,
    sort_direction: search.sort_direction as string | undefined,
    page: search.page as string | undefined,
    search: search.search as string | undefined,
  }),
  component: () => <TransactionsPage defaultType="income" />,
});

const transactionsExpenseRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/transactions/expense",
  validateSearch: (search: Record<string, unknown>) => ({
    accountId: search.accountId as number | undefined,
    category: search.category as string | undefined,
    type: search.type as string | undefined,
    date_range: search.date_range as string | undefined,
    sort_field: search.sort_field as string | undefined,
    sort_direction: search.sort_direction as string | undefined,
    page: search.page as string | undefined,
    search: search.search as string | undefined,
  }),
  component: () => <TransactionsPage defaultType="expense" />,
});

const transactionsTransferRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/transactions/transfer",
  validateSearch: (search: Record<string, unknown>) => ({
    accountId: search.accountId as number | undefined,
    category: search.category as string | undefined,
    type: search.type as string | undefined,
    date_range: search.date_range as string | undefined,
    sort_field: search.sort_field as string | undefined,
    sort_direction: search.sort_direction as string | undefined,
    page: search.page as string | undefined,
    search: search.search as string | undefined,
  }),
  component: () => <TransactionsPage defaultType="transfer" />,
});

// Add new transaction detail route
export const transactionDetailRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/transactions/$transactionId",
  component: () => <TransactionDetailPage />,
  loader: async ({ params: { transactionId } }: { params: { transactionId: number } }) => {
    return {
      transactionId: transactionId,
    };
  },
});

const categoriesRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/categories",
  component: Categories,
});

const budgetSetupRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/budget-setup",
  component: BudgetSetup,
});

// Add this with the other routes
const wealthRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/wealth",
  component: Wealth,
});

// Add these with the other routes
const accountsIndexRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/accounts",
  validateSearch: () => ({}),
  component: () => null,
  beforeLoad: () => {
    throw redirect({
      to: "/accounts/all",
    });
  },
});

const transactionsIndexRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/transactions",
  validateSearch: () => ({}),
  component: () => null,
  beforeLoad: () => {
    throw redirect({
      to: "/transactions/all",
    });
  },
});

const refundsPotentialRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/refunds/potential",
  component: PotentialRefundsPage,
});

const refundsRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/refunds",
  component: RefundsPage,
});

const investmentsRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/investmentTransactions",
  component: InvestmentsTransactionPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      addNew: search.addNew === "true" ? "true" : undefined,
    };
  },
});

const investmentsPageRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/investments",
  component: InvestmentsPage,
});

const investmentDetailRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/investments/assets/$symbol",
  component: InvestmentDetailPage,
  loader: async ({ params: { symbol } }: { params: { symbol: string } }) => {
    return {
      symbol,
    };
  },
});

// GoCardless routes
const goCardlessCallbackRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/gocardless/callback",
  component: GoCardlessCallback,
});

const connectBankRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/connect-bank",
  component: ConnectBank,
});

// Add this with the other routes definition (around line 395)
const assistantRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/assistant",
  component: AssistantPage,
});

const settingsRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/settings",
  component: SettingsPage,
});

const gocardlessAccountsRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/accounts/gocardless",
  component: GoCardlessAccounts,
});

// Data Manager route
const exportImportRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/export-import",
  component: ExportImportPage,
});

// Liabilities routes
const liabilitiesRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/liabilities",
  component: Liabilities,
});

const liabilityDetailRoute = new Route({
  getParentRoute: () => authenticatedLayout,
  path: "/liabilities/$liabilityId",
  component: LiabilityDetail,
  loader: async ({ params: { liabilityId } }: { params: { liabilityId: number } }) => {
    return {
      liabilityId: liabilityId,
    };
  },
});

// Define the route tree
const routeTree = rootRoute.addChildren([
  landingRoute,
  signupRoute,
  authenticatedLayout.addChildren([
    dashboardRoute,
    // Accounts routes
    accountsIndexRoute,
    accountsAllRoute,
    accountsRegularRoute,
    accountsExpenseRoute,
    accountsIncomeRoute,
    gocardlessAccountsRoute,
    accountDetailRoute,
    // Transactions routes
    transactionsIndexRoute,
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
    // Budget Setup route
    budgetSetupRoute,
    // Wealth route
    wealthRoute,
    // Refunds routes
    refundsPotentialRoute,
    refundsRoute,
    assistantRoute,
    // Settings routes
    settingsRoute,
    // GoCardless routes
    connectBankRoute,
    goCardlessCallbackRoute,
    // Export/Import route
    exportImportRoute,
    // Liabilities routes
    liabilitiesRoute,
    liabilityDetailRoute,
  ] as AnyRoute[]),
]);

// Create the router using your route tree
export const router = new Router({ routeTree });

// Register your router for maximum type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
