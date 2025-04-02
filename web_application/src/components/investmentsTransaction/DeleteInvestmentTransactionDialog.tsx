import { useDeleteInvestment } from "@/api/queries"
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
import { Investment } from "@/types"
import { useNavigate } from "@tanstack/react-router"

interface DeleteInvestmentDialogProps {
  investment: Investment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  redirectTo?: string
}

export function DeleteInvestmentDialog({
  investment,
  open,
  onOpenChange,
  redirectTo = "/investments",
}: DeleteInvestmentDialogProps) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const deleteMutation = useDeleteInvestment()

  if (!investment || !investment.transaction_id) return null

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(investment.transaction_id)
      toast({
        title: "Investment Deleted",
        description: "The investment has been successfully deleted.",
      })
      onOpenChange(false)
      if (redirectTo) {
        navigate({
          to: redirectTo as any,
          params: {},
          search: {},
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete investment. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="..."
        aria-describedby="delete-investment-description"
      >
        <DialogHeader>
          <DialogTitle>Delete Investment</DialogTitle>
          <div id="delete-investment-description" className="...">
            <DialogDescription>
              Are you sure you want to delete this investment? This action
              cannot be undone.
              <div className="mt-2 text-sm">
                <p>
                  <strong>Type:</strong> {investment.investment_type}
                </p>
                <p>
                  <strong>Quantity:</strong>{" "}
                  {investment.quantity.toLocaleString()}
                </p>
                <p>
                  <strong>Unit Price:</strong>{" "}
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "EUR",
                  }).format(investment.unit_price)}
                </p>
                <p>
                  <strong>Total:</strong>{" "}
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "EUR",
                  }).format(investment.total_paid || 0)}
                </p>
                <p>
                  <strong>Date:</strong>{" "}
                  {new Date(investment.date).toLocaleDateString()}
                </p>
              </div>
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete Investment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
