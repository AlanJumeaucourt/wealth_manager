import { useAccounts, useDeleteAccount } from "@/api/queries"
import { AccountForm } from "@/components/accounts/AccountForm"
import { AddBankDialog } from "@/components/accounts/AddBankDialog"
import { DeleteAccountDialog } from "@/components/accounts/DeleteAccountDialog"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS } from "@/constants"
import { useDebounce } from "@/hooks/use-debounce"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useToast } from "@/hooks/use-toast"
import { Account } from "@/types"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { Plus, Search, Trash } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

// Account type system
type AccountType = "checking" | "savings" | "investment" | "expense" | "income" | "loan"
type AccountTypeGroup = "all" | "owned" | "expense" | "income" | "checking" | "savings" | "investment" | "loan"

interface AccountsPageProps {
  defaultType?: AccountTypeGroup | "new" | "link"
}

type SortField = "name" | "type" | "bank"
type SortDirection = "asc" | "desc"

// Type helper functions
const isRegularAccount = (type: AccountType): boolean =>
  ["checking", "savings", "investment", "loan"].includes(type)

const isAccountTypeInGroup = (accountType: AccountType, group: AccountTypeGroup): boolean => {
  if (group === "all") return true
  if (group === "owned") return isRegularAccount(accountType)
  if (group === "expense") return accountType === "expense"
  if (group === "income") return accountType === "income"
  return accountType === group
}

const shouldShowAccountType = (type: AccountType, selectedType: AccountTypeGroup): boolean => {
  if (selectedType === "all") return true
  if (selectedType === "owned") return isRegularAccount(type)
  return type === selectedType
}

const getPageTitle = (type: AccountTypeGroup | "new" | "link"): string => {
  switch (type) {
    case "new": return "Add Account"
    case "link": return "Link Bank Account"
    default: return "All Accounts"
  }
}

const getStatsTitle = (type: AccountTypeGroup): string => {
  switch (type) {
    case "expense": return "Total Expenses"
    case "income": return "Total Income"
    default: return "Total Net Worth"
  }
}

// Add this interface near other type definitions
interface AccountTypeColumnProps {
  type: AccountType
  selectedType: AccountTypeGroup
  title: string
  icon: string
  color: string
  accounts: Account[]
  hoveredAccount: number | null
  setHoveredAccount: (id: number | null) => void
  navigate: any
}

// Add this component near other components
const AccountTypeColumn: React.FC<AccountTypeColumnProps> = ({
  type,
  selectedType,
  title,
  icon,
  color,
  accounts,
  hoveredAccount,
  setHoveredAccount,
  navigate
}) => {
  if (!shouldShowAccountType(type, selectedType)) return null;

  return (
    <div className="flex flex-col h-full">
      <h3 className={`text-lg font-semibold ${color} mb-3 px-1`}>
        {icon} {title}
      </h3>
      <div className="overflow-y-auto flex-grow space-y-3 pr-1">
        {accounts
          .filter(a => a.type === type)
          .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
          .map(account => (
            <div
              key={account.id}
              className={`rounded-lg border border-${color.split('-')[0]}-200 p-4 cursor-pointer transition-all duration-200
                bg-${color.split('-')[0]}-50/95 backdrop-blur-sm
                ${hoveredAccount === account.id
                  ? `ring-2 ring-${color.split('-')[0]}-400 shadow-md transform scale-[1.02]`
                  : "shadow-sm hover:shadow-md hover:scale-[1.01]"
                }`}
              onMouseEnter={() => setHoveredAccount(account.id)}
              onMouseLeave={() => setHoveredAccount(null)}
              onClick={() => navigate({
                to: "/accounts/$accountId",
                params: { accountId: account.id.toString() },
              })}
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <div className={`text-xl ${color.split('-')[0]}-600`}>
                    {icon}
                  </div>
                  <div className="font-medium text-sm truncate max-w-[150px]">
                    {account.name}
                  </div>
                </div>
                <div className={`text-base font-bold ${color} mt-2`}>
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: "EUR",
                  }).format(account.balance)}
                </div>
                {account.market_value !== null && (
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        account.market_value > account.balance
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {account.market_value > account.balance ? "↑" : "↓"}{" "}
                      {(((account.market_value - account.balance) / account.balance) * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: "EUR",
                      }).format(account.market_value - account.balance)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export function AccountsPage({ defaultType = "all" }: AccountsPageProps) {
  const [selectedType] = useState<AccountTypeGroup>(defaultType as AccountTypeGroup)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField] = useState<SortField>("name")
  const [sortDirection] = useState<SortDirection>("asc")
  const [balanceSortDirection] = useState<"asc" | "desc" | null>(null)
  const itemsPerPage = 9999
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)
  const { toast } = useToast()
  const [selectedRowId] = useState<number | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const [isAddingAccount, setIsAddingAccount] = useState(false)
  const [isAddingBank, setIsAddingBank] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([])
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const navigate = useNavigate()
  const searchParams = useSearch()

  const [hoveredAccount, setHoveredAccount] = useState<number | null>(null)
  const deleteMutation = useDeleteAccount()

  const { data: accountsResponse, isLoading } = useAccounts({
    type:
      selectedType === "owned"
        ? ["checking", "savings", "investment", "loan"]
        : selectedType === "all"
          ? undefined
          : selectedType,
    page: currentPage,
    per_page: itemsPerPage,
    sort_by: sortField as keyof Account,
    sort_order: sortDirection,
    search: debouncedSearch,
  })

  const accounts = accountsResponse?.items || []

  // Sort accounts by balance if balanceSortDirection is set
  const sortedAccounts = [...(accounts || [])].sort((a, b) => {
    if (balanceSortDirection === "asc") {
      return a.balance - b.balance
    } else if (balanceSortDirection === "desc") {
      return b.balance - a.balance
    }
    return 0
  })

  const pageTitle = getPageTitle(selectedType)

  useEffect(() => {
    // Check for openAddDialog in searchParams
    if ((searchParams as Record<string, any>).openAddDialog === "true" || (searchParams as Record<string, any>).openAddDialog === true) {
      setIsAddingAccount(true)
      // Optional: remove the query param to prevent re-opening on refresh
      // navigate({ search: (prev: Record<string, any>) => ({ ...prev, openAddDialog: undefined }), replace: true });
    }
  }, [searchParams, navigate])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch])

  // Filter accounts based on selected type
  const filteredAccounts = useMemo(() => {
    return sortedAccounts.filter(account =>
      isAccountTypeInGroup(account.type as AccountType, selectedType)
    )
  }, [sortedAccounts, selectedType])

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        selectedAccounts.map(id => deleteMutation.mutateAsync(id))
      )
      toast({
        title: "🗑️ Bulk Delete Complete",
        description: "Selected accounts have been deleted.",
      })
      setSelectedAccounts([])
    } catch (error) {
      console.error("Error deleting accounts", error)
      toast({
        title: "Error",
        description: "Failed to delete some accounts. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Calculate totals for different account types
  const totals = useMemo(() => {
    const regularAccounts = filteredAccounts.filter(a => isRegularAccount(a.type as AccountType))
    const expenseAccounts = filteredAccounts.filter(a => a.type === "expense")
    const incomeAccounts = filteredAccounts.filter(a => a.type === "income")

    return {
      regular: regularAccounts.reduce((sum, a) => sum + a.balance, 0),
      expense: expenseAccounts.reduce((sum, a) => sum + a.balance, 0),
      income: incomeAccounts.reduce((sum, a) => sum + a.balance, 0),
    }
  }, [filteredAccounts])

  // Calculate balances for each account type
  const checkingBalance = filteredAccounts
    .filter(a => a.type === "checking")
    .reduce((sum, a) => sum + a.balance, 0)

  const savingsBalance = filteredAccounts
    .filter(a => a.type === "savings")
    .reduce((sum, a) => sum + a.balance, 0)

  const investmentBalance = filteredAccounts
    .filter(a => a.type === "investment")
    .reduce((sum, a) => sum + a.balance, 0)

  const loansBalance = filteredAccounts
    .filter(a => a.type === "loan")
    .reduce((sum, a) => sum + a.balance, 0)

  // Get stats text based on account types
  const getStatsText = () => {
        return {
      checking: {
        title: "Checking Accounts",
        balance: checkingBalance,
        color: "text-blue-800",
      },
      savings: {
        title: "Savings Accounts",
        balance: savingsBalance,
        color: "text-green-800",
      },
      investment: {
        title: "Investment Accounts",
        balance: investmentBalance,
        color: "text-purple-800",
      },
      loans: {
        title: "Loans",
        balance: loansBalance,
        color: "text-rose-800",
      },
    }
  }

  const statsText = getStatsText()

  useKeyboardShortcuts({
    onNew: () => {
      if (!isAddingAccount) {
        setIsAddingAccount(true)
      }
    },
    onEdit: () => {
      if (selectedRowId && !editingAccount) {
        const account = accounts.find(a => a.id === selectedRowId)
        if (account) {
          setEditingAccount(account)
        }
      }
    },
    onDelete: () => {
      if (selectedRowId && !deletingAccount) {
        const account = accounts.find(a => a.id === selectedRowId)
        if (account) {
          setDeletingAccount(account)
        }
      }
    },
    onHome: () => {
      if (tableRef.current) {
        tableRef.current.scrollTop = 0
      }
    },
    onEnd: () => {
      if (tableRef.current) {
        tableRef.current.scrollTop = tableRef.current.scrollHeight
      }
    },
  })

  return (
    <PageContainer title={pageTitle}>
      <div className="space-y-6">
        {/* Top Stats Cards */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {selectedType === "all" ? (
              <>
                {/* Income Card */}
                <div className="bg-green-50/80 rounded-xl p-6 shadow-sm border border-green-200 transition-colors hover:bg-green-50">
                  <p className="text-sm text-green-700 text-center">Total Income</p>
                  <p className="text-3xl font-bold mt-2 text-center text-green-800">
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                    }).format(totals.income)}
                  </p>
                </div>

                {/* Net Worth Card */}
                <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50 transition-colors hover:bg-card/80">
                  <p className="text-sm text-muted-foreground text-center">Total Net Worth</p>
                  <p className="text-3xl font-bold mt-2 text-center">
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                    }).format(totals.regular)}
                  </p>
                </div>

                {/* Expense Card */}
                <div className="bg-red-50/80 rounded-xl p-6 shadow-sm border border-red-200 transition-colors hover:bg-red-50">
                  <p className="text-sm text-red-700 text-center">Total Expenses</p>
                  <p className="text-3xl font-bold mt-2 text-center text-red-800">
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                    }).format(totals.expense)}
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50 transition-colors hover:bg-card/80">
                <p className="text-sm text-muted-foreground text-center">
                  {getStatsTitle(selectedType)}
                </p>
                <p className="text-3xl font-bold mt-2 text-center">
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: "EUR",
                  }).format(
                    selectedType === "expense"
                      ? totals.expense
                      : selectedType === "income"
                        ? totals.income
                        : totals.regular
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Account Type Stats Cards */}
        <div className={`grid grid-cols-1 ${
          selectedType === "expense" || selectedType === "income"
            ? "md:grid-cols-1"
            : "md:grid-cols-2 lg:grid-cols-4"
        } gap-6`}>
          {isLoading ? (
            <>
              <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </div>
              {(selectedType === "all" || selectedType === "owned") && (
                <>
                  <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                  <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                  <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {/* Checking Stats */}
              {shouldShowAccountType("checking", selectedType) && (
                <div className="bg-blue-50/80 rounded-xl p-6 shadow-sm border border-blue-200 transition-colors hover:bg-blue-50">
                  <p className="text-sm text-blue-700">
                    {statsText.checking.title}
                  </p>
                  <p className={`text-2xl font-semibold mt-2 ${statsText.checking.color}`}>
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                    }).format(statsText.checking.balance)}
                  </p>
                </div>
              )}

              {/* Savings Stats */}
              {shouldShowAccountType("savings", selectedType) && (
                <div className="bg-green-50/80 rounded-xl p-6 shadow-sm border border-green-200 transition-colors hover:bg-green-50">
                  <p className="text-sm text-green-700">
                    {statsText.savings.title}
                  </p>
                  <p className={`text-2xl font-semibold mt-2 ${statsText.savings.color}`}>
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                    }).format(statsText.savings.balance)}
                  </p>
                </div>
              )}

              {/* Investment Stats */}
              {shouldShowAccountType("investment", selectedType) && (
                <div className="bg-purple-50/80 rounded-xl p-6 shadow-sm border border-purple-200 transition-colors hover:bg-purple-50">
                  <p className="text-sm text-purple-700">
                    {statsText.investment.title}
                  </p>
                  <p className={`text-2xl font-semibold mt-2 ${statsText.investment.color}`}>
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                    }).format(statsText.investment.balance)}
                  </p>
                </div>
              )}

              {/* Loans Stats */}
              {shouldShowAccountType("loan", selectedType) && (
                <div className="bg-rose-50/80 rounded-xl p-6 shadow-sm border border-rose-200 transition-colors hover:bg-rose-50">
                  <p className="text-sm text-rose-700">{statsText.loans.title}</p>
                  <p className={`text-2xl font-semibold mt-2 ${statsText.loans.color}`}>
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                    }).format(statsText.loans.balance)}
                  </p>
                </div>
              )}

              {/* Expense Stats */}
              {selectedType === "expense" && (
                <div className="bg-red-50/80 rounded-xl p-6 shadow-sm border border-red-200 transition-colors hover:bg-red-50">
                  <p className="text-sm text-red-700">Expense</p>
                  <p className="text-2xl font-semibold mt-2 text-red-800">
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                    }).format(totals.expense)}
                  </p>
                </div>
              )}

              {/* Income Stats */}
              {selectedType === "income" && (
                <div className="bg-amber-50/80 rounded-xl p-6 shadow-sm border border-amber-200 transition-colors hover:bg-amber-50">
                  <p className="text-sm text-amber-700">Income</p>
                  <p className="text-2xl font-semibold mt-2 text-amber-800">
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                    }).format(totals.income)}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 bg-background border-border/50"
            />
          </div>
          <div className="flex items-center gap-4">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setIsAddingAccount(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setIsAddingBank(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Link Bank
            </Button>
            {selectedAccounts.length > 0 && (
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() =>
                  setDeletingAccount(
                    accounts.find(a => a.id === selectedAccounts[0]) || null
                  )
                }
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete{" "}
                {selectedAccounts.length > 1
                  ? `(${selectedAccounts.length})`
                  : ""}
              </Button>
            )}
            </div>
          </div>
        </div>

        {/* Accounts View */}
        <Tabs value="bubble">
          <TabsContent value="bubble">
            <div className="bg-card rounded-xl shadow-sm border border-border/50 p-6 overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <Skeleton className="h-[300px] w-[300px] rounded-full" />
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                      <p>No accounts found</p>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="link"
                          onClick={() => setIsAddingAccount(true)}
                        >
                          Add an account
                        </Button>
                        <span>or</span>
                        <Button
                          variant="link"
                          onClick={() => setIsAddingBank(true)}
                        >
                          Link a bank
                        </Button>
                      </div>
                    </div>
              ) : (
                <div>
                  {/* 4-Column Account Layout */}
                  <div className="w-full h-full p-4">
                    <div className={`grid grid-cols-1 ${
                      selectedType === "expense" || selectedType === "income"
                        ? "md:grid-cols-1"
                        : selectedType === "all"
                          ? "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
                          : "md:grid-cols-2 lg:grid-cols-4"
                    } gap-6 h-full`}>
                      <AccountTypeColumn
                        type="checking"
                        selectedType={selectedType}
                        title="Checking"
                        icon={ACCOUNT_TYPE_ICONS.checking}
                        color="text-blue-800"
                        accounts={filteredAccounts}
                        hoveredAccount={hoveredAccount}
                        setHoveredAccount={setHoveredAccount}
                        navigate={navigate}
                      />
                      <AccountTypeColumn
                        type="savings"
                        selectedType={selectedType}
                        title="Savings"
                        icon={ACCOUNT_TYPE_ICONS.savings}
                        color="text-green-800"
                        accounts={filteredAccounts}
                        hoveredAccount={hoveredAccount}
                        setHoveredAccount={setHoveredAccount}
                        navigate={navigate}
                      />
                      <AccountTypeColumn
                        type="investment"
                        selectedType={selectedType}
                        title="Investments"
                        icon={ACCOUNT_TYPE_ICONS.investment}
                        color="text-purple-800"
                        accounts={filteredAccounts}
                        hoveredAccount={hoveredAccount}
                        setHoveredAccount={setHoveredAccount}
                        navigate={navigate}
                      />
                      <AccountTypeColumn
                        type="loan"
                        selectedType={selectedType}
                        title="Loans"
                        icon={ACCOUNT_TYPE_ICONS.loan}
                        color="text-rose-800"
                        accounts={filteredAccounts}
                        hoveredAccount={hoveredAccount}
                        setHoveredAccount={setHoveredAccount}
                        navigate={navigate}
                      />
                      <AccountTypeColumn
                        type="expense"
                        selectedType={selectedType}
                        title="Expenses"
                        icon={ACCOUNT_TYPE_ICONS.expense}
                        color="text-red-800"
                        accounts={filteredAccounts}
                        hoveredAccount={hoveredAccount}
                        setHoveredAccount={setHoveredAccount}
                        navigate={navigate}
                      />
                      <AccountTypeColumn
                        type="income"
                        selectedType={selectedType}
                        title="Income"
                        icon={ACCOUNT_TYPE_ICONS.income}
                        color="text-amber-800"
                        accounts={filteredAccounts}
                        hoveredAccount={hoveredAccount}
                        setHoveredAccount={setHoveredAccount}
                        navigate={navigate}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        {editingAccount && (
          <AccountForm
            account={editingAccount}
            open={true}
            onOpenChange={open => !open && setEditingAccount(null)}
          />
        )}

        <DeleteAccountDialog
          account={deletingAccount}
          open={!!deletingAccount}
          onOpenChange={open => !open && setDeletingAccount(null)}
          redirectTo="/accounts"
        />

        {isAddingAccount && (
          <AccountForm
            open={isAddingAccount}
            onOpenChange={open => !open && setIsAddingAccount(false)}
          />
        )}

        {isAddingBank && (
          <AddBankDialog
            open={isAddingBank}
            onOpenChange={open => !open && setIsAddingBank(false)}
          />
        )}

        {showBulkDeleteConfirm && (
          <Dialog
            open={showBulkDeleteConfirm}
            onOpenChange={setShowBulkDeleteConfirm}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-red-500">
                  🗑️ Delete {selectedAccounts.length} Accounts
                </DialogTitle>
                <DialogDescription className="space-y-3 pt-4">
                  <div className="text-red-500 font-medium">
                    You are about to delete {selectedAccounts.length} accounts.
                    This action cannot be undone.
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    <ul className="list-disc pl-4 space-y-1">
                      {accounts
                        .filter(a => selectedAccounts.includes(a.id))
                        .map(account => (
                          <li
                            key={account.id}
                            className="text-sm text-muted-foreground"
                          >
                            {account.name} ({ACCOUNT_TYPE_LABELS[account.type]})
                          </li>
                        ))}
                    </ul>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleBulkDelete}>
                  Delete {selectedAccounts.length} Accounts
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

      </div>
    </PageContainer>
  )
}
