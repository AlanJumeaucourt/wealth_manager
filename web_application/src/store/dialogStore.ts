import { Transaction } from "@/types"
import { create } from "zustand"

interface DialogState {
  deleteTransaction: Transaction | null
  setDeleteTransaction: (transaction: Transaction | null) => void
  editTransaction: Transaction | null
  setEditTransaction: (transaction: Transaction | null) => void
  isAddTransactionOpen: boolean
  setIsAddTransactionOpen: (isOpen: boolean) => void
  addTransactionDefaultType: string
  setAddTransactionDefaultType: (type: string) => void
}

export const useDialogStore = create<DialogState>(set => ({
  deleteTransaction: null,
  setDeleteTransaction: transaction => set({ deleteTransaction: transaction }),
  editTransaction: null,
  setEditTransaction: transaction => set({ editTransaction: transaction }),
  isAddTransactionOpen: false,
  setIsAddTransactionOpen: isOpen => set({ isAddTransactionOpen: isOpen }),
  addTransactionDefaultType: "expense",
  setAddTransactionDefaultType: type => set({ addTransactionDefaultType: type }),
}))
