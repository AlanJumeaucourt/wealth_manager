import { useAccounts, useAssets, useLiabilities, useTransactions } from "@/api/queries"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command"
import { DialogTitle } from "@/components/ui/dialog"
import { useCommandPalette } from "@/hooks/useCommandPalette"
import { useRouter } from "@tanstack/react-router"
import { BarChart3, Calculator, Coins, CreditCard, DollarSign, FileText, Landmark, Settings, Tags } from "lucide-react"
import React, { useEffect, useState } from "react"

// Define all searchable objects
interface SearchableItem {
  id: string | number
  name: string
  description?: string
  path: string
  type: string
  icon: JSX.Element
  metadata?: Record<string, any>
}

export function CommandPalette() {
  const { isOpen, close } = useCommandPalette()
  const [search, setSearch] = useState("")

  // Check if router is available
  const router = useRouter()
  const canUseRouter = !!router

  // Static data for page navigation
  const staticPages = [
    { name: "Dashboard", path: "/", icon: <DollarSign className="mr-2" /> },
    { name: "Accounts", path: "/accounts", icon: <Landmark className="mr-2" /> },
    { name: "Transactions", path: "/transactions", icon: <FileText className="mr-2" /> },
    { name: "Investments", path: "/investments", icon: <Coins className="mr-2" /> },
    { name: "Liabilities", path: "/liabilities", icon: <CreditCard className="mr-2" /> },
    { name: "Categories", path: "/categories", icon: <Tags className="mr-2" /> },
    { name: "Reports", path: "/reports", icon: <BarChart3 className="mr-2" /> },
    { name: "Settings", path: "/settings", icon: <Settings className="mr-2" /> },
    { name: "Wealth Overview", path: "/wealth", icon: <Calculator className="mr-2" /> },
    { name: "Export/Import", path: "/export-import", icon: <FileText className="mr-2" /> },
  ]

  // Only perform API searches when dialog is open and search has content
  const shouldSearch = isOpen && search.length > 0 && canUseRouter

  // Search hooks with proper parameters (removing 'enabled')
  const { data: accountsData, isLoading: accountsLoading } = useAccounts(
    shouldSearch
      ? { search, per_page: 10, page: 1 }
      : { per_page: 0, page: 1 } // No results when not searching
  )

  const { data: assetsData, isLoading: assetsLoading } = useAssets(
    shouldSearch
      ? { search, per_page: 10, page: 1 }
      : { per_page: 0, page: 1 }
  )

  const { data: transactionsData, isLoading: transactionsLoading } = useTransactions(
    shouldSearch
      ? { search, per_page: 10, page: 1 }
      : { per_page: 0, page: 1 }
  )

  // useLiabilities without invalid parameters
  const { data: liabilitiesData, isLoading: liabilitiesLoading } = useLiabilities(
    shouldSearch ? {} : {}
  )

  const isLoading = accountsLoading || assetsLoading || transactionsLoading || liabilitiesLoading

  // Create searchable items arrays for each type
  const accountItems = (accountsData?.items || []).map(account => ({
    id: account.id,
    name: account.name || "Unnamed Account",
    description: `${account.type || "Unknown"} • $${(account.balance || 0).toLocaleString()}`,
    path: `/accounts/${account.id}`,
    type: 'account',
    icon: <Landmark className="mr-2" />,
    metadata: account
  }));

  const assetItems = (assetsData?.items || []).map(asset => ({
    id: asset.id,
    name: `${asset.name || "Unnamed Asset"} ${asset.symbol ? `(${asset.symbol})` : ""}`,
    description: `${asset.type || "Unknown"}${asset.current_price ? ` • $${asset.current_price}` : ""}`,
    path: `/investments/assets/${asset.symbol || asset.id}`,
    type: 'asset',
    icon: <Coins className="mr-2" />,
    metadata: asset
  }));

  const transactionItems = (transactionsData?.items || []).map(tx => ({
    id: tx.id,
    name: tx.description || "Unnamed Transaction",
    description: `${tx.category || "Uncategorized"} • $${(tx.amount || 0).toLocaleString()} • ${tx.date || "No date"}`,
    path: `/transactions/${tx.id}`,
    type: 'transaction',
    icon: <FileText className="mr-2" />,
    metadata: tx
  }));

  const liabilityItems = (liabilitiesData?.items || []).map(liab => ({
    id: liab.id,
    name: liab.name || "Unnamed Liability",
    description: `${liab.liability_type || "Unknown"} • $${(liab.principal_amount || 0).toLocaleString()}`,
    path: `/liabilities/${liab.id}`,
    type: 'liability',
    icon: <CreditCard className="mr-2" />,
    metadata: liab
  }));

  // Combine all items into one array
  const allSearchableItems: SearchableItem[] = [
    ...accountItems,
    ...assetItems,
    ...transactionItems,
    ...liabilityItems
  ];


  // Filter static pages by search
  const filteredPages = search
    ? staticPages.filter(page =>
        page.name.toLowerCase().includes(search.toLowerCase())
      )
    : staticPages

  // Reset search when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSearch("")
    }
  }, [isOpen])

  const runCommand = (command: () => void) => {
    close()
    command()
  }

  // Navigate to a specific path
  const navigateTo = (path: string) => {
    if (router) {
      router.navigate({
        to: path as any // Type cast to work with TanStack Router
      })
    }
  }

  // Early return if router is not available
  if (!canUseRouter) {
    return null
  }

  // Group items by type for display
  const groupedItems: Record<string, SearchableItem[]> = {}

  // Populate the grouped items
  allSearchableItems.forEach(item => {
    if (!groupedItems[item.type]) {
      groupedItems[item.type] = []
    }
    groupedItems[item.type].push(item)
  })

  // Map of types to their display names
  const typeInfo = {
    account: { name: "Accounts", icon: <Landmark className="mr-2" /> },
    asset: { name: "Assets", icon: <Coins className="mr-2" /> },
    transaction: { name: "Transactions", icon: <FileText className="mr-2" /> },
    liability: { name: "Liabilities", icon: <CreditCard className="mr-2" /> }
  }

  // Check if we have any results
  const hasResults = allSearchableItems.length > 0;

  return (
    <CommandDialog open={isOpen} onOpenChange={close}>
      <DialogTitle className="sr-only">Search Command Palette</DialogTitle>

      <CommandInput
        id="command-palette-input"
        placeholder="Search across accounts, assets, transactions and more..."
        value={search}
        onValueChange={setSearch}
        autoFocus
      />
      <CommandList>
        {/* Pages navigation */}
        {filteredPages.length > 0 && (
          <>
            <CommandGroup heading="Pages">
              {filteredPages.map(page => (
                <CommandItem
                  key={`page-${page.path}`}
                  onSelect={() => runCommand(() => navigateTo(page.path))}
                >
                  {page.icon}
                  <span>{page.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {(search && hasResults) && <CommandSeparator />}
          </>
        )}

        {/* Search results for all items */}
        {search && hasResults ? (
          // Display results if we have any
          <>
            {Object.entries(groupedItems).map(([type, items], index, array) => (
              <React.Fragment key={`group-${type}`}>
                <CommandGroup heading={typeInfo[type as keyof typeof typeInfo]?.name || type}>
                  {items.map(item => (
                    <CommandItem
                      key={`${type}-${item.id}`}
                      onSelect={() => runCommand(() => navigateTo(item.path))}
                      value={`${item.name} ${item.description || ''}`}
                    >
                      {item.icon}
                      <div className="flex flex-col">
                        <span>{item.name}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {index < array.length - 1 && <CommandSeparator />}
              </React.Fragment>
            ))}
          </>
        ) : (
          // Only show empty state when no results and not loading
          search && !isLoading && (
            <CommandEmpty>
              No results found for "{search}"
            </CommandEmpty>
          )
        )}

        {/* Loading state */}
        {isLoading && (
          <CommandEmpty>
            Loading...
          </CommandEmpty>
        )}
      </CommandList>
    </CommandDialog>
  )
}
