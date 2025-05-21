import {
    useAccounts,
    useRefundGroups,
    useRefundItems,
    useTransactions,
} from "@/api/queries"
import { PageContainer } from "@/components/layout/PageContainer"
import { DeleteTransactionDialog } from "@/components/transactions/DeleteTransactionDialog"
import { TransactionForm } from "@/components/transactions/TransactionForm"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { transactionDetailRoute } from "@/Router"
import { useDialogStore } from "@/store/dialogStore"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { AnimatePresence, motion } from "framer-motion"
import {
    ArrowLeft,
    Calendar,
    ChevronDown,
    CreditCard,
    FileText,
    Pencil,
    Plus,
    RefreshCw,
    Tag,
    Trash,
} from "lucide-react"
import { useCallback, useMemo, useState } from "react"

export function TransactionDetailPage() {
  const { transactionId } = transactionDetailRoute.useParams()
  const navigate = useNavigate()
  const router = useRouter()
  const [showRefunds, setShowRefunds] = useState(false)
  const { setEditTransaction, setDeleteTransaction } = useDialogStore()

  // Always fetch these base queries
  const { data: transactionsResponse, isLoading: isLoadingTransaction } =
    useTransactions({
      id: transactionId,
      per_page: 1,
    })

  const { data: accountsResponse, isLoading: isLoadingAccounts } = useAccounts({
    type: "checking,savings,investment,loan,income,expense",
    per_page: 1000,
  })

  const { data: refundItemsResponse, isLoading: isLoadingRefunds } =
    useRefundItems({
      per_page: 1000,
    })

  const { data: refundGroupsResponse } = useRefundGroups({
    per_page: 1000,
  })

  const transaction = transactionsResponse?.items[0]
  const accounts = accountsResponse?.items || []
  const refundGroups = refundGroupsResponse?.items || []

  // Memoized values that depend on transaction
  const refundItems = useMemo(() => {
    if (!transaction || !refundItemsResponse?.items) return []
    return refundItemsResponse.items.filter(item =>
      transaction.type === "expense"
        ? item.expense_transaction_id === transaction.id
        : item.income_transaction_id === transaction.id
    )
  }, [transaction, refundItemsResponse])

  const linkedTransactionIds = useMemo(() => {
    if (!transaction) return []
    return refundItems
      .map(item =>
        transaction.type === "expense"
          ? item.income_transaction_id
          : item.expense_transaction_id
      )
      .filter((id): id is number => !!id)
  }, [transaction, refundItems])

  // Only fetch linked transactions if we have IDs
  const { data: linkedTransactionsResponse } = useTransactions(
    linkedTransactionIds.length > 0
      ? {
          id: linkedTransactionIds,
          per_page: linkedTransactionIds.length,
        }
      : undefined
  )

  const linkedTransactions = linkedTransactionsResponse?.items || []

  const getAccountName = useCallback(
    (accountId?: number) => {
      if (!accountId) return ""
      const account = accounts.find(a => a.id === accountId)
      return account ? account.name : ""
    },
    [accounts]
  )

  const getRefundGroupName = useCallback(
    (groupId?: number | null) => {
      if (!groupId) return null
      const group = refundGroups.find(g => g.id === groupId)
      return group?.name || null
    },
    [refundGroups]
  )

  const getLinkedTransaction = useCallback(
    (transactionId: number) => {
      return linkedTransactions.find(t => t.id === transactionId) || null
    },
    [linkedTransactions]
  )

  if (isLoadingTransaction || isLoadingAccounts || isLoadingRefunds) {
    return (
      <PageContainer>
        <div className="max-w-3xl mx-auto space-y-6 p-4">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded-lg w-24" />
            <div className="h-32 bg-muted rounded-xl" />
            <div className="h-20 bg-muted rounded-lg" />
          </div>
        </div>
      </PageContainer>
    )
  }

  if (!transaction) {
    return (
      <PageContainer>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <h2 className="text-2xl font-semibold mb-4">Transaction not found</h2>
          <Button onClick={() => router.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Transactions
          </Button>
        </motion.div>
      </PageContainer>
    )
  }

  const transactionColor =
    transaction.type === "expense"
      ? "text-destructive"
      : transaction.type === "income"
        ? "text-emerald-600"
        : "text-primary"

  const transactionBgColor =
    transaction.type === "expense"
      ? "bg-destructive/10"
      : transaction.type === "income"
        ? "bg-emerald-500/10"
        : "bg-primary/10"

  return (
    <PageContainer>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-3xl mx-auto p-4"
      >
        <nav className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm mb-6 -mx-4 px-4 py-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="group"
            onClick={() => router.history.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back
          </Button>
          <div className="flex gap-2">
            {transaction.type === "expense" &&
              transaction.refunded_amount < Math.abs(transaction.amount) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-amber-600 border-amber-600 hover:bg-amber-50"
                  onClick={() => navigate({ to: "/refunds" })}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Add Refund
                </Button>
              )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditTransaction(transaction)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteTransaction(transaction)}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </nav>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Transaction Header */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="rounded-xl border bg-card p-6 space-y-4"
          >
            <div className="flex flex-col items-center text-center">
              <span
                className={cn(
                  "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-3",
                  transactionBgColor,
                  transactionColor
                )}
              >
                {transaction.type.charAt(0).toUpperCase() +
                  transaction.type.slice(1)}
              </span>
              <h1 className="text-xl font-medium mb-3 max-w-md">
                {transaction.description}
              </h1>
              {transaction.refunded_amount > 0 ? (
                <div className="flex flex-col items-center w-full max-w-sm">
                  <p
                    className={cn("text-lg line-through text-muted-foreground")}
                  >
                    {transaction.type === "transfer"
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "EUR",
                        }).format(Math.abs(transaction.amount))
                      : `${
                          transaction.type === "expense" ? "-" : "+"
                        }${new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "EUR",
                        }).format(Math.abs(transaction.amount))}`}
                  </p>
                  <p
                    className={cn(
                      "text-3xl font-semibold tracking-tight",
                      transactionColor
                    )}
                  >
                    {transaction.type === "transfer"
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "EUR",
                        }).format(
                          Math.abs(
                            transaction.amount - transaction.refunded_amount
                          )
                        )
                      : `${
                          transaction.type === "expense" ? "-" : "+"
                        }${new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "EUR",
                        }).format(
                          Math.abs(
                            transaction.amount - transaction.refunded_amount
                          )
                        )}`}
                  </p>

                  <div className="flex items-center text-amber-600 mt-1 text-sm gap-1">
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    <span>
                      {transaction.type === "expense"
                        ? "Refunded: "
                        : "Used in refunds: "}
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "EUR",
                      }).format(transaction.refunded_amount)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      (
                      {Math.round(
                        (transaction.refunded_amount /
                          Math.abs(transaction.amount)) *
                          100
                      )}
                      %)
                    </span>
                  </div>

                  {transaction.type === "expense" && (
                    <div className="w-full mt-3">
                      <Progress
                        value={Math.round(
                          (transaction.refunded_amount /
                            Math.abs(transaction.amount)) *
                            100
                        )}
                        className="h-2"
                        indicatorClassName="bg-amber-500"
                      />
                      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                        <span>0%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p
                  className={cn(
                    "text-3xl font-semibold tracking-tight",
                    transactionColor
                  )}
                >
                  {transaction.type === "transfer"
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "EUR",
                      }).format(Math.abs(transaction.amount))
                    : `${
                        transaction.type === "expense" ? "-" : "+"
                      }${new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "EUR",
                      }).format(Math.abs(transaction.amount))}`}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="text-sm">
                  {new Date(transaction.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="text-sm truncate">
                  {transaction.category}
                  {transaction.subcategory && ` • ${transaction.subcategory}`}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Account Information */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <CreditCard className="h-4 w-4" />
              Account Details
            </div>
            <div className="space-y-3">
              {transaction.type === "transfer" ? (
                <>
                  <div>
                    <div className="text-sm text-muted-foreground">From</div>
                    <div className="font-medium">
                      {getAccountName(transaction.from_account_id)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">To</div>
                    <div className="font-medium">
                      {getAccountName(transaction.to_account_id)}
                    </div>
                  </div>
                </>
              ) : transaction.type === "expense" ? (
                <div>
                  <div className="text-sm text-muted-foreground">From</div>
                  <div className="font-medium">
                    {getAccountName(transaction.from_account_id)}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-muted-foreground">To</div>
                  <div className="font-medium">
                    {getAccountName(transaction.to_account_id)}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Refunds Section - Collapsible */}
          {(transaction.type === "expense" ||
            (refundItems && refundItems.length > 0)) && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                variant={
                  refundItems && refundItems.length > 0 ? "default" : "outline"
                }
                className={cn(
                  "w-full justify-between",
                  refundItems &&
                    refundItems.length > 0 &&
                    "bg-amber-600 hover:bg-amber-700 text-white"
                )}
                onClick={() => setShowRefunds(!showRefunds)}
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  <span>
                    {refundItems && refundItems.length > 0
                      ? `Refund Details (${refundItems.length})`
                      : "Refund Details"}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    showRefunds && "rotate-180"
                  )}
                />
              </Button>

              <AnimatePresence>
                {showRefunds && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl border bg-card p-6 mt-3">
                      {transaction.type === "expense" && (
                        <div className="mb-6">
                          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg mb-4">
                            <div className="space-y-1">
                              <span className="text-sm text-muted-foreground">
                                Original Amount
                              </span>
                              <p className="text-lg font-medium text-destructive">
                                {new Intl.NumberFormat("en-US", {
                                  style: "currency",
                                  currency: "EUR",
                                }).format(Math.abs(transaction.amount))}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-sm text-muted-foreground">
                                Total Refunded
                              </span>
                              <p className="text-lg font-medium text-emerald-600">
                                {new Intl.NumberFormat("en-US", {
                                  style: "currency",
                                  currency: "EUR",
                                }).format(
                                  refundItems.reduce(
                                    (total, item) => total + item.amount,
                                    0
                                  )
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="relative pt-1">
                            <div className="flex mb-2 items-center justify-between">
                              <div>
                                <span className="text-xs font-semibold inline-block text-emerald-600">
                                  {Math.round(
                                    (refundItems.reduce(
                                      (total, item) => total + item.amount,
                                      0
                                    ) /
                                      Math.abs(transaction.amount)) *
                                      100
                                  )}
                                  % Refunded
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-semibold inline-block text-destructive">
                                  {new Intl.NumberFormat("en-US", {
                                    style: "currency",
                                    currency: "EUR",
                                  }).format(
                                    Math.abs(transaction.amount) -
                                      refundItems.reduce(
                                        (total, item) => total + item.amount,
                                        0
                                      )
                                  )}{" "}
                                  remaining
                                </span>
                              </div>
                            </div>
                            <div className="overflow-hidden h-2 text-xs flex rounded bg-muted">
                              <div
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round(
                                      (refundItems.reduce(
                                        (total, item) => total + item.amount,
                                        0
                                      ) /
                                        Math.abs(transaction.amount)) *
                                        100
                                    )
                                  )}%`,
                                }}
                                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500"
                              ></div>
                            </div>
                          </div>
                        </div>
                      )}

                      {refundItems && refundItems.length > 0 ? (
                        <div className="space-y-4">
                          <h3 className="text-sm font-medium">
                            Refund Allocations
                          </h3>
                          <div className="space-y-3">
                            {refundItems.map(item => {
                              const linkedTransaction = getLinkedTransaction(
                                transaction.type === "expense"
                                  ? item.income_transaction_id
                                  : item.expense_transaction_id
                              )
                              const refundGroupName = getRefundGroupName(
                                item.refund_group_id
                              )

                              return (
                                <div
                                  key={item.id}
                                  className="p-4 rounded-lg bg-card border border-border/50 hover:border-border transition-colors space-y-3"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                      <p className="font-medium">
                                        {linkedTransaction?.description ||
                                          item.description}
                                      </p>
                                      <time className="text-xs text-muted-foreground flex items-center">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {new Date(
                                          linkedTransaction?.date || item.created_at
                                        ).toLocaleDateString("en-US", {
                                          year: "numeric",
                                          month: "short",
                                          day: "numeric",
                                        })}
                                      </time>
                                    </div>
                                    <p
                                      className={cn(
                                        "font-medium text-lg",
                                        transaction.type === "expense"
                                          ? "text-emerald-600"
                                          : "text-destructive"
                                      )}
                                    >
                                      {transaction.type === "expense"
                                        ? "+"
                                        : "-"}
                                      {new Intl.NumberFormat("en-US", {
                                        style: "currency",
                                        currency: "EUR",
                                      }).format(Math.abs(item.amount))}
                                    </p>
                                  </div>

                                  {refundGroupName && (
                                    <div className="flex items-center text-xs text-muted-foreground">
                                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                        {refundGroupName}
                                      </span>
                                    </div>
                                  )}

                                  {linkedTransaction && (
                                    <div className="flex justify-end">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() =>
                                          navigate({
                                            to: "/transactions/$transactionId",
                                            params: {
                                              transactionId:
                                                linkedTransaction.id.toString(),
                                            },
                                          })
                                        }
                                      >
                                        <FileText className="h-3 w-3 mr-1" />
                                        View{" "}
                                        {transaction.type === "expense"
                                          ? "income"
                                          : "expense"}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <p className="text-sm">No refunds recorded</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => navigate({ to: "/refunds" })}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Refund
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        <TransactionForm
          open={!!useDialogStore.getState().editTransaction}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              useDialogStore.getState().setEditTransaction(null)
            }
          }}
          transaction={useDialogStore.getState().editTransaction || undefined}
          redirectTo={`/transactions/${transactionId}`}
        />
        <DeleteTransactionDialog redirectTo="/transactions/all" />
      </motion.div>
    </PageContainer>
  )
}
