import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Bell, CalendarDays, Search, Settings, X } from "lucide-react"
import { useState } from "react"

interface WelcomeHeaderProps {
  greeting: string
  currentTime: Date
  userName: string
}

export function WelcomeHeader({ greeting, currentTime, userName }: WelcomeHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

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
          <DropdownMenu open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Search className="h-5 w-5" />
                <span className="sr-only">Search</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 p-3" align="end">
              <div className="flex items-center gap-2 mb-2">
                <Input
                  placeholder="Search transactions or accounts..."
                  className="flex-1"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsSearchOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {searchQuery && (
                <>
                  <DropdownMenuLabel>Results</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="max-h-[300px] overflow-y-auto">
                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Accounts</DropdownMenuLabel>
                    <DropdownMenuItem>Checking Account (****1234)</DropdownMenuItem>
                    <DropdownMenuItem>Savings Account (****5678)</DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Transactions</DropdownMenuLabel>
                    <DropdownMenuItem>Coffee Shop - $4.50</DropdownMenuItem>
                    <DropdownMenuItem>Grocery Store - $65.32</DropdownMenuItem>
                    <DropdownMenuItem>Monthly Subscription - $9.99</DropdownMenuItem>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

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
