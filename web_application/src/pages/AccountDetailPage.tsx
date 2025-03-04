import {
  useAccountBalanceHistory,
  useAccounts,
  useAllCategories,
  useBanks,
  useTransactions
} from "@/api/queries"
import { AccountBalanceChart } from "@/components/accounts/AccountBalanceChart"
import { DeleteAccountDialog } from "@/components/accounts/DeleteAccountDialog"
import { EditAccountDialog } from "@/components/accounts/EditAccountDialog"
import { PageContainer } from "@/components/layout/PageContainer"
import { DeleteTransactionDialog } from "@/components/transactions/DeleteTransactionDialog"
import { EditTransactionDialog } from "@/components/transactions/EditTransactionDialog"
import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"
import { accountDetailRoute } from "@/Router"
import { Account, Bank, Transaction } from "@/types"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { ArrowLeft, ExternalLink, Pencil, Trash } from "lucide-react"
import { useEffect, useState } from "react"

export function AccountDetailPage() {
  const accountId = parseInt(accountDetailRoute.useParams().accountId)
  const navigate = useNavigate()
  const router = useRouter()
  const [isEditingAccount, setIsEditingAccount] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)

  const { data: banksResponse } = useBanks()
  const { data: allCategories } = useAllCategories()

  const { data: transactionsResponse } = useTransactions({
    account_id: accountId,
    per_page: 5,
    sort_by: 'date',
    sort_order: 'desc'
  })
  const recentTransactions = transactionsResponse?.items || []


  const { data: accountsResponse, isLoading: isLoadingAccounts } = useAccounts({
    per_page: 6,
    id: [...new Set(recentTransactions.map(transaction => transaction.from_account_id).concat(recentTransactions.map(transaction => transaction.to_account_id)))]
  })

  const { data: balanceHistory } = useAccountBalanceHistory(accountId)

  const getAccountName = (accountId: number) => {
    const account = accountsResponse?.items?.find((a: Account) => a.id === accountId)
    return account?.name || '-'
  }

  const account = accountsResponse?.items?.find((a: Account) => a.id === accountId)
  const banks = banksResponse?.items || []
  const bank = account ? banks.find((b: Bank) => b.id === account.bank_id) : null

  const getLastUpdated = () => {
    if (!recentTransactions.length) return 'Never';
    const mostRecent = recentTransactions[0]; // Transactions are already sorted by date desc
    return new Date(mostRecent.date).toLocaleDateString();
  }

  const getCategoryColor = (categoryName: string) => {
    if (!allCategories) return "hsl(var(--primary))";

    for (const type of ["income", "expense", "transfer"] as const) {
      const category = allCategories[type]?.find(cat => cat.name.fr === categoryName);
      if (category) {
        return category.color;
      }
    }
    return "hsl(var(--primary))";
  };

  useEffect(() => {
    function handleKeyPress(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const isInput = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      if (!selectedTransactionId || isInput) return

      const transaction = recentTransactions.find(
        (t: Transaction) => t.id === parseInt(selectedTransactionId)
      )
      if (!transaction) return

      if (event.key === 'e') {
        event.preventDefault()
        setEditingTransaction(transaction)
      } else if (event.key === 'd') {
        event.preventDefault()
        setDeletingTransaction(transaction)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        navigate({
          to: "/transactions/$transactionId",
          params: { transactionId: transaction.id.toString() }
        })
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => {
      document.removeEventListener('keydown', handleKeyPress)
    }
  }, [selectedTransactionId, recentTransactions, navigate])

  if (isLoadingAccounts) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </PageContainer>
    )
  }

  if (!account) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-4">Account not found</h2>
          <Button onClick={() => router.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer key={accountId}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-3">
                <span className="text-3xl">{ACCOUNT_TYPE_ICONS[account.type as keyof typeof ACCOUNT_TYPE_ICONS]}</span>
                {account.name}
              </h1>
              <p className="text-muted-foreground">
                {ACCOUNT_TYPE_LABELS[account.type as keyof typeof ACCOUNT_TYPE_LABELS]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => setIsEditingAccount(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Account
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="group hover:bg-destructive/90 transition-colors"
              onClick={() => account && setDeletingAccount(account)}
            >
              <Trash className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
              Delete Account
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50">
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className={`text-2xl font-semibold mt-2 ${account.balance < 0 ? 'text-destructive' : 'text-success'}`}>
              {new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: 'EUR'
              }).format(Math.abs(account.balance))}
            </p>
          </div>
          <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50">
            <p className="text-sm text-muted-foreground">Latest Transaction</p>
            <p className="text-2xl font-semibold mt-2">
              {getLastUpdated()}
            </p>
          </div>
          {account.type !== 'expense' && account.type !== 'income' && (
            <div className="bg-card rounded-xl p-6 shadow-sm border border-border/50">
              <p className="text-sm text-muted-foreground">Bank</p>
              <p className="text-2xl font-semibold mt-2">
                {bank?.name || 'Other'}
                {bank?.website && (
                  <a
                    href={bank.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 ml-2 text-primary hover:underline text-base"
                  >
                    Visit Bank
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Balance Chart */}
        <div className="mt-6">
          <AccountBalanceChart
            currentBalance={account.balance}
            balanceHistory={balanceHistory}
          />
        </div>

        {/* Recent Transactions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Transactions</h2>
            <Button
              variant="outline"
              onClick={() => navigate({
                to: "/transactions/all",
                search: { account: accountId }
              })}
            >
              View All Account Transactions
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {account.type === 'expense' && <TableHead>From Account</TableHead>}
                  {account.type === 'income' && <TableHead>To Account</TableHead>}
                  {['checking', 'savings', 'investment'].includes(account.type) && <TableHead>Related Account</TableHead>}
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((transaction: Transaction) => (
                    <TableRow
                      key={transaction.id}
                      className={cn(
                        "transition-colors cursor-pointer",
                        selectedTransactionId === transaction.id.toString() && "bg-muted",
                        "hover:bg-muted/50"
                      )}
                      onMouseEnter={() => setSelectedTransactionId(transaction.id.toString())}
                      onMouseLeave={() => setSelectedTransactionId(null)}
                      onClick={() => navigate({
                        to: "/transactions/$transactionId",
                        params: { transactionId: transaction.id.toString() }
                      })}
                    >
                      <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                      {account.type === 'expense' && (
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto font-normal text-muted-foreground hover:text-primary"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate({
                                to: "/accounts/$accountId",
                                params: { accountId: transaction.from_account_id.toString() }
                              });
                            }}
                          >
                            {getAccountName(transaction.from_account_id)}
                          </Button>
                        </TableCell>
                      )}
                      {account.type === 'income' && (
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto font-normal text-muted-foreground hover:text-primary"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate({
                                to: "/accounts/$accountId",
                                params: { accountId: transaction.to_account_id.toString() }
                              });
                            }}
                          >
                            {getAccountName(transaction.to_account_id)}
                          </Button>
                        </TableCell>
                      )}
                      {['checking', 'savings', 'investment'].includes(account.type) && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${transaction.from_account_id === accountId ? 'text-destructive' : 'text-success'}`}>
                              {transaction.from_account_id === accountId ? '→ To' : '← From'}
                            </span>
                            <Button
                              variant="link"
                              className="p-0 h-auto font-normal text-muted-foreground hover:text-primary"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const relatedAccountId = transaction.from_account_id === accountId
                                  ? transaction.to_account_id
                                  : transaction.from_account_id;
                                navigate({
                                  to: "/accounts/$accountId",
                                  params: { accountId: relatedAccountId.toString() }
                                });
                              }}
                            >
                              {transaction.from_account_id === accountId
                                ? getAccountName(transaction.to_account_id)
                                : getAccountName(transaction.from_account_id)}
                            </Button>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell>
                        <span
                          className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:opacity-80"
                          style={{
                            backgroundColor: `${getCategoryColor(transaction.category)}25`,
                            color: `${getCategoryColor(transaction.category)}`,
                            borderColor: `${getCategoryColor(transaction.category)}`
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate({
                              to: '/transactions/all',
                              search: {
                                category: transaction.category
                              }
                            });
                          }}
                        >
                          {transaction.category}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right ${transaction.amount < 0 ? 'text-destructive' : 'text-success'}`}>
                        {new Intl.NumberFormat(undefined, {
                          style: 'currency',
                          currency: 'EUR'
                        }).format(Math.abs(transaction.amount))}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No recent transactions
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {editingTransaction && (
          <EditTransactionDialog
            transaction={editingTransaction}
            open={!!editingTransaction}
            onOpenChange={(open) => !open && setEditingTransaction(null)}
          />
        )}

        {deletingTransaction && (
          <DeleteTransactionDialog
            transaction={deletingTransaction}
            open={!!deletingTransaction}
            onOpenChange={(open) => !open && setDeletingTransaction(null)}
            onConfirmDelete={(transaction) => {
              // Handle delete mutation here
              setDeletingTransaction(null);
            }}
            isDeleting={false}
          />
        )}

        {/* Edit Account Dialog */}
        {isEditingAccount && (
          <EditAccountDialog
            account={account}
            open={isEditingAccount}
            onOpenChange={(open) => !open && setIsEditingAccount(false)}
          />
        )}

        <DeleteAccountDialog
          account={deletingAccount}
          open={!!deletingAccount}
          onOpenChange={(open) => !open && setDeletingAccount(null)}
          redirectTo="/accounts"
        />
      </div>
    </PageContainer>
  )
}
