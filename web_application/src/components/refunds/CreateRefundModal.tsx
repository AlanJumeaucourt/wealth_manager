import {
  useCreateRefundGroup,
  useCreateRefundItem,
  useDeleteRefundItem,
  useTransactions,
  useUpdateRefundGroup,
  useUpdateRefundItem,
} from "@/api/queries"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useDebounce } from "@/hooks/useDebounce"
import { Transaction } from "@/types"
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
} from "lucide-react"
import React, { useCallback, useEffect, useRef, useState } from "react"

interface CreateRefundModalProps {
  isOpen: boolean
  onClose: () => void
  editMode?: {
    refundGroupId?: number
    refundItems: {
      id: number
      expenseId: number
      incomeId: number
      amount: number
    }[]
  }
}

interface AllocationItem {
  expenseId: number
  incomeId: number
  amount: number
  maxAmount: number
}

type Step = "expenses" | "incomes" | "allocations" | "review"

export function CreateRefundModal({
  isOpen,
  onClose,
  editMode,
}: CreateRefundModalProps) {
  console.log("CreateRefundModal render", { isOpen, editMode })
  const { toast } = useToast()
  const [step, setStep] = useState<Step>("expenses")
  const [selectedIncomes, setSelectedIncomes] = useState<Transaction[]>([])
  const [selectedExpenses, setSelectedExpenses] = useState<Transaction[]>([])
  const [allocations, setAllocations] = useState<AllocationItem[]>([])
  const [incomeSearch, setIncomeSearch] = useState("")
  const [expenseSearch, setExpenseSearch] = useState("")
  const [isInitialized, setIsInitialized] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [groupDescription, setGroupDescription] = useState("")
  const debouncedIncomeSearch = useDebounce(incomeSearch, 300)
  const debouncedExpenseSearch = useDebounce(expenseSearch, 300)

  // Add state for pagination
  const [incomePage, setIncomePage] = useState(1)
  const [expensePage, setExpensePage] = useState(1)
  const [hasMoreIncomes, setHasMoreIncomes] = useState(true)
  const [hasMoreExpenses, setHasMoreExpenses] = useState(true)
  const [isLoadingMoreIncomes, setIsLoadingMoreIncomes] = useState(false)
  const [isLoadingMoreExpenses, setIsLoadingMoreExpenses] = useState(false)

  // Refs for intersection observer
  const incomeLoadMoreRef = useRef<HTMLDivElement>(null)
  const expenseLoadMoreRef = useRef<HTMLDivElement>(null)

  // Queries
  const { data: incomeTransactions, isLoading: isLoadingIncomes } =
    useTransactions({
      type: "income",
      per_page: 20,
      page: incomePage,
      sort_by: "date",
      sort_order: "desc",
      search: debouncedIncomeSearch || undefined,
      search_fields: debouncedIncomeSearch ? ["description"] : undefined,
    })

  const { data: expenseTransactions, isLoading: isLoadingExpenses } =
    useTransactions({
      type: "expense",
      per_page: 20,
      page: expensePage,
      sort_by: "date",
      sort_order: "desc",
      search: debouncedExpenseSearch || undefined,
      search_fields: debouncedExpenseSearch ? ["description"] : undefined,
    })

  // Track all loaded transactions
  const [allIncomeTransactions, setAllIncomeTransactions] = useState<
    Transaction[]
  >([])
  const [allExpenseTransactions, setAllExpenseTransactions] = useState<
    Transaction[]
  >([])

  // Update all transactions when new data arrives
  useEffect(() => {
    if (incomeTransactions?.items) {
      if (incomePage === 1) {
        setAllIncomeTransactions(incomeTransactions.items)
      } else {
        setAllIncomeTransactions(prev => [...prev, ...incomeTransactions.items])
      }
      setHasMoreIncomes(incomeTransactions.total > incomePage * 20)
      setIsLoadingMoreIncomes(false)
    }
  }, [incomeTransactions, incomePage])

  useEffect(() => {
    if (expenseTransactions?.items) {
      if (expensePage === 1) {
        setAllExpenseTransactions(expenseTransactions.items)
      } else {
        setAllExpenseTransactions(prev => [
          ...prev,
          ...expenseTransactions.items,
        ])
      }
      setHasMoreExpenses(expenseTransactions.total > expensePage * 20)
      setIsLoadingMoreExpenses(false)
    }
  }, [expenseTransactions, expensePage])

  // Reset pagination when search changes
  useEffect(() => {
    setIncomePage(1)
    setAllIncomeTransactions([])
    setHasMoreIncomes(true)
  }, [debouncedIncomeSearch])

  useEffect(() => {
    setExpensePage(1)
    setAllExpenseTransactions([])
    setHasMoreExpenses(true)
  }, [debouncedExpenseSearch])

  // Intersection observer setup
  useEffect(() => {
    const incomeObserver = new IntersectionObserver(
      entries => {
        const first = entries[0]
        if (
          first.isIntersecting &&
          hasMoreIncomes &&
          !isLoadingMoreIncomes &&
          step === "incomes"
        ) {
          console.log("Loading more incomes")
          setIsLoadingMoreIncomes(true)
          setIncomePage(prev => prev + 1)
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    )

    const expenseObserver = new IntersectionObserver(
      entries => {
        const first = entries[0]
        if (
          first.isIntersecting &&
          hasMoreExpenses &&
          !isLoadingMoreExpenses &&
          step === "expenses"
        ) {
          console.log("Loading more expenses")
          setIsLoadingMoreExpenses(true)
          setExpensePage(prev => prev + 1)
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    )

    if (incomeLoadMoreRef.current) {
      incomeObserver.observe(incomeLoadMoreRef.current)
    }

    if (expenseLoadMoreRef.current) {
      expenseObserver.observe(expenseLoadMoreRef.current)
    }

    return () => {
      if (incomeLoadMoreRef.current) {
        incomeObserver.unobserve(incomeLoadMoreRef.current)
      }
      if (expenseLoadMoreRef.current) {
        expenseObserver.unobserve(expenseLoadMoreRef.current)
      }
    }
  }, [
    hasMoreIncomes,
    hasMoreExpenses,
    isLoadingMoreIncomes,
    isLoadingMoreExpenses,
    step,
  ])

  // Replace individual transaction queries with a single query for all IDs
  const expenseIds = editMode?.refundItems.map(item => item.expenseId) || []
  const incomeIds = editMode?.refundItems.map(item => item.incomeId) || []
  const allIds = [...expenseIds, ...incomeIds]

  const { data: editTransactions } = useTransactions({
    id: allIds,
    per_page: allIds.length || 1,
  })

  const editExpenses = editTransactions?.items
    .filter(tx => expenseIds.includes(tx.id))
    .filter((tx): tx is Transaction => !!tx)

  const editIncomes = editTransactions?.items
    .filter(tx => incomeIds.includes(tx.id))
    .filter((tx): tx is Transaction => !!tx)

  const createRefundGroup = useCreateRefundGroup()
  const createRefundItem = useCreateRefundItem()
  const deleteRefundItem = useDeleteRefundItem()
  const updateRefundGroup = useUpdateRefundGroup()
  const updateRefundItem = useUpdateRefundItem()

  // Handle selection changes
  const handleSelectionChange = (
    type: "income" | "expense",
    transaction: Transaction,
    isSelected: boolean
  ) => {
    const updateSelections = (prev: Transaction[]) =>
      isSelected
        ? prev.filter(t => t.id !== transaction.id)
        : [...prev, transaction]

    if (type === "income") {
      const newIncomes = updateSelections(selectedIncomes)
      setSelectedIncomes(newIncomes)
      updateAllocations(selectedExpenses, newIncomes)
    } else {
      const newExpenses = updateSelections(selectedExpenses)
      setSelectedExpenses(newExpenses)
      updateAllocations(newExpenses, selectedIncomes)
    }
  }

  // Update allocations based on selections
  const updateAllocations = (
    expenses: Transaction[],
    incomes: Transaction[]
  ) => {
    console.log("updateAllocations called", { expenses, incomes })
    if (!expenses.length || !incomes.length) {
      setAllocations([])
      return
    }

    const newAllocations: AllocationItem[] = []
    expenses.forEach(expense => {
      incomes.forEach(income => {
        newAllocations.push({
          expenseId: expense.id,
          incomeId: income.id,
          amount: 0,
          maxAmount: Math.min(Math.abs(expense.amount), income.amount),
        })
      })
    })
    console.log("Setting new allocations", newAllocations)
    setAllocations(newAllocations)
  }

  // Initialize edit mode
  const initializeEditMode = useCallback(() => {
    if (!editMode || isInitialized) return

    const isLoading = !editTransactions

    if (isLoading) return

    // Find the existing refund group name if it exists
    if (editMode.refundGroupId) {
      // We'll need to fetch the refund group details in a real implementation
      // For now, generate a default name based on the expenses
      const expenseDescriptions = editExpenses
        ?.map(exp => exp.description)
        .filter(Boolean)
        .slice(0, 2) || []

      const defaultName = expenseDescriptions.length > 1
        ? `Multiple Expenses Refund (${expenseDescriptions[0]}, ...)`
        : expenseDescriptions.length === 1
          ? `${expenseDescriptions[0]} Refund`
          : `Refund Group`

      setGroupName(defaultName)
      setGroupDescription(`Refund group for ${editExpenses?.length || 0} expense(s) and ${editIncomes?.length || 0} income(s)`)
    }

    // Create allocations from existing refund items
    const existingAllocations = new Map(
      editMode.refundItems.map(item => [
        `${item.expenseId}-${item.incomeId}`,
        item.amount,
      ])
    )

    const newAllocations: AllocationItem[] = []

    if (editExpenses && editIncomes) {
      editExpenses.forEach(expense => {
        editIncomes.forEach(income => {
          const key = `${expense.id}-${income.id}`
          const maxAmount = Math.min(Math.abs(expense.amount), income.amount)
          newAllocations.push({
            expenseId: expense.id,
            incomeId: income.id,
            // Use existing amount if available, otherwise 0
            amount: existingAllocations.get(key) || 0,
            maxAmount,
          })
        })
      })

      if (newAllocations.length > 0) {
        setSelectedExpenses([...editExpenses])
        setSelectedIncomes([...editIncomes])
        setAllocations(newAllocations)
        setStep("review")
      }
    }

    setIsInitialized(true)
  }, [editMode, isInitialized, editTransactions, editExpenses, editIncomes])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedIncomes([])
      setSelectedExpenses([])
      setAllocations([])
      setGroupName("")
      setGroupDescription("")
      setStep("expenses")
      setIsInitialized(false)
    }
  }, [isOpen])

  // Initialize edit mode when modal opens
  useEffect(() => {
    if (isOpen && editMode && !isInitialized) {
      initializeEditMode()
    }
  }, [isOpen, editMode, isInitialized, initializeEditMode])

  // Calculate remaining amounts
  const getRemainingAmount = (
    transaction: Transaction,
    type: "income" | "expense"
  ) => {
    const allocated = allocations
      .filter(a =>
        type === "income"
          ? a.incomeId === transaction.id
          : a.expenseId === transaction.id
      )
      .reduce((sum, a) => sum + a.amount, 0)
    return type === "income"
      ? transaction.amount - allocated
      : Math.abs(transaction.amount) - allocated
  }

  const handleCreateRefund = async () => {
    try {
      // Only use allocations with amount > 0
      const activeAllocations = allocations.filter(a => a.amount > 0)
      const uniqueExpenseIds = new Set(activeAllocations.map(a => a.expenseId))
      const uniqueIncomeIds = new Set(activeAllocations.map(a => a.incomeId))
      const needsGroup = uniqueExpenseIds.size > 1 || uniqueIncomeIds.size > 1 || editMode?.refundGroupId

      let refundGroupId = editMode?.refundGroupId

      // Handle refund group - create new or update existing
      if (!refundGroupId && needsGroup) {
        // Create a new group
        const expenseDescriptions = Array.from(uniqueExpenseIds)
          .map(id => selectedExpenses.find(e => e.id === id)?.description)
          .filter(Boolean)
          .slice(0, 2)

        const totalAmount = activeAllocations.reduce(
          (sum, a) => sum + a.amount,
          0
        )

        // Use user-provided name or fall back to a generated one
        const defaultGroupName =
          expenseDescriptions.length > 1
            ? `Multiple Expenses Refund (${expenseDescriptions[0]}, ...)`
            : `${expenseDescriptions[0]} Refund`

        const finalGroupName = groupName || defaultGroupName

        // Generate a default description if none provided
        const defaultDescription = `Refund group for ${
          uniqueExpenseIds.size
        } expense(s) and ${
          uniqueIncomeIds.size
        } income(s) totaling $${totalAmount.toFixed(2)}`

        const finalDescription = groupDescription || defaultDescription

        const group = await createRefundGroup.mutateAsync({
          name: finalGroupName,
          description: finalDescription,
        })

        refundGroupId = group.id
      } else if (refundGroupId) {
        // Update existing group if name or description changed
        await updateRefundGroup.mutateAsync({
          id: refundGroupId,
          data: {
            name: groupName,
            description: groupDescription
          }
        })
      }

      if (editMode) {
        // Get existing allocations to compare with new ones
        const existingAllocations = new Map(
          editMode.refundItems.map(item => [
            `${item.expenseId}-${item.incomeId}`,
            {
              id: item.id,
              amount: item.amount
            }
          ])
        )

        // Items to update or create
        for (const allocation of activeAllocations) {
          const key = `${allocation.expenseId}-${allocation.incomeId}`
          const existingItem = existingAllocations.get(key)

          if (existingItem) {
            // Only update if amount has changed
            if (existingItem.amount !== allocation.amount) {
              await updateRefundItem.mutateAsync({
                id: existingItem.id,
                data: {
                  amount: allocation.amount
                }
              })
            }
            // Remove from map to track which ones were processed
            existingAllocations.delete(key)
          } else {
            // Create new refund item
            const expense = selectedExpenses.find(
              e => e.id === allocation.expenseId
            )!
            await createRefundItem.mutateAsync({
              amount: allocation.amount,
              description: `Refund: ${expense.description} (${(
                (allocation.amount / Math.abs(expense.amount)) *
                100
              ).toFixed(1)}%)`,
              expense_transaction_id: allocation.expenseId,
              income_transaction_id: allocation.incomeId,
              refund_group_id: refundGroupId,
            })
          }
        }

        // Delete any remaining items that weren't updated
        for (const [_, item] of existingAllocations.entries()) {
          await deleteRefundItem.mutateAsync(item.id)
        }
      } else {
        // Create new refund items
        for (const allocation of activeAllocations) {
          const expense = selectedExpenses.find(
            e => e.id === allocation.expenseId
          )!
          await createRefundItem.mutateAsync({
            amount: allocation.amount,
            description: `Refund: ${expense.description} (${(
              (allocation.amount / Math.abs(expense.amount)) *
              100
            ).toFixed(1)}%)`,
            expense_transaction_id: allocation.expenseId,
            income_transaction_id: allocation.incomeId,
            refund_group_id: refundGroupId,
          })
        }
      }

      toast({
        title: editMode ? "Success" : "Success",
        description: editMode
          ? "Refund updated successfully"
          : needsGroup
            ? "Refund group created successfully"
            : "Refund created successfully",
        variant: "default",
      })

      onClose()
      setSelectedIncomes([])
      setSelectedExpenses([])
      setAllocations([])
      setGroupName("")
      setGroupDescription("")
      setStep("expenses")
      setIsInitialized(false)
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${
          editMode ? "update" : "create"
        } refund. Please try again.`,
        variant: "destructive",
      })
      console.error("Failed to handle refund:", error)
    }
  }

  const updateAllocation = (
    expenseId: number,
    incomeId: number,
    newAmount: number
  ) => {
    setAllocations(prev => {
      // throw new Error('Debug')
      const allocation = prev.find(
        a => a.expenseId === expenseId && a.incomeId === incomeId
      )
      if (!allocation) return prev

      // Calculate how much we can allocate based on remaining amounts
      const currentAllocation = allocation.amount
      const expenseRemaining =
        getRemainingAmount(
          selectedExpenses.find(e => e.id === expenseId)!,
          "expense"
        ) + currentAllocation
      const incomeRemaining =
        getRemainingAmount(
          selectedIncomes.find(i => i.id === incomeId)!,
          "income"
        ) + currentAllocation

      const maxPossible = Math.min(
        expenseRemaining,
        incomeRemaining,
        allocation.maxAmount
      )

      return prev.map(a =>
        a.expenseId === expenseId && a.incomeId === incomeId
          ? { ...a, amount: Math.min(newAmount, maxPossible) }
          : a
      )
    })
  }

  const isValid = () => {
    if (!selectedIncomes.length || !selectedExpenses.length) return false

    // Check if any allocations have an amount > 0
    const hasPositiveAllocations = allocations.some(a => a.amount > 0);

    // Check if a group name is required and provided
    const needsGroup = selectedExpenses.length > 1 || selectedIncomes.length > 1 || editMode?.refundGroupId;
    const hasValidGroupName = !needsGroup || (groupName && groupName.trim().length > 0);

    return hasPositiveAllocations && hasValidGroupName;
  }

  const getTotalRefundAmount = () => {
    return allocations.reduce((sum, a) => sum + a.amount, 0)
  }

  console.log("allocations", allocations)
  const getStepContent = () => {
    switch (step) {
      case "expenses":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    Select Expenses to Refund
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Choose the expenses you want to get refunded
                  </p>
                </div>
                {selectedExpenses.length > 0 && (
                  <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                    {selectedExpenses.length} selected
                  </div>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search expenses..."
                  value={expenseSearch}
                  onChange={e => setExpenseSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="h-[400px] overflow-y-auto rounded-lg border bg-white expense-container">
                {isLoadingExpenses && expensePage === 1 ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : allExpenseTransactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <div className="text-sm font-medium text-gray-900">
                      No expenses found
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Try adjusting your search
                    </div>
                  </div>
                ) : (
                  <div className="divide-y">
                    {allExpenseTransactions.map((transaction, index) => {
                      const isSelected = selectedExpenses.some(
                        t => t.id === transaction.id
                      )
                      return (
                        <div
                          key={`${transaction.id}-${index}`}
                          className={`p-4 cursor-pointer transition-all hover:bg-gray-50 ${
                            isSelected ? "bg-primary/5 hover:bg-primary/10" : ""
                          }`}
                          onClick={() => {
                            handleSelectionChange(
                              "expense",
                              transaction,
                              isSelected
                            )
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                isSelected
                                  ? "border-primary bg-primary text-white"
                                  : "border-gray-300"
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {transaction.description}
                              </div>
                              <div className="text-sm text-gray-500 mt-0.5">
                                {new Date(
                                  transaction.date
                                ).toLocaleDateString()}
                              </div>
                              {transaction.refund_items && transaction.refund_items.length > 0 && (
                                <div className="text-xs text-amber-600 mt-0.5">
                                  {transaction.refund_items.length} refund(s) associated
                                </div>
                              )}
                            </div>
                            <div className="text-lg font-semibold text-red-600 shrink-0 flex flex-col items-end">
                              {transaction.refunded_amount > 0 ? (
                                <>
                                  <span className="line-through text-gray-500 text-sm">
                                    ${Math.abs(transaction.amount).toFixed(2)}
                                  </span>
                                  <span>
                                    ${Math.abs(transaction.amount - transaction.refunded_amount).toFixed(2)}
                                  </span>
                                </>
                              ) : (
                                <span>${Math.abs(transaction.amount).toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {hasMoreExpenses && (
                      <div
                        ref={expenseLoadMoreRef}
                        className="p-4 flex justify-center"
                      >
                        {isLoadingMoreExpenses ? (
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsLoadingMoreExpenses(true);
                              setExpensePage(prev => prev + 1);
                            }}
                          >
                            Load More
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      case "incomes":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    Select Refund Sources
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Choose the income transactions that represent your refunds
                  </p>
                </div>
                {selectedIncomes.length > 0 && (
                  <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                    {selectedIncomes.length} selected
                  </div>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search incomes..."
                  value={incomeSearch}
                  onChange={e => setIncomeSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="h-[400px] overflow-y-auto rounded-lg border bg-white income-container">
                {isLoadingIncomes && incomePage === 1 ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : allIncomeTransactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <div className="text-sm font-medium text-gray-900">
                      No incomes found
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Try adjusting your search
                    </div>
                  </div>
                ) : (
                  <div className="divide-y">
                    {allIncomeTransactions.map((transaction, index) => {
                      const isSelected = selectedIncomes.some(
                        t => t.id === transaction.id
                      )
                      return (
                        <div
                          key={`${transaction.id}-${index}`}
                          className={`p-4 cursor-pointer transition-all hover:bg-gray-50 ${
                            isSelected ? "bg-primary/5 hover:bg-primary/10" : ""
                          }`}
                          onClick={() => {
                            handleSelectionChange(
                              "income",
                              transaction,
                              isSelected
                            )
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                isSelected
                                  ? "border-primary bg-primary text-white"
                                  : "border-gray-300"
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {transaction.description}
                              </div>
                              <div className="text-sm text-gray-500 mt-0.5">
                                {new Date(
                                  transaction.date
                                ).toLocaleDateString()}
                              </div>
                              {transaction.refund_items && transaction.refund_items.length > 0 && (
                                <div className="text-xs text-amber-600 mt-0.5">
                                  Used in {transaction.refund_items.length} refund(s)
                                </div>
                              )}
                            </div>
                            <div className="text-lg font-semibold text-green-600 shrink-0">
                              ${transaction.amount.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {hasMoreIncomes && (
                      <div
                        ref={incomeLoadMoreRef}
                        className="p-4 flex justify-center"
                      >
                        {isLoadingMoreIncomes ? (
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsLoadingMoreIncomes(true);
                              setIncomePage(prev => prev + 1);
                            }}
                          >
                            Load More
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      case "allocations":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Allocate Refund Amounts</h3>
              <p className="text-sm text-gray-500 mt-1">
                Specify how much of each expense was refunded by each income
              </p>
            </div>
            <div className="rounded-lg border bg-white divide-y">
              {selectedExpenses.map((expense, index) => (
                <div key={`${expense.id}-${index}`} className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{expense.description}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(expense.date).toLocaleDateString()}
                      </div>
                      {expense.refunded_amount > 0 && (
                        <div className="text-xs text-amber-600 mt-1">
                          Already has ${expense.refunded_amount.toFixed(2)} in existing refunds
                        </div>
                      )}
                    </div>
                    <div className="text-lg font-semibold text-red-600">
                      {expense.refunded_amount > 0 ? (
                        <>
                          <span className="line-through text-gray-500 text-sm mr-2">
                            ${Math.abs(expense.amount).toFixed(2)}
                          </span>
                          ${Math.abs(expense.amount - expense.refunded_amount).toFixed(2)}
                        </>
                      ) : (
                        <>${Math.abs(expense.amount).toFixed(2)}</>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {selectedIncomes.map((income, index) => {
                      const allocation = allocations.find(
                        a =>
                          a.expenseId === expense.id && a.incomeId === income.id
                      )
                      if (!allocation) return null

                      return (
                        <div
                          key={`${income.id}-${index}`}
                          className="bg-gray-50 rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <div className="font-medium">
                              {income.description}
                            </div>
                            <div className="text-green-600">
                              ${income.amount.toFixed(2)}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-500">
                                Refund Amount
                              </span>
                              <div className="flex items-center gap-2">
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                                    $
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={allocation.maxAmount}
                                    step="0.01"
                                    value={allocation.amount}
                                    onChange={e => {
                                      const value = parseFloat(e.target.value)
                                      if (!isNaN(value)) {
                                        updateAllocation(
                                          expense.id,
                                          income.id,
                                          Math.min(value, allocation.maxAmount)
                                        )
                                      }
                                    }}
                                    className="w-24 pl-6 h-7 rounded-md border border-gray-200 text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                  />
                                </div>
                                <span className="text-gray-400">
                                  of ${allocation.maxAmount.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max={allocation.maxAmount}
                              step="0.01"
                              value={allocation.amount}
                              onChange={e =>
                                updateAllocation(
                                  expense.id,
                                  income.id,
                                  parseFloat(e.target.value)
                                )
                              }
                              className="w-full h-2 rounded-full appearance-none cursor-pointer
                                bg-gradient-to-r from-primary to-primary bg-[length:var(--progress)] bg-no-repeat
                                [background-color:hsl(var(--primary)/.1)]
                                [--progress:calc(100%*var(--value)/var(--max))]
                                [--max:attr(max)]
                                [--value:attr(value)]
                                [&::-webkit-slider-thumb]:appearance-none
                                [&::-webkit-slider-thumb]:w-4
                                [&::-webkit-slider-thumb]:h-4
                                [&::-webkit-slider-thumb]:rounded-full
                                [&::-webkit-slider-thumb]:bg-primary
                                [&::-webkit-slider-thumb]:shadow-sm
                                [&::-webkit-slider-thumb]:ring-2
                                [&::-webkit-slider-thumb]:ring-white
                                [&::-webkit-slider-thumb]:transition-all
                                [&::-webkit-slider-thumb]:hover:scale-110
                                [&::-webkit-slider-thumb]:active:scale-95"
                              style={
                                {
                                  "--value": allocation.amount,
                                  "--max": allocation.maxAmount,
                                } as React.CSSProperties
                              }
                            />
                            <div className="flex justify-between text-xs text-gray-400">
                              <span>$0</span>
                              <span>${allocation.maxAmount.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case "review":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Review Refund Details</h3>
              <p className="text-sm text-gray-500 mt-1">
                Review and confirm your refund allocations before creating
              </p>
            </div>

            {/* Group Name Configuration */}
            {(editMode?.refundGroupId || selectedExpenses.length > 1 || selectedIncomes.length > 1) && (
              <div className="rounded-lg border bg-white p-4 space-y-4">
                <div className="text-sm font-medium text-gray-500">
                  Refund Group Configuration
                </div>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="group-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Group Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="group-name"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Enter a name for this refund group"
                      className={`w-full ${!groupName.trim() ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                    />
                    {!groupName.trim() && (
                      <p className="mt-1 text-sm text-red-600">Group name is required</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="group-description" className="block text-sm font-medium text-gray-700 mb-1">
                      Description (Optional)
                    </label>
                    <Input
                      id="group-description"
                      value={groupDescription}
                      onChange={(e) => setGroupDescription(e.target.value)}
                      placeholder="Enter an optional description"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border bg-white divide-y">
              <div className="p-4">
                <div className="text-sm font-medium text-gray-500 mb-2">
                  Summary
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-gray-500">Total Expenses</div>
                    <div className="text-lg font-semibold text-red-600">
                      $
                      {selectedExpenses
                        .reduce((sum, e) => sum + Math.abs(e.amount), 0)
                        .toFixed(2)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-gray-500">Total Refunds</div>
                    <div className="text-lg font-semibold text-green-600">
                      ${getTotalRefundAmount().toFixed(2)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-gray-500">
                      Refund Percentage
                    </div>
                    <div className="text-lg font-semibold">
                      {(
                        (getTotalRefundAmount() /
                          selectedExpenses.reduce(
                            (sum, e) => sum + Math.abs(e.amount),
                            0
                          )) *
                        100
                      ).toFixed(1)}
                      %
                    </div>
                  </div>
                </div>
              </div>
              {selectedExpenses.map((expense, index) => {
                const expenseAllocations = allocations.filter(
                  a => a.expenseId === expense.id && a.amount > 0
                )
                const totalRefunded = expenseAllocations.reduce(
                  (sum, a) => sum + a.amount,
                  0
                )

                return (
                  <div key={`${expense.id}-${index}`} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium">{expense.description}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(expense.date).toLocaleDateString()}
                        </div>
                        {expense.refunded_amount > 0 && expense.refunded_amount !== totalRefunded && (
                          <div className="text-xs text-amber-600">
                            Already has ${expense.refunded_amount.toFixed(2)} in other refunds
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        {expense.refunded_amount > 0 && expense.refunded_amount !== totalRefunded ? (
                          <>
                            <div className="text-lg font-semibold text-red-600">
                              <span className="line-through text-gray-500 text-sm mr-2">
                                ${Math.abs(expense.amount).toFixed(2)}
                              </span>
                              ${Math.abs(expense.amount - expense.refunded_amount).toFixed(2)}
                            </div>
                            <div className="text-sm text-green-600">
                              ${totalRefunded.toFixed(2)} new refund
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-lg font-semibold text-red-600">
                              ${Math.abs(expense.amount).toFixed(2)}
                            </div>
                            <div className="text-sm text-green-600">
                              ${totalRefunded.toFixed(2)} refunded
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {expenseAllocations.map((allocation, index) => {
                      const income = selectedIncomes.find(
                        i => i.id === allocation.incomeId
                      )!
                      return (
                        <div
                          key={`${allocation.incomeId}-${index}`}
                          className="ml-4 flex items-center gap-2 text-sm"
                        >
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">
                            {income.description}:
                          </span>
                          <span className="font-medium">
                            ${allocation.amount.toFixed(2)}
                          </span>
                          <span className="text-gray-400">
                            (
                            {(
                              (allocation.amount / Math.abs(expense.amount)) *
                              100
                            ).toFixed(1)}
                            %)
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )
    }
  }

  const canGoNext = () => {
    switch (step) {
      case "expenses":
        return selectedExpenses.length > 0
      case "incomes":
        return selectedIncomes.length > 0
      case "allocations":
        return allocations.some(a => a.amount > 0)
      case "review":
        return true
    }
  }

  const getNextStep = (): Step => {
    switch (step) {
      case "expenses":
        return "incomes"
      case "incomes":
        return "allocations"
      case "allocations":
        return "review"
      case "review":
        return "review"
    }
  }

  const getPrevStep = (): Step => {
    switch (step) {
      case "expenses":
        return "expenses"
      case "incomes":
        return "expenses"
      case "allocations":
        return "incomes"
      case "review":
        return "allocations"
    }
  }

  const dialogTitle = editMode ? "Edit Refund" : "Create Refund"

  // Add useEffect to log state changes
  useEffect(() => {
    console.log("State updated", {
      step,
      selectedIncomes: selectedIncomes.map(i => i.id),
      selectedExpenses: selectedExpenses.map(e => e.id),
      allocations: allocations.map(a => ({
        expenseId: a.expenseId,
        incomeId: a.incomeId,
        amount: a.amount,
      })),
    })
  }, [step, selectedIncomes, selectedExpenses, allocations])

  // Generate a default group name based on selected transactions
  useEffect(() => {
    // Don't update if the user has manually entered a name or if we're in edit mode
    if (groupName || (editMode?.refundGroupId && isInitialized)) return;

    if (selectedExpenses.length > 0) {
      const expenseDescriptions = selectedExpenses
        .map(exp => exp.description)
        .slice(0, 2);

      if (expenseDescriptions.length > 1) {
        setGroupName(`Multiple Expenses (${expenseDescriptions[0]}, ...)`);
      } else if (expenseDescriptions.length === 1) {
        setGroupName(`${expenseDescriptions[0]} Refund`);
      }

      // Set a default description too
      const totalExpenseAmount = selectedExpenses.reduce(
        (sum, exp) => sum + Math.abs(exp.amount),
        0
      );

      setGroupDescription(
        `Refund group for ${selectedExpenses.length} expense(s) ` +
        `totaling $${totalExpenseAmount.toFixed(2)}`
      );
    }
  }, [selectedExpenses, groupName, editMode?.refundGroupId, isInitialized]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] min-h-[90vh] flex flex-col p-0">
        <DialogTitle className="sr-only">{dialogTitle}</DialogTitle>
        <DialogDescription className="sr-only">
          {step === "expenses"
            ? "Select expenses to refund"
            : step === "incomes"
              ? "Select income sources for refund"
              : step === "allocations"
                ? "Allocate refund amounts"
                : "Review refund details"}
        </DialogDescription>
        <div className="px-8 py-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{dialogTitle}</h2>
            <div className="flex items-center gap-2">
              {(["expenses", "incomes", "allocations", "review"] as Step[]).map(
                (s, i) => (
                  <React.Fragment key={s}>
                    {i > 0 && (
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    )}
                    <button
                      onClick={() => {
                        if (s === "review" && !isValid()) return
                        setStep(s)
                      }}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        step === s
                          ? "bg-primary text-white"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  </React.Fragment>
                )
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8">{getStepContent()}</div>

        <div className="px-8 py-4 border-t bg-gray-50">
          <div className="flex justify-between">
            <Button
              onClick={() => setStep(getPrevStep())}
              variant="ghost"
              disabled={step === "expenses"}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex gap-3">
              <Button onClick={onClose} variant="outline">
                Cancel
              </Button>
              {step === "review" ? (
                <Button
                  onClick={handleCreateRefund}
                  disabled={!isValid() || createRefundItem.isPending}
                  className="min-w-[100px]"
                >
                  {createRefundItem.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editMode ? (
                    "Update Refund"
                  ) : (
                    "Create Refund"
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => setStep(getNextStep())}
                  disabled={!canGoNext()}
                  className="gap-2"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
