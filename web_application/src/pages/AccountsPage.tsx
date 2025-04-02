import { useAccounts, useBanks, useDeleteAccount } from "@/api/queries"
import { AddAccountDialog } from "@/components/accounts/AddAccountDialog"
import { AddBankDialog } from "@/components/accounts/AddBankDialog"
import { DeleteAccountDialog } from "@/components/accounts/DeleteAccountDialog"
import { EditAccountDialog } from "@/components/accounts/EditAccountDialog"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS } from "@/constants"
import { useDebounce } from "@/hooks/use-debounce"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Account } from "@/types"
import { useNavigate } from "@tanstack/react-router"
import {
  ArrowDown as ArrowDownIcon,
  ArrowUpDown,
  ArrowUp as ArrowUpIcon,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface AccountsPageProps {
  defaultType?: string
}

type SortField = "name" | "type" | "bank"
type SortDirection = "asc" | "desc"

export function AccountsPage({ defaultType = "all" }: AccountsPageProps) {
  const [selectedType] = useState<string>(defaultType)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [balanceSortDirection, setBalanceSortDirection] = useState<
    "asc" | "desc" | null
  >(null)
  const itemsPerPage = 25
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)
  const { toast } = useToast()
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const [isAddingAccount, setIsAddingAccount] = useState(false)
  const [isAddingBank, setIsAddingBank] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([])
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const navigate = useNavigate()
  const [isEnteringPage, setIsEnteringPage] = useState(false)
  const [manualPageInput, setManualPageInput] = useState("")
  const deleteMutation = useDeleteAccount()

  const { data: accountsResponse, isLoading } = useAccounts({
    type:
      selectedType === "owned"
        ? "checking,savings,investment"
        : selectedType === "all"
          ? undefined
          : selectedType,
    page: currentPage,
    per_page: itemsPerPage,
    sort_by: sortField,
    sort_order: sortDirection,
    search: debouncedSearch,
  })

  const { data: banksResponse } = useBanks()

  const accounts = accountsResponse?.items || []
  const totalItems = accountsResponse?.total || 0
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const banks = banksResponse?.items || []

  const handleSort = (field: SortField) => {
    setBalanceSortDirection(null)
    if (sortField === field) {
      const newDirection = sortDirection === "asc" ? "desc" : "asc"
      setSortDirection(newDirection)
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
    setCurrentPage(1)
  }

  const handleBalanceSort = () => {
    setSortField("name")
    setSortDirection("asc")
    setBalanceSortDirection(prev => {
      if (prev === null) return "asc"
      if (prev === "asc") return "desc"
      return null
    })
    setCurrentPage(1)
  }

  const sortedAccounts = [...(accounts || [])].sort((a, b) => {
    if (balanceSortDirection === "asc") {
      return a.balance - b.balance
    } else if (balanceSortDirection === "desc") {
      return b.balance - a.balance
    }
    return 0
  })

  const totalBalance = sortedAccounts.reduce(
    (sum: number, account: Account) => sum + account.balance,
    0
  )

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />
    return sortDirection === "asc" ? (
      <ArrowUpIcon className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDownIcon className="ml-2 h-4 w-4" />
    )
  }

  const BalanceSortIcon = () => {
    if (balanceSortDirection === null)
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    return balanceSortDirection === "asc" ? (
      <ArrowUpIcon className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDownIcon className="ml-2 h-4 w-4" />
    )
  }

  const pageTitle =
    defaultType === "new"
      ? "Add Account"
      : defaultType === "link"
        ? "Link Bank Account"
        : "All Accounts"

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAccounts(sortedAccounts.map(account => account.id))
    } else {
      setSelectedAccounts([])
    }
  }

  const handleSelectAccount = (accountId: number, checked: boolean) => {
    if (checked) {
      setSelectedAccounts(prev => [...prev, accountId])
    } else {
      setSelectedAccounts(prev => prev.filter(id => id !== accountId))
    }
  }

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

  const getStatsText = () => {
    switch (defaultType) {
      case "expense":
        return {
          title: "Total Expense Accounts",
          balance: "Total Expenses Available",
          banks: "Connected Payment Methods",
        }
      case "income":
        return {
          title: "Total Income Accounts",
          balance: "Expected Income",
          banks: "Income Sources",
        }
      case "regular":
        return {
          title: "Regular Accounts",
          balance: "Total Balance",
          banks: "Connected Banks",
        }
      default:
        return {
          title: "Total Accounts",
          balance: "Net Worth",
          banks: "Connected Banks",
        }
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
        setCurrentPage(1)
      }
    },
    onEnd: () => {
      if (tableRef.current) {
        tableRef.current.scrollTop = tableRef.current.scrollHeight
        setCurrentPage(totalPages)
      }
    },
    onPrevPage: () => setCurrentPage(p => Math.max(1, p - 1)),
    onNextPage: () => setCurrentPage(p => Math.min(totalPages, p + 1)),
  })

  return (
    <PageContainer title={pageTitle}>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoading ? (
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
          ) : (
            <>
              <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50 transition-colors hover:bg-card/80">
                <p className="text-sm text-muted-foreground">
                  {statsText.title}
                </p>
                <p className="text-2xl font-semibold mt-2">{totalItems}</p>
              </div>
              <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50 transition-colors hover:bg-card/80">
                <p className="text-sm text-muted-foreground">
                  {statsText.banks}
                </p>
                <p className="text-2xl font-semibold mt-2">{banks.length}</p>
              </div>
              <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50 transition-colors hover:bg-card/80">
                <p className="text-sm text-muted-foreground">
                  {statsText.balance}
                </p>
                <p
                  className={`text-2xl font-semibold mt-2 ${
                    defaultType === "expense"
                      ? "text-destructive"
                      : defaultType === "income"
                        ? "text-success"
                        : ""
                  }`}
                >
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: "EUR",
                  }).format(Math.abs(totalBalance))}
                </p>
              </div>
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

        {/* Accounts Table */}
        <div className="bg-card rounded-xl shadow-sm border border-border/50 overflow-hidden">
          <Table ref={tableRef}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      selectedAccounts.length === sortedAccounts.length &&
                      sortedAccounts.length > 0
                    }
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead
                  className="w-[300px] cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort("name")}
                >
                  Name <SortIcon field="name" />
                </TableHead>
                <TableHead
                  className="w-[150px] cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort("type")}
                >
                  Type <SortIcon field="type" />
                </TableHead>
                <TableHead
                  className="w-[200px] cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort("bank")}
                >
                  Bank <SortIcon field="bank" />
                </TableHead>
                <TableHead
                  className="text-right w-[200px] cursor-pointer hover:text-primary transition-colors"
                  onClick={handleBalanceSort}
                >
                  Balance <BalanceSortIcon />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-4" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
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
                  </TableCell>
                </TableRow>
              ) : (
                sortedAccounts.map(account => {
                  const bank = banks.find(b => b.id === account.bank_id)
                  return (
                    <TableRow
                      key={account.id}
                      className={cn(`
                        hover:bg-muted/50
                        transition-colors
                        ${selectedRowId === account.id ? "bg-muted" : ""}
                        ${
                          selectedAccounts.includes(account.id)
                            ? "bg-muted/70"
                            : ""
                        }
                      `)}
                      onMouseEnter={() => setSelectedRowId(account.id)}
                      onMouseLeave={() => setSelectedRowId(null)}
                      onClick={() =>
                        navigate({
                          to: "/accounts/$accountId",
                          params: { accountId: account.id.toString() },
                        })
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedAccounts.includes(account.id)}
                          onCheckedChange={checked =>
                            handleSelectAccount(account.id, checked as boolean)
                          }
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">
                            {ACCOUNT_TYPE_ICONS[account.type]}
                          </span>
                          {account.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                          {ACCOUNT_TYPE_LABELS[account.type]}
                        </span>
                      </TableCell>
                      <TableCell>
                        {bank ? (
                          bank.website ? (
                            <a
                              href={bank.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-primary hover:underline"
                            >
                              {bank.name}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            bank.name
                          )
                        ) : (
                          "Other"
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          account.balance < 0
                            ? "text-red-500"
                            : "text-green-500"
                        }`}
                      >
                        {new Intl.NumberFormat(undefined, {
                          style: "currency",
                          currency: "EUR",
                        }).format(Math.abs(account.balance))}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setEditingAccount(account)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeletingAccount(account)}
                              className="text-red-600"
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}{" "}
              accounts
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEnteringPage(true)}
              >
                Page {currentPage} of {totalPages}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                Last
              </Button>
            </div>
          </div>
        )}

        {/* Dialogs */}
        {editingAccount && (
          <EditAccountDialog
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
          <AddAccountDialog
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

        <Dialog open={isEnteringPage} onOpenChange={setIsEnteringPage}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Go to Page</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={manualPageInput}
                  onChange={e => setManualPageInput(e.target.value)}
                  placeholder={`Enter page (1-${totalPages})`}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEnteringPage(false)
                  setManualPageInput("")
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const pageNum = parseInt(manualPageInput)
                  if (pageNum >= 1 && pageNum <= totalPages) {
                    setCurrentPage(pageNum)
                    setIsEnteringPage(false)
                    setManualPageInput("")
                  } else {
                    toast({
                      title: "Invalid page number",
                      description: `Please enter a number between 1 and ${totalPages}`,
                      variant: "destructive",
                    })
                  }
                }}
              >
                Go to Page
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  )
}
