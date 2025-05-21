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
import { Bell, CalendarDays, Search, Settings, X, Landmark, Coins, FileText, CreditCard } from "lucide-react"
import { useState } from "react"
import { useAccounts, useAssets, useTransactions, useLiabilities } from "@/api/queries"
import { useRouter } from "@tanstack/react-router"

interface WelcomeHeaderProps {
  greeting: string
  currentTime: Date
  userName: string
}

export function WelcomeHeader({ greeting, currentTime, userName }: WelcomeHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()

  // Search hooks (limit to 5 results per type)
  const { data: accountsData, isLoading: accountsLoading } = useAccounts({ search: searchQuery, per_page: 5, page: 1 })
  const { data: assetsData, isLoading: assetsLoading } = useAssets({ search: searchQuery, per_page: 5, page: 1 })
  const { data: transactionsData, isLoading: transactionsLoading } = useTransactions({ search: searchQuery, per_page: 5, page: 1 })
  // Only pass supported filters to useLiabilities (no pagination)
  const { data: liabilitiesData, isLoading: liabilitiesLoading } = useLiabilities({ search: searchQuery, per_page: 5, page: 1 })

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
                    {isLoading && <div className="text-center text-xs text-muted-foreground py-2">Loading...</div>}
                    {!isLoading && (
                      <>
                        {/* Accounts */}
                        {(accountsData?.items?.length ?? 0) > 0 && (
                          <div className="rounded-lg p-2">
                            <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-muted-foreground">
                              <Landmark className="w-4 h-4" /> Accounts
                            </div>
                            {accountsData?.items?.slice(0, 5).map(account => (
                              <DropdownMenuItem
                                key={"account-"+account.id}
                                className="group rounded-md cursor-pointer px-2 py-2 transition-colors hover:bg-primary/10"
                                onClick={() => {
                                  setIsSearchOpen(false)
                                  router.navigate({ to: `/accounts/${account.id}` })
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm text-foreground">{account.name}</span>
                                  <span className="text-xs text-muted-foreground">{account.type} &bull; ${account.balance.toLocaleString()}</span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </div>
                        )}
                        {/* Assets */}
                        {(assetsData?.items?.length ?? 0) > 0 && (
                          <div className="rounded-lg p-2">
                            <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-muted-foreground">
                              <Coins className="w-4 h-4" /> Assets
                            </div>
                            {assetsData?.items?.slice(0, 5).map(asset => (
                              <DropdownMenuItem
                                key={"asset-"+asset.id}
                                className="group rounded-md cursor-pointer px-2 py-2 transition-colors hover:bg-primary/10"
                                onClick={() => {
                                  setIsSearchOpen(false)
                                  router.navigate({ to: `/investments/assets/${asset.symbol}` })
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm text-foreground">{asset.name} <span className="text-xs text-muted-foreground">({asset.symbol})</span></span>
                                  <span className="text-xs text-muted-foreground">{asset.type}{asset.current_price ? ` • $${asset.current_price}` : ""}</span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </div>
                        )}
                        {/* Transactions */}
                        {(transactionsData?.items?.length ?? 0) > 0 && (
                          <div className="rounded-lg p-2">
                            <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-muted-foreground">
                              <FileText className="w-4 h-4" /> Transactions
                            </div>
                            {transactionsData?.items?.slice(0, 5).map(tx => (
                              <DropdownMenuItem
                                key={"tx-"+tx.id}
                                className="group rounded-md cursor-pointer px-2 py-2 transition-colors hover:bg-primary/10"
                                onClick={() => {
                                  setIsSearchOpen(false)
                                  router.navigate({ to: `/transactions/${tx.id}` })
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm text-foreground">{tx.description}</span>
                                  <span className="text-xs text-muted-foreground">{tx.category} • ${tx.amount.toLocaleString()} • {tx.date}</span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </div>
                        )}
                        {/* Liabilities */}
                        {(liabilitiesData?.items?.length ?? 0) > 0 && (
                          <div className="rounded-lg p-2">
                            <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-muted-foreground">
                              <CreditCard className="w-4 h-4" /> Liabilities
                            </div>
                            {liabilitiesData?.items?.slice(0, 5).map(liab => (
                              <DropdownMenuItem
                                key={"liab-"+liab.id}
                                className="group rounded-md cursor-pointer px-2 py-2 transition-colors hover:bg-primary/10"
                                onClick={() => {
                                  setIsSearchOpen(false)
                                  router.navigate({ to: `/liabilities/${liab.id}` })
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm text-foreground">{liab.name}</span>
                                  <span className="text-xs text-muted-foreground">{liab.liability_type} • ${liab.principal_amount.toLocaleString()}</span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                          </div>
                        )}
                        {/* No results */}
                        {(accountsData?.items?.length ?? 0) === 0 && (assetsData?.items?.length ?? 0) === 0 && (transactionsData?.items?.length ?? 0) === 0 && (liabilitiesData?.items?.length ?? 0) === 0 && (
                          <div className="text-center text-xs text-muted-foreground py-2">No results found.</div>
                        )}
                      </>
                    )}
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
