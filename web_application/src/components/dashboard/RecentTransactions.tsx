import { DeleteTransactionDialog } from "@/components/transactions/DeleteTransactionDialog"
import { EditTransactionDialog } from "@/components/transactions/EditTransactionDialog"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Transaction } from "../../types"

interface Props {
  transactions: Transaction[]
}

function getTransactionIcon(type: Transaction['type'], category: string): string {
  switch (type) {
    case 'income':
      return '💰'
    case 'expense':
      return category.includes('Alimentation') ? '🛒' :
             category.includes('Loisirs') ? '🎮' :
             '💸'
    case 'transfer':
      return '↔️'
    default:
      return '💱'
  }
}

export function RecentTransactions({ transactions }: Props) {
  const navigate = useNavigate()
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null)

  useKeyboardShortcuts({
    onEdit: () => {
      if (selectedTransactionId) {
        const transaction = transactions.find(t => t.id === selectedTransactionId)
        if (transaction) {
          setEditingTransaction(transaction)
        }
      }
    },
    onDelete: () => {
      if (selectedTransactionId) {
        const transaction = transactions.find(t => t.id === selectedTransactionId)
        if (transaction) {
          setDeletingTransaction(transaction)
        }
      }
    },
    onNew: () => {
      navigate({ to: "/transactions/new" })
    },
  })

  if (!transactions.length) {
    return (
      <div className="bg-card rounded-xl border p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
        <p className="text-muted-foreground">No recent transactions</p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Recent Transactions</h2>
        <button
          onClick={() => navigate({ to: "/transactions/all" })}
          className="text-sm text-primary hover:underline"
        >
          Show All
        </button>
      </div>
      <div className="space-y-3">
        {transactions.map(transaction => (
          <div
            key={transaction.id}
            className={`flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${
              selectedTransactionId === transaction.id ? 'bg-muted' : ''
            }`}
            onClick={() => setEditingTransaction(transaction)}
            onMouseEnter={() => setSelectedTransactionId(transaction.id)}
            onMouseLeave={() => setSelectedTransactionId(null)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setEditingTransaction(transaction)
              }
            }}
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 text-2xl bg-muted p-2 rounded-md">
                  {getTransactionIcon(transaction.type, transaction.category)}
                </span>
                <div className="flex flex-col">
                  <span className="font-medium">{transaction.description}</span>
                  <span className="text-sm text-muted-foreground">{transaction.category}</span>
                </div>
              </div>
              <span className="text-sm text-muted-foreground">
                {new Date(transaction.date).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
            <span className={`font-semibold ${transaction.type === 'expense' ? 'text-destructive' : 'text-success'}`}>
              {transaction.type === 'expense' ? '-' : '+'}
              {new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: 'EUR'
              }).format(Math.abs(transaction.amount))}
            </span>
          </div>
        ))}
      </div>

      {/* Edit Dialog */}
      {editingTransaction && (
        <EditTransactionDialog
          transaction={editingTransaction}
          open={true}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
        />
      )}

      {/* Delete Dialog */}
      <DeleteTransactionDialog
        transaction={deletingTransaction}
        open={!!deletingTransaction}
        onOpenChange={(open) => !open && setDeletingTransaction(null)}
        redirectTo="/dashboard"
      />
    </div>
  )
}
