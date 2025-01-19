import { Transaction } from "@/types"
import { useCallback, useState } from "react"

export function useDeleteTransactionDialog() {
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const openDialog = useCallback((transaction: Transaction) => {
    setDeletingTransaction(transaction)
    setIsOpen(true)
  }, [])

  const closeDialog = useCallback(() => {
    setIsOpen(false)
    setDeletingTransaction(null)
  }, [])

  return {
    deletingTransaction,
    isOpen,
    openDialog,
    closeDialog
  }
}
