import { useTransactions } from "@/api/queries"
import { CreateRefundModal } from "@/components/refunds/CreateRefundModal"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { RefundGroup, RefundItem, Transaction } from "@/types"
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  DollarSign,
  MoreHorizontal,
  Pencil,
  Trash,
  Wallet,
  ArrowDownRight,
  Sparkles,
} from "lucide-react"
import { useState } from "react"

interface RefundsListProps {
  refundGroups: RefundGroup[]
  refundItems: RefundItem[]
  onDeleteRefundGroup: (group: RefundGroup) => void
  onDeleteRefundItem: (item: RefundItem) => void
}

export function RefundsList({
  refundGroups,
  refundItems,
  onDeleteRefundGroup,
  onDeleteRefundItem,
}: RefundsListProps) {
  // Get all unique transaction IDs from refund items
  const allTransactionIds = Array.from(
    new Set([
      ...refundItems.map(item => item.expense_transaction_id),
      ...refundItems.map(item => item.income_transaction_id),
    ])
  )

  // Fetch all transactions by IDs
  const { data: transactionsData } = useTransactions({
    id: allTransactionIds,
    per_page: allTransactionIds.length || 1,
  })

  const [editingRefund, setEditingRefund] = useState<{
    refundGroupId?: number
    refundItems: {
      id: number
      expenseId: number
      incomeId: number
      amount: number
    }[]
  } | null>(null)

  const [hoveredItem, setHoveredItem] = useState<{
    type: "group" | "item"
    id: number
  } | null>(null)

  // Create a map of all transactions
  const transactionsMap = new Map<number, Transaction>(
    (transactionsData?.items || []).map(t => [t.id, t])
  )

  // Group standalone refund items (not part of a group)
  const standaloneItems = refundItems.filter(item => !item.refund_group_id)

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Calculate summary statistics
  const calculateSummary = () => {
    const totalExpenses = refundItems.reduce((sum, item) => {
      const tx = transactionsMap.get(item.expense_transaction_id)
      return sum + (tx ? Math.abs(tx.amount) : 0)
    }, 0)

    const totalRefunds = refundItems.reduce((sum, item) => sum + item.amount, 0)

    const refundRate = totalExpenses > 0 ? (totalRefunds / totalExpenses) * 100 : 0

    const totalGroups = refundGroups.length
    const totalIndividualRefunds = standaloneItems.length

    return {
      totalExpenses,
      totalRefunds,
      refundRate,
      totalGroups,
      totalIndividualRefunds,
      totalRefundItems: refundItems.length
    }
  }

  const summary = calculateSummary()

  const RefundCard = ({
    expense,
    income,
    amount,
    item,
  }: {
    expense: Transaction
    income: Transaction
    amount: number
    item: RefundItem
  }) => (
    <div
      className="grid md:grid-cols-2 gap-4 p-4 bg-white rounded-lg border border-gray-100 shadow-sm transition-all hover:shadow-md"
      onMouseEnter={() => setHoveredItem({ type: "item", id: item.id! })}
      onMouseLeave={() => setHoveredItem(null)}
    >
      <div className="space-y-3">
        <div className="text-sm font-medium text-gray-500 flex items-center">
          <ArrowDownRight className="w-4 h-4 mr-1.5 text-red-500" />
          Expense
        </div>
        <div className="space-y-2">
          <div className="font-medium">{expense.description}</div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDate(expense.date)}
            </div>
            <div className="flex items-center gap-1.5 text-red-600 font-medium">
              <DollarSign className="w-4 h-4" />$
              {Math.abs(expense.amount).toFixed(2)}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-sm font-medium text-gray-500 flex items-center">
          <ArrowUpRight className="w-4 h-4 mr-1.5 text-green-500" />
          Refund
        </div>
        <div className="space-y-2">
          <div className="font-medium">{income.description}</div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDate(income.date)}
            </div>
            <div className="flex items-center gap-1.5 text-green-600 font-medium">
              <DollarSign className="w-4 h-4" />${amount.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const handleEditGroup = (groupId: number) => {
    const groupItems = refundItems.filter(
      item => item.refund_group_id === groupId
    )
    setEditingRefund({
      refundGroupId: groupId,
      refundItems: groupItems.map(item => ({
        id: item.id!,
        expenseId: item.expense_transaction_id,
        incomeId: item.income_transaction_id,
        amount: item.amount,
      })),
    })
  }

  const handleEditStandaloneItem = (item: RefundItem) => {
    setEditingRefund({
      refundItems: [
        {
          id: item.id!,
          expenseId: item.expense_transaction_id,
          incomeId: item.income_transaction_id,
          amount: item.amount,
        },
      ],
    })
  }

  useKeyboardShortcuts({
    onEdit: () => {
      if (!hoveredItem) return

      if (hoveredItem.type === "group") {
        handleEditGroup(hoveredItem.id)
      } else {
        const item = refundItems.find(i => i.id === hoveredItem.id)
        if (item) handleEditStandaloneItem(item)
      }
    },
    onDelete: () => {
      if (!hoveredItem) return

      if (hoveredItem.type === "group") {
        const group = refundGroups.find(g => g.id === hoveredItem.id)
        if (group) onDeleteRefundGroup(group)
      } else {
        const item = refundItems.find(i => i.id === hoveredItem.id)
        if (item) onDeleteRefundItem(item)
      }
    },
    disabled: !!editingRefund
  })

  return (
    <div className="space-y-8">
      {/* Summary Dashboard */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Refund Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">Total Refunds</div>
              <div className="text-2xl font-semibold text-green-600 mt-1">
                ${summary.totalRefunds.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {summary.totalRefundItems} refund items
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">Original Expenses</div>
              <div className="text-2xl font-semibold text-red-600 mt-1">
                ${summary.totalExpenses.toFixed(2)}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">Refund Rate</div>
              <div className="text-2xl font-semibold mt-1 flex items-center">
                {summary.refundRate.toFixed(1)}%
                <Sparkles className="w-4 h-4 ml-2 text-yellow-500" />
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">Categories</div>
              <div className="flex gap-2 mt-1">
                <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                  {summary.totalGroups} groups
                </div>
                <div className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">
                  {summary.totalIndividualRefunds} individual
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grouped Refunds */}
      {refundGroups.map(group => {
        const groupItems = refundItems.filter(
          item => item.refund_group_id === group.id
        )
        const uniqueExpenseIds = new Set(
          groupItems.map(item => item.expense_transaction_id)
        )
        const uniqueIncomeIds = new Set(
          groupItems.map(item => item.income_transaction_id)
        )

        const totalExpense = Array.from(uniqueExpenseIds)
          .map(id => transactionsMap.get(id))
          .reduce((sum, t) => sum + (t ? Math.abs(t.amount) : 0), 0)

        const totalIncome = Array.from(uniqueIncomeIds)
          .map(id => transactionsMap.get(id))
          .reduce((sum, t) => sum + (t ? t.amount : 0), 0)

        const refundPercentage = (totalIncome / totalExpense) * 100

        return (
          <div
            key={group.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md"
            onMouseEnter={() =>
              setHoveredItem({ type: "group", id: group.id! })
            }
            onMouseLeave={() => setHoveredItem(null)}
          >
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold">{group.name}</h2>
                  {group.description && (
                    <p className="text-gray-500 mt-1">{group.description}</p>
                  )}
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-semibold text-green-600">
                      ${totalIncome.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {refundPercentage.toFixed(1)}% of expenses refunded
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleEditGroup(group.id!)}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit (E)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => onDeleteRefundGroup(group)}
                      >
                        <Trash className="w-4 h-4 mr-2" />
                        Delete (D)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-sm text-gray-500 mb-1 flex items-center">
                    <ArrowDownRight className="w-4 h-4 mr-1.5 text-red-500" />
                    Total Expenses
                  </div>
                  <div className="text-lg font-semibold text-red-600">
                    ${totalExpense.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1 flex items-center">
                    <ArrowUpRight className="w-4 h-4 mr-1.5 text-green-500" />
                    Total Refunds
                  </div>
                  <div className="text-lg font-semibold text-green-600">
                    ${totalIncome.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1 flex items-center">
                    <Sparkles className="w-4 h-4 mr-1.5 text-yellow-500" />
                    Refund Rate
                  </div>
                  <div className="text-lg font-semibold">
                    {refundPercentage.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Transactions */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Expenses */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-500 flex items-center">
                    <Wallet className="w-4 h-4 mr-1.5 text-red-500" />
                    Expenses
                  </h3>
                  <div className="space-y-2">
                    {Array.from(uniqueExpenseIds).map(id => {
                      const transaction = transactionsMap.get(id)
                      if (!transaction) return null

                      const items = groupItems.filter(
                        item => item.expense_transaction_id === id
                      )
                      const totalRefunded = items.reduce(
                        (sum, item) => sum + item.amount,
                        0
                      )
                      const percentage =
                        (totalRefunded / Math.abs(transaction.amount)) * 100

                      return (
                        <div
                          key={id}
                          className="p-4 bg-gray-50 rounded-lg space-y-2 border border-gray-100"
                        >
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div className="font-medium">
                                {transaction.description}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-gray-500">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-4 h-4" />
                                  {formatDate(transaction.date)}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <DollarSign className="w-4 h-4" />$
                                  {Math.abs(transaction.amount).toFixed(2)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-green-600">
                                ${totalRefunded.toFixed(2)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {percentage.toFixed(1)}% refunded
                              </div>
                            </div>
                          </div>
                          {items.map(item => {
                            const income = transactionsMap.get(
                              item.income_transaction_id
                            )
                            if (!income) return null

                            return (
                              <div
                                key={item.id}
                                className="flex items-center gap-2 text-sm pl-4 py-1 border-t border-gray-100 mt-2"
                              >
                                <ArrowRight className="w-4 h-4 text-green-500" />
                                <span className="text-gray-600">
                                  {income.description}:
                                </span>
                                <span className="font-medium text-green-600">
                                  ${item.amount.toFixed(2)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Incomes */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-500 flex items-center">
                    <Wallet className="w-4 h-4 mr-1.5 text-green-500" />
                    Refunds
                  </h3>
                  <div className="space-y-2">
                    {Array.from(uniqueIncomeIds).map(id => {
                      const transaction = transactionsMap.get(id)
                      if (!transaction) return null

                      const items = groupItems.filter(
                        item => item.income_transaction_id === id
                      )
                      const totalContribution = items.reduce(
                        (sum, item) => sum + item.amount,
                        0
                      )
                      const percentage = (totalContribution / totalIncome) * 100

                      return (
                        <div
                          key={id}
                          className="p-4 bg-gray-50 rounded-lg space-y-2 border border-gray-100"
                        >
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div className="font-medium">
                                {transaction.description}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-gray-500">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-4 h-4" />
                                  {formatDate(transaction.date)}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <DollarSign className="w-4 h-4" />$
                                  {transaction.amount.toFixed(2)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-green-600">
                                ${totalContribution.toFixed(2)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {percentage.toFixed(1)}% of total
                              </div>
                            </div>
                          </div>
                          {items.map(item => {
                            const expense = transactionsMap.get(
                              item.expense_transaction_id
                            )
                            if (!expense) return null

                            return (
                              <div
                                key={item.id}
                                className="flex items-center gap-2 text-sm pl-4 py-1 border-t border-gray-100 mt-2"
                              >
                                <ArrowRight className="w-4 h-4 text-red-500" />
                                <span className="text-gray-600">
                                  {expense.description}:
                                </span>
                                <span className="font-medium">
                                  ${item.amount.toFixed(2)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* Standalone Refunds */}
      {standaloneItems.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center">
            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm mr-2">
              {standaloneItems.length}
            </span>
            Individual Refunds
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {standaloneItems.map(item => {
              const expense = transactionsMap.get(item.expense_transaction_id)
              const income = transactionsMap.get(item.income_transaction_id)

              if (!expense || !income) return null

              return (
                <div key={item.id} className="relative group">
                  <RefundCard
                    expense={expense}
                    income={income}
                    amount={item.amount}
                    item={item}
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleEditStandaloneItem(item)}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit (E)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => onDeleteRefundItem(item)}
                        >
                          <Trash className="w-4 h-4 mr-2" />
                          Delete (D)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {editingRefund && (
        <CreateRefundModal
          isOpen={!!editingRefund}
          onClose={() => setEditingRefund(null)}
          editMode={editingRefund}
        />
      )}
    </div>
  )
}
