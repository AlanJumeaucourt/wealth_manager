import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface TransactionDialogProps {
  category: string
  isOpen?: boolean
  onClose?: () => void
}

export function TransactionDialog({
  category,
  isOpen = false,
  onClose,
}: TransactionDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogHeader>
        <DialogTitle>Transactions for {category}</DialogTitle>
      </DialogHeader>
      <DialogContent>{/* Add your transaction details here */}</DialogContent>
    </Dialog>
  )
}

export default TransactionDialog
