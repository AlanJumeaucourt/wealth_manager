import { useAccounts, useAssets, useLiabilities, useTransactions } from "@/api/queries"
import { Button } from "@/components/ui/button"
import { useCommandPalette } from "@/hooks/useCommandPalette"
import { useRouter } from "@tanstack/react-router"
import { Bell, CalendarDays, Search, Settings } from "lucide-react"
import { useState } from "react"

interface WelcomeHeaderProps {
  greeting: string
  currentTime: Date
  userName: string
}

export function WelcomeHeader({ greeting, currentTime, userName }: WelcomeHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()
  const { open } = useCommandPalette()

  // Search hooks (limit to 5 results per type)
  const { data: accountsData, isLoading: accountsLoading } = useAccounts({ search: searchQuery, per_page: 5, page: 1 })
  const { data: assetsData, isLoading: assetsLoading } = useAssets({ search: searchQuery, per_page: 5, page: 1 })
  const { data: transactionsData, isLoading: transactionsLoading } = useTransactions({ search: searchQuery, per_page: 5, page: 1 })
  // Only pass supported filters to useLiabilities (no pagination)
  const { data: liabilitiesData, isLoading: liabilitiesLoading } = useLiabilities({})

  const isLoading = accountsLoading || assetsLoading || transactionsLoading || liabilitiesLoading

  const toggleSearch = () => setIsSearchOpen(!isSearchOpen)

  return (
    <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-t-xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {greeting}, <span className="text-primary">{userName}</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            {currentTime.toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={open}
          >
            <Search className="h-5 w-5" />
            <span className="sr-only">Search</span>
          </Button>

          <Button variant="ghost" size="icon" className="rounded-full">
            <CalendarDays className="h-5 w-5" />
            <span className="sr-only">Calendar</span>
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Notifications</span>
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Settings className="h-5 w-5" />
            <span className="sr-only">Settings</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
