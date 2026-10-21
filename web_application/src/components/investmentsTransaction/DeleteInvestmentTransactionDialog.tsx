import { useDeleteInvestment } from "@/api/queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { useToast } from "@/hooks/use-toast";
import { Investment } from "@/types";
import { useNavigate } from "@tanstack/react-router";

interface DeleteInvestmentDialogProps {
  investment: Investment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectTo?: string;
}

export function DeleteInvestmentDialog({
  investment,
  open,
  onOpenChange,
  redirectTo = "/investmentTransactions",
}: DeleteInvestmentDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const deleteMutation = useDeleteInvestment();
  const { preferredCurrency } = usePreferredCurrency();
  const curr = preferredCurrency || investment?.preferred_currency || investment?.currency || "EUR";
  const unitPrice = investment?.unit_price_preferred ?? investment?.unit_price ?? 0;
  const totalPaid = investment?.total_paid_preferred ?? investment?.total_paid ?? 0;

  if (!investment || !investment.transaction_id) return null;

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(investment.transaction_id);
      toast({
        title: "Investment Deleted",
        description: "The investment has been successfully deleted.",
      });
      onOpenChange(false);
      if (redirectTo) {
        void navigate({
          to: redirectTo as any,
          params: {},
          search: {},
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete investment. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="..." aria-describedby="delete-investment-description">
        <DialogHeader>
          <DialogTitle>Delete Investment</DialogTitle>
          <div id="delete-investment-description" className="...">
            <DialogDescription>
              Are you sure you want to delete this investment? This action cannot be undone.
              <div className="mt-2 text-sm">
                <p>
                  <strong>Type:</strong> {investment.investment_type}
                </p>
                <p>
                  <strong>Quantity:</strong> {investment.quantity.toLocaleString()}
                </p>
                <p>
                  <strong>Unit Price:</strong>{" "}
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: curr,
                  }).format(unitPrice)}
                </p>
                <p>
                  <strong>Total:</strong>{" "}
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: curr,
                  }).format(totalPaid)}
                </p>
                <p>
                  <strong>Date:</strong> {new Date(investment.date).toLocaleDateString()}
                </p>
              </div>
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? "Deleting..." : "Delete Investment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
