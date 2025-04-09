import { Account, Transaction } from "@/types"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowUpRight, Clock } from "lucide-react"

interface RecentActivityProps {
  transactions: Transaction[]
  accounts: Account[]
  navigate: (to: string) => void
}

export function RecentActivity({ transactions, accounts, navigate }: RecentActivityProps) {
  if (!transactions || transactions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-6">
            <p className="text-muted-foreground text-sm">No recent transactions</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Get account names for display
  const getAccountName = (id: number) => {
    const account = accounts.find(a => a.id === id)
    return account ? account.name : "Unknown Account"
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(Math.abs(amount))
  }

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    })
  }

  // Get icon and color based on transaction type
  const getTransactionDetails = (transaction: Transaction) => {
    const colors = {
      expense: "text-red-500 bg-red-100 dark:bg-red-950",
      income: "text-green-500 bg-green-100 dark:bg-green-950",
      transfer: "text-blue-500 bg-blue-100 dark:bg-blue-950"
    }

    const icons = {
      expense: "↓",
      income: "↑",
      transfer: "↔"
    }

    return {
      color: colors[transaction.type],
      icon: icons[transaction.type]
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="px-2">
        <div className="space-y-4">
          {transactions.map(transaction => {
            const { color, icon } = getTransactionDetails(transaction)

            return (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors"
                onClick={() => navigate(`/transactions/${transaction.id}`)}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full ${color}`}>
                    {icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium line-clamp-1">{transaction.description}</p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDate(transaction.date)}
                      <span className="mx-1">•</span>
                      {transaction.type === 'transfer'
                        ? `${getAccountName(transaction.from_account_id)} → ${getAccountName(transaction.to_account_id)}`
                        : transaction.type === 'expense'
                          ? getAccountName(transaction.from_account_id)
                          : getAccountName(transaction.to_account_id)
                      }
                    </div>
                  </div>
                </div>
                <div className={`text-sm font-medium ${
                  transaction.type === "expense" ? "text-red-500" :
                  transaction.type === "income" ? "text-green-500" : ""
                }`}>
                  {transaction.type === "expense" ? "-" :
                   transaction.type === "income" ? "+" : ""}
                  {formatCurrency(transaction.amount)}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate("/transactions/all")}
        >
          <Clock className="mr-2 h-4 w-4" /> View All Transactions
        </Button>
      </CardFooter>
    </Card>
  )
}
