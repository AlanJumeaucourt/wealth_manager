import { useAccounts, useRefundGroups, useRefundItems, useTransactions } from "@/api/queries"
import { PageContainer } from "@/components/layout/PageContainer"
import { DeleteTransactionDialog } from "@/components/transactions/DeleteTransactionDialog"
import { EditTransactionDialog } from "@/components/transactions/EditTransactionDialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { transactionDetailRoute } from "@/Router"
import { useDialogStore } from "@/store/dialogStore"
import { useNavigate, useRouter, } from "@tanstack/react-router"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, Calendar, ChevronDown, CreditCard, FileText, Pencil, RefreshCw, Tag, Trash } from "lucide-react"
import { useCallback, useMemo, useState } from "react"

export function TransactionDetailPage() {
  const { transactionId } = transactionDetailRoute.useParams()
  const navigate = useNavigate()
  const router = useRouter()
  const [showRefunds, setShowRefunds] = useState(false)
  const { setEditTransaction, setDeleteTransaction } = useDialogStore()

  // Always fetch these base queries
  const { data: transactionsResponse, isLoading: isLoadingTransaction } = useTransactions({
    id: transactionId,
    per_page: 1
  })

  const { data: accountsResponse, isLoading: isLoadingAccounts } = useAccounts({
    type: 'checking,savings,investment,income,expense',
    per_page: 1000,
  })

  const { data: refundItemsResponse, isLoading: isLoadingRefunds } = useRefundItems({
    per_page: 1000,
  })

  const { data: refundGroupsResponse } = useRefundGroups({
    per_page: 1000
  })

  const transaction = transactionsResponse?.items[0]
  const accounts = accountsResponse?.items || []
  const refundGroups = refundGroupsResponse?.items || []

  // Memoized values that depend on transaction
  const refundItems = useMemo(() => {
    if (!transaction || !refundItemsResponse?.items) return []
    return refundItemsResponse.items.filter(item =>
      transaction.type === 'expense'
        ? item.expense_transaction_id === transaction.id
        : item.income_transaction_id === transaction.id
    )
  }, [transaction, refundItemsResponse])

  const linkedTransactionIds = useMemo(() => {
    if (!transaction) return []
    return refundItems
      .map(item => transaction.type === 'expense' ? item.income_transaction_id : item.expense_transaction_id)
      .filter((id): id is number => !!id)
  }, [transaction, refundItems])

  // Only fetch linked transactions if we have IDs
  const { data: linkedTransactionsResponse } = useTransactions(
    linkedTransactionIds.length > 0
      ? {
          id: linkedTransactionIds,
          per_page: linkedTransactionIds.length
        }
      : undefined
  )

  const linkedTransactions = linkedTransactionsResponse?.items || []

  const getAccountName = useCallback((accountId?: number) => {
    if (!accountId) return ''
    const account = accounts.find(a => a.id === accountId)
    return account ? account.name : ''
  }, [accounts])

  const getRefundGroupName = useCallback((groupId?: number | null) => {
    if (!groupId) return null
    const group = refundGroups.find(g => g.id === groupId)
    return group?.name || null
  }, [refundGroups])

  const getLinkedTransaction = useCallback((transactionId: number) => {
    return linkedTransactions.find(t => t.id === transactionId) || null
  }, [linkedTransactions])

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

  const transactionColor = transaction.type === 'expense'
    ? 'text-destructive'
    : transaction.type === 'income'
      ? 'text-emerald-600'
      : 'text-primary'

  const transactionBgColor = transaction.type === 'expense'
    ? 'bg-destructive/10'
    : transaction.type === 'income'
      ? 'bg-emerald-500/10'
      : 'bg-primary/10'

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
              <span className={cn(
                "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-3",
                transactionBgColor,
                transactionColor
              )}>
                {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
              </span>
              <h1 className="text-xl font-medium mb-3 max-w-md">{transaction.description}</h1>
              <p className={cn("text-3xl font-semibold tracking-tight", transactionColor)}>
                {transaction.type === 'transfer'
                  ? new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'EUR'
                    }).format(Math.abs(transaction.amount))
                  : `${transaction.type === 'expense' ? '-' : '+'}${new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'EUR'
                    }).format(Math.abs(transaction.amount))}`
                }
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="text-sm">
                  {new Date(transaction.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
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
              {transaction.type === 'transfer' ? (
                <>
                  <div>
                    <div className="text-sm text-muted-foreground">From</div>
                    <div className="font-medium">{getAccountName(transaction.from_account_id)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">To</div>
                    <div className="font-medium">{getAccountName(transaction.to_account_id)}</div>
                  </div>
                </>
              ) : transaction.type === 'expense' ? (
                <div>
                  <div className="text-sm text-muted-foreground">From</div>
                  <div className="font-medium">{getAccountName(transaction.from_account_id)}</div>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-muted-foreground">To</div>
                  <div className="font-medium">{getAccountName(transaction.to_account_id)}</div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Refunds Section - Collapsible */}
          {(transaction.type === 'expense' || (refundItems && refundItems.length > 0)) && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => setShowRefunds(!showRefunds)}
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  <span>Refund Details</span>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  showRefunds && "rotate-180"
                )} />
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
                      {transaction.type === 'expense' && (
                        <div className="mb-6 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Total Refunded</span>
                            <span className="text-sm font-medium text-emerald-600">
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'EUR'
                              }).format(refundItems.reduce((total, item) => total + item.amount, 0))}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Remaining</span>
                            <span className="text-sm font-medium text-destructive">
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'EUR'
                              }).format(transaction.amount - refundItems.reduce((total, item) => total + item.amount, 0))}
                            </span>
                          </div>
                        </div>
                      )}

                      {refundItems && refundItems.length > 0 ? (
                        <div className="space-y-3">
                          {refundItems.map((item) => {
                            const linkedTransaction = getLinkedTransaction(
                              transaction.type === 'expense' ? item.income_transaction_id : item.expense_transaction_id
                            )
                            const refundGroupName = getRefundGroupName(item.refund_group_id)

                            return (
                              <div
                                key={item.id}
                                className="p-3 rounded-lg bg-muted/50 space-y-2"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="space-y-1">
                                    <p className="font-medium">{item.description}</p>
                                    <time className="text-xs text-muted-foreground">
                                      {new Date(item.date).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                      })}
                                    </time>
                                  </div>
                                  <p className={cn(
                                    "font-medium",
                                    transaction.type === 'expense' ? 'text-emerald-600' : 'text-destructive'
                                  )}>
                                    {transaction.type === 'expense' ? '+' : '-'}
                                    {new Intl.NumberFormat('en-US', {
                                      style: 'currency',
                                      currency: 'EUR'
                                    }).format(Math.abs(item.amount))}
                                  </p>
                                </div>
                                {(refundGroupName || linkedTransaction) && (
                                  <div className="flex items-center justify-between gap-2">
                                    {refundGroupName && (
                                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                        {refundGroupName}
                                      </span>
                                    )}
                                    {linkedTransaction && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => navigate({
                                          to: "/transactions/$transactionId",
                                          params: { transactionId: linkedTransaction.id.toString() }
                                        })}
                                      >
                                        <FileText className="h-3 w-3 mr-1" />
                                        View linked
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <p className="text-sm">No refunds recorded</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        <EditTransactionDialog redirectTo={`/transactions/${transactionId}`} />
        <DeleteTransactionDialog redirectTo="/transactions/all" />
      </motion.div>
    </PageContainer>
  )
}
