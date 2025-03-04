import { useDeleteTransaction } from "@/api/queries"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useDialogStore } from "@/store/dialogStore"
import { useNavigate } from "@tanstack/react-router"
import { memo, useCallback } from "react"

interface DeleteTransactionDialogProps {
  redirectTo?: string
}

export const DeleteTransactionDialog = memo(function DeleteTransactionDialog({
  redirectTo = "/transactions/all"
}: DeleteTransactionDialogProps) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const deleteMutation = useDeleteTransaction()
  const { deleteTransaction: transaction, setDeleteTransaction } = useDialogStore()

  const handleDelete = useCallback(async () => {
    if (!transaction) return

    try {
      await deleteMutation.mutateAsync(transaction.id)
      toast({
        title: "Transaction Deleted",
        description: "The transaction has been successfully deleted.",
      })
      setDeleteTransaction(null)
      if (redirectTo) {
        navigate({
          to: redirectTo as any,
          params: {},
          search: {}
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete transaction. Please try again.",
        variant: "destructive",
      })
    }
  }, [transaction, deleteMutation, toast, setDeleteTransaction, navigate, redirectTo])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setDeleteTransaction(null)
    }
  }, [setDeleteTransaction])

  if (!transaction) return null

  return (
    <Dialog open={!!transaction} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]" aria-describedby="delete-transaction-description">
        <DialogHeader>
          <DialogTitle>Delete Transaction</DialogTitle>
          <div id="delete-transaction-description" className="mt-2">
            <DialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
              <div className="mt-2 text-sm">
                <p><strong>Description:</strong> {transaction.description}</p>
                <p><strong>Amount:</strong> {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'EUR'
                }).format(transaction.amount)}</p>
                <p><strong>Date:</strong> {new Date(transaction.date).toLocaleDateString()}</p>
              </div>
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
