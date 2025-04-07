import { useAccounts, useAssets, useInvestments } from "@/api/queries"
import { AddInvestmentDialog } from "@/components/investmentsTransaction/AddInvestmentTransactionDialog"
import { DeleteInvestmentDialog } from "@/components/investmentsTransaction/DeleteInvestmentTransactionDialog"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
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
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDebounce } from "@/hooks/use-debounce"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Investment } from "@/types"
import { useNavigate } from "@tanstack/react-router"
import {
  ArrowDownIcon,
  ArrowUpDown,
  ArrowUpIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { useEffect, useRef, useState, memo, useMemo } from "react"

type SortField =
  | "date"
  | "investment_type"
  | "quantity"
  | "unit_price"
  | "total_paid"
  | "fee"
  | "tax"
type SortDirection = "asc" | "desc"
type InvestmentTypeFilter = "all" | "Buy" | "Sell" | "Deposit" | "Withdrawal" | "Dividend"

const INVESTMENT_TYPE_ICONS = {
  Buy: <TrendingUp className="h-4 w-4 text-green-500" />,
  Sell: <TrendingDown className="h-4 w-4 text-red-500" />,
  Deposit: <ArrowDownIcon className="h-4 w-4 text-blue-500" />,
  Withdrawal: <ArrowUpIcon className="h-4 w-4 text-orange-500" />,
  Dividend: <ArrowDownIcon className="h-4 w-4 text-purple-500" />,
}

const INVESTMENT_TYPE_LABELS = {
  Buy: "Buy",
  Sell: "Sell",
  Deposit: "Deposit",
  Withdrawal: "Withdrawal",
  Dividend: "Dividend",
}

const createMemoizedHelpers = (accounts: any[], assets: any[]) => {
  const getAccountName = (accountId?: number) => {
    if (!accountId) return ""
    const account = accounts.find(a => a.id === accountId)
    return account ? account.name : ""
  }

  const getAssetSymbol = (assetId?: number) => {
    if (!assetId) return ""
    const asset = assets.find(a => a.id === assetId)
    return asset ? asset.symbol : ""
  }

  return { getAccountName, getAssetSymbol }
}

const InvestmentTableRow = memo(function InvestmentTableRow({
  investment,
  selectedInvestments,
  onSelectInvestment,
  onEdit,
  onDelete,
  getAccountName,
  getAssetSymbol,
  navigate,
}: {
  investment: Investment
  selectedInvestments: number[]
  onSelectInvestment: (id: number, checked: boolean) => void
  onEdit: (investment: Investment) => void
  onDelete: (investment: Investment) => void
  getAccountName: (id?: number) => string
  getAssetSymbol: (id?: number) => string
  navigate: (params: any) => void
}) {
  const formattedDate = useMemo(() => {
    const date = new Date(investment.date)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString()
    }
  }, [investment.date])

  const formattedValues = useMemo(() => ({
    quantity: investment.quantity.toLocaleString(),
    unitPrice: new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(investment.unit_price),
    fee: new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(investment.fee),
    tax: new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(investment.tax),
    total: new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(investment.total_paid || 0)
  }), [investment.quantity, investment.unit_price, investment.fee, investment.tax, investment.total_paid])

  const fromAccountName = getAccountName(investment.from_account_id)
  const toAccountName = getAccountName(investment.to_account_id)

  return (
    <TableRow
      className="group border-l-2 hover:bg-muted/50 transition-colors"
    >
      <TableCell>
        <Checkbox
          checked={selectedInvestments.includes(investment.transaction_id)}
          onCheckedChange={checked =>
            onSelectInvestment(investment.transaction_id, checked as boolean)
          }
          onClick={e => e.stopPropagation()}
        />
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span>{formattedDate.date}</span>
          <span className="text-xs text-muted-foreground">{formattedDate.time}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className={cn(
          "flex items-center gap-2 rounded-md border px-2 py-1 w-fit",
          "bg-background"
        )}>
          {INVESTMENT_TYPE_ICONS[investment.investment_type]}
          <span className="text-sm font-medium">
            {INVESTMENT_TYPE_LABELS[investment.investment_type]}
          </span>
        </div>
      </TableCell>
      <TableCell>
        {investment.asset_id && (
          <Button
            variant="link"
            className="p-0 h-auto font-medium hover:underline"
            onClick={() =>
              navigate({
                to: "/investments/assets/$symbol",
                params: {
                  symbol: getAssetSymbol(investment.asset_id),
                },
              })
            }
          >
            {getAssetSymbol(investment.asset_id)}
          </Button>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {investment.from_account_id && (
            <Button
              variant="link"
              className="p-0 h-auto font-medium hover:underline text-muted-foreground"
              onClick={() =>
                navigate({
                  to: "/accounts/$id",
                  params: {
                    id: investment.from_account_id.toString(),
                  },
                })
              }
            >
              <span className="text-xs mr-1">From:</span>
              {fromAccountName}
            </Button>
          )}
          {investment.to_account_id && (
            <Button
              variant="link"
              className="p-0 h-auto font-medium hover:underline text-muted-foreground"
              onClick={() =>
                navigate({
                  to: "/accounts/$id",
                  params: {
                    id: investment.to_account_id.toString(),
                  },
                })
              }
            >
              <span className="text-xs mr-1">To:</span>
              {toAccountName}
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end">
          <span className="font-medium">{formattedValues.quantity}</span>
          <span className="text-xs text-muted-foreground">units</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end">
          <span className="font-medium">{formattedValues.unitPrice}</span>
          <span className="text-xs text-muted-foreground">per unit</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end">
          <span className={cn(
            "font-medium",
            investment.fee > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
          )}>
            {formattedValues.fee}
          </span>
          <span className="text-xs text-muted-foreground">fee</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end">
          <span className={cn(
            "font-medium",
            investment.tax > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
          )}>
            {formattedValues.tax}
          </span>
          <span className="text-xs text-muted-foreground">tax</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end">
          <span className={cn(
            "font-medium",
            investment.investment_type === "Buy" ||
            investment.investment_type === "Deposit" ||
            investment.investment_type === "Dividend"
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          )}>
            {formattedValues.total}
          </span>
          <span className="text-xs text-muted-foreground">total</span>
        </div>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(investment)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(investment)}
              className="text-red-600 dark:text-red-400"
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

export function InvestmentsTransactionPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [investmentTypeFilter, setActivityTypeFilter] =
    useState<InvestmentTypeFilter>("all")
  const itemsPerPage = 25
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(
    null
  )
  const [deletingInvestment, setDeletingInvestment] =
    useState<Investment | null>(null)
  const { toast } = useToast()
  const tableRef = useRef<HTMLTableElement>(null)
  const [selectedInvestments, setSelectedInvestments] = useState<number[]>([])
  const [isAddingInvestment, setIsAddingInvestment] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [isEnteringPage, setIsEnteringPage] = useState(false)
  const [manualPageInput, setManualPageInput] = useState("")
  const navigate = useNavigate()

  const { data: investmentsResponse, isLoading } = useInvestments({
    page: currentPage,
    per_page: itemsPerPage,
    sort_by: sortField,
    sort_order: sortDirection,
    search: debouncedSearch,
  })

  const { data: accountsResponse } = useAccounts({
    per_page: 1000,
  })

  const { data: assetsResponse } = useAssets({
    per_page: 1000,
  })

  const investments = (investmentsResponse?.items || []) as Investment[]
  const totalItems = investmentsResponse?.total || 0
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const accounts = accountsResponse?.items || []
  const assets = assetsResponse?.items || []

  const { getAccountName, getAssetSymbol } = useMemo(
    () => createMemoizedHelpers(accounts, assets),
    [accounts, assets]
  )

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
    setCurrentPage(1)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />
    return sortDirection === "asc" ? (
      <ArrowUpIcon className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDownIcon className="ml-2 h-4 w-4" />
    )
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, investmentTypeFilter])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInvestments(
        investments.map(investment => investment.transaction_id)
      )
    } else {
      setSelectedInvestments([])
    }
  }

  const handleSelectInvestment = (transactionId: number, checked: boolean) => {
    if (checked) {
      setSelectedInvestments(prev => [...prev, transactionId])
    } else {
      setSelectedInvestments(prev => prev.filter(id => id !== transactionId))
    }
  }

  useKeyboardShortcuts({
    onNew: () => {
      if (!isAddingInvestment) {
        setIsAddingInvestment(true)
      }
    },
    onEdit: () => {
      if (selectedInvestments.length > 0 && !editingInvestment) {
        const investment = investments.find(
          i => i.transaction_id === selectedInvestments[0]
        )
        if (investment) {
          setEditingInvestment(investment)
        }
      }
    },
    onDelete: () => {
      if (selectedInvestments.length > 0 && !deletingInvestment) {
        const investment = investments.find(
          i => i.transaction_id === selectedInvestments[0]
        )
        if (investment) {
          setDeletingInvestment(investment)
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

  const totalInvested = investments.reduce(
    (sum, inv) => {
      if (inv.investment_type === "Buy" || inv.investment_type === "Deposit" || inv.investment_type === "Dividend") {
        return sum + (inv.total_paid || 0)
      }
      return sum
    },
    0
  )
  const totalFees = investments.reduce((sum, inv) => sum + inv.fee, 0)
  const totalTax = investments.reduce((sum, inv) => sum + inv.tax, 0)

  const filteredInvestments = investments.filter(investment => {
    if (investmentTypeFilter === "all") return true
    return investment.investment_type === investmentTypeFilter
  })

  const stats = [
    {
      title: "Total Invested",
      value: totalInvested,
      valueFormatted: new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "EUR",
      }).format(totalInvested),
      icon: <TrendingUp className="h-4 w-4 text-green-500" />,
    },
    {
      title: "Total Fees",
      value: totalFees,
      valueFormatted: new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "EUR",
      }).format(totalFees),
      icon: <ArrowDownIcon className="h-4 w-4 text-orange-500" />,
    },
    {
      title: "Total Tax",
      value: totalTax,
      valueFormatted: new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "EUR",
      }).format(totalTax),
      icon: <ArrowUpIcon className="h-4 w-4 text-red-500" />,
    },
  ]

  return (
    <PageContainer title="Investment Transactions">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      <Skeleton className="h-4 w-24" />
                    </CardTitle>
                    <Skeleton className="h-4 w-4" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-32" />
                  </CardContent>
                </Card>
              ))
            : stats.map((stat, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    {stat.icon}
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {stat.valueFormatted}
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* Actions and Filters */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4 flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search investments..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 w-[300px]"
              />
            </div>
            <Tabs
              value={investmentTypeFilter}
              onValueChange={value =>
                setActivityTypeFilter(value as InvestmentTypeFilter)
              }
              className="flex-1 min-w-0"
            >
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="Buy" className="text-green-500">
                  Buy
                </TabsTrigger>
                <TabsTrigger value="Sell" className="text-red-500">
                  Sell
                </TabsTrigger>
                <TabsTrigger value="Deposit" className="text-blue-500">
                  Deposit
                </TabsTrigger>
                <TabsTrigger value="Withdrawal" className="text-orange-500">
                  Withdraw
                </TabsTrigger>
                <TabsTrigger value="Dividend" className="text-purple-500">
                  Dividend
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex gap-2">
            {selectedInvestments.length > 0 && (
              <>
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={() =>
                    setDeletingInvestment(
                      investments.find(
                        i => i.transaction_id === selectedInvestments[0]
                      ) || null
                    )
                  }
                >
                  <Trash className="h-4 w-4 mr-2" />
                  Delete{" "}
                  {selectedInvestments.length > 1
                    ? `(${selectedInvestments.length})`
                    : ""}
                </Button>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </>
            )}
            <Button onClick={() => setIsAddingInvestment(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Investment
            </Button>
          </div>
        </div>

        {/* Investments Table */}
        <Card>
          <CardContent className="p-0">
            <Table ref={tableRef}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        selectedInvestments.length === investments.length &&
                        investments.length > 0
                      }
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead
                    className="w-[150px] cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleSort("date")}
                  >
                    Date <SortIcon field="date" />
                  </TableHead>
                  <TableHead
                    className="w-[150px] cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleSort("investment_type")}
                  >
                    Type <SortIcon field="investment_type" />
                  </TableHead>
                  <TableHead className="w-[150px]">Asset</TableHead>
                  <TableHead className="w-[300px]">Accounts</TableHead>
                  <TableHead
                    className="w-[150px] cursor-pointer hover:text-primary transition-colors text-right"
                    onClick={() => handleSort("quantity")}
                  >
                    Quantity <SortIcon field="quantity" />
                  </TableHead>
                  <TableHead
                    className="w-[150px] cursor-pointer hover:text-primary transition-colors text-right"
                    onClick={() => handleSort("unit_price")}
                  >
                    Unit Price <SortIcon field="unit_price" />
                  </TableHead>
                  <TableHead
                    className="w-[150px] cursor-pointer hover:text-primary transition-colors text-right"
                    onClick={() => handleSort("fee")}
                  >
                    Fee <SortIcon field="fee" />
                  </TableHead>
                  <TableHead
                    className="w-[150px] cursor-pointer hover:text-primary transition-colors text-right"
                    onClick={() => handleSort("tax")}
                  >
                    Tax <SortIcon field="tax" />
                  </TableHead>
                  <TableHead
                    className="w-[150px] cursor-pointer hover:text-primary transition-colors text-right"
                    onClick={() => handleSort("total_paid")}
                  >
                    Total <SortIcon field="total_paid" />
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: itemsPerPage }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-4" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredInvestments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <p>No investment transactions found</p>
                        <Button
                          variant="link"
                          onClick={() => setIsAddingInvestment(true)}
                          className="mt-2"
                        >
                          Add your first investment
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvestments.map(investment => (
                    <InvestmentTableRow
                      key={investment.transaction_id}
                      investment={investment}
                      selectedInvestments={selectedInvestments}
                      onSelectInvestment={handleSelectInvestment}
                      onEdit={setEditingInvestment}
                      onDelete={setDeletingInvestment}
                      getAccountName={getAccountName}
                      getAssetSymbol={getAssetSymbol}
                      navigate={navigate}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}{" "}
              entries
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNumber =
                    currentPage <= 3
                      ? i + 1
                      : currentPage >= totalPages - 2
                        ? totalPages - 4 + i
                        : currentPage - 2 + i
                  return (
                    <Button
                      key={i}
                      variant={
                        pageNumber === currentPage ? "default" : "outline"
                      }
                      size="icon"
                      onClick={() => setCurrentPage(pageNumber)}
                    >
                      {pageNumber}
                    </Button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Dialogs */}
        <AddInvestmentDialog
          open={isAddingInvestment || !!editingInvestment}
          onOpenChange={open => {
            if (!open) {
              setIsAddingInvestment(false)
              setEditingInvestment(null)
            }
          }}
          investment={editingInvestment || undefined}
        />

        <DeleteInvestmentDialog
          investment={deletingInvestment}
          open={!!deletingInvestment}
          onOpenChange={open => !open && setDeletingInvestment(null)}
        />

        <Dialog open={isEnteringPage} onOpenChange={setIsEnteringPage}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Go to Page</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Page Number</Label>
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
                onClick={() => {
                  const page = parseInt(manualPageInput)
                  if (page >= 1 && page <= totalPages) {
                    setCurrentPage(page)
                    setIsEnteringPage(false)
                    setManualPageInput("")
                  }
                }}
                disabled={
                  !manualPageInput ||
                  parseInt(manualPageInput) < 1 ||
                  parseInt(manualPageInput) > totalPages
                }
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
