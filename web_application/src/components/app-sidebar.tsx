import { useRouter } from "@tanstack/react-router"
import {
  ArrowRightLeft,
  Briefcase,
  Command,
  LineChart,
  PieChart,
  Receipt,
  RefreshCw,
  SquareTerminal,
  Wallet
} from "lucide-react"
import * as React from "react"
import { useMemo } from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { useUser } from "@/hooks/use-user.ts"
import { userStorage } from "@/utils/user-storage"

// Move static data to a separate constant and memoize it
const STATIC_DATA = {
  teams: [
    {
      name: "Personal",
      logo: Wallet,
      plan: "Pro",
    },
    {
      name: "Family",
      logo: Command,
      plan: "Free",
    },
    {
      name: "Business",
      logo: Receipt,
      plan: "Enterprise",
    },
  ],
  navMain: [
    {
      title: "Overview",
      url: "/dashboard",
      icon: SquareTerminal,
    },
    {
      title: "Wealth",
      url: "/wealth",
      icon: LineChart,
    },
    {
      title: "Accounts",
      url: "/accounts",
      icon: Wallet,
      items: [
        {
          title: "All Accounts",
          url: "/accounts/all",
        },
        {
          title: "Regular Accounts",
          url: "/accounts/regular",
        },
        {
          title: "Expense Accounts",
          url: "/accounts/expense",
        },
        {
          title: "Income Accounts",
          url: "/accounts/income",
        },
      ],
    },
    {
      title: "Transactions",
      url: "/transactions",
      icon: ArrowRightLeft,
      items: [
        {
          title: "All Transactions",
          url: "/transactions/all",
        },
        {
          title: "Income",
          url: "/transactions/income",
        },
        {
          title: "Expense",
          url: "/transactions/expense",
        },
        {
          title: "Transfer",
          url: "/transactions/transfer",
        },
        {
          title: "Investments",
          url: "/investmentTransactions",
        },
      ],
    },
    {
      title: "Investments",
      url: "/investments",
      icon: Briefcase,
    },
    {
      title: "Categories",
      url: "/categories",
      icon: PieChart,
    },
    {
      title: "Refunds",
      url: "/refunds",
      icon: RefreshCw,
    }
  ],
} as const

// Memoized minimal sidebar component
const MinimalSidebar = React.memo(({ className, ...props }: React.ComponentProps<typeof Sidebar>) => (
  <Sidebar
    collapsible="icon"
    className={className}
    variant="inset"
    {...props}
  >
    <SidebarHeader className="p-4">
      <TeamSwitcher teams={STATIC_DATA.teams} />
    </SidebarHeader>
    <SidebarContent className="px-2">
      <SidebarGroup>
        <NavMain items={STATIC_DATA.navMain} />
      </SidebarGroup>
    </SidebarContent>
    <SidebarRail />
  </Sidebar>
))
MinimalSidebar.displayName = "MinimalSidebar"

export function AppSidebar({ className, ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const currentPath = router.state.location.pathname
  const { user, isLoading, error } = useUser()
  const token = userStorage.getToken()

  if (userStorage.shouldFetchUser()) {
    userStorage.fetchUser()
  }

  // Memoize navMain with active states
  const navMainWithActive = useMemo(() =>
    STATIC_DATA.navMain.map(item => ({
      ...item,
      isActive: currentPath === item.url ||
                (item.items?.some(subItem => currentPath === subItem.url) ?? false),
      items: item.items?.map(subItem => ({
        ...subItem,
        isActive: currentPath === subItem.url
      }))
    })), [currentPath])

  // If there's no token or we're loading, show minimal sidebar
  if (!token || isLoading) {
    return <MinimalSidebar className={className} {...props} />
  }

  if (error) {
    console.error('User data fetch error:', error)
  }

  // Memoize the split navigation sections
  const navSections = useMemo(() => ({
    first: navMainWithActive.slice(0, 1),
    second: navMainWithActive.slice(1, 4),
    third: navMainWithActive.slice(4)
  }), [navMainWithActive])

  return (
    <Sidebar
      collapsible="icon"
      className={className}
      variant="inset"
      {...props}
    >
      <SidebarHeader className="p-4">
        <TeamSwitcher teams={STATIC_DATA.teams} />
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup>
          <NavMain items={navSections.first} />
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <NavMain items={navSections.second} />
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <NavMain items={navSections.third} />
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        {user && (
          <NavUser
            user={user}
            data-debug={JSON.stringify(user)}
          />
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
