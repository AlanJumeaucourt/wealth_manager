import { useDeleteBank } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bank } from "@/types";
import { useState } from "react";

interface DeleteBankDialogProps {
  bank: Bank | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteBankDialog({ bank, open, onOpenChange }: DeleteBankDialogProps) {
  const [confirmName, setConfirmName] = useState("");
  const [acceptRisks, setAcceptRisks] = useState(false);
  const { toast } = useToast();
  const deleteBankMutation = useDeleteBank();

  if (!bank) return null;

  const isConfirmNameValid = confirmName === bank.name;
  const canDelete = isConfirmNameValid && acceptRisks;

  const handleDelete = async () => {
    if (!bank || !canDelete) return;

    try {
      await deleteBankMutation.mutateAsync(bank.id);
      toast({
        title: "🏦 Bank Deleted!",
        description: `Successfully deleted ${bank.name} and all associated data.`,
      });
      onOpenChange(false);
      setConfirmName("");
      setAcceptRisks(false);
    } catch (error) {
      console.error("Failed to delete bank:", error);
      toast({
        title: "😬 Oops!",
        description: "Couldn't delete the bank. It might have linked accounts.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setConfirmName("");
    setAcceptRisks(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-red-500">🏦 Delete Bank: {bank.name}</DialogTitle>
          <DialogDescription className="space-y-3 pt-4">
            <div className="text-red-500 font-medium">This action cannot be undone. This will:</div>
            <ul className="list-disc pl-4 space-y-2 text-muted-foreground">
              <li>Permanently delete the bank &quot;{bank.name}&quot;</li>
              <li>Remove all associated accounts</li>
              <li>Delete all related transactions</li>
              <li>Remove all historical data</li>
            </ul>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>
              Type <span className="font-medium">{bank.name}</span> to confirm:
            </Label>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={`Type ${bank.name} to confirm`}
              className={!isConfirmNameValid && confirmName ? "border-red-500" : ""}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="acceptRisks"
              checked={acceptRisks}
              onCheckedChange={(checked) => setAcceptRisks(checked as boolean)}
            />
            <Label
              htmlFor="acceptRisks"
              className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I understand that this action will delete all associated data and cannot be reversed
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={deleteBankMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || deleteBankMutation.isPending}
            className="gap-2"
          >
            {deleteBankMutation.isPending ? (
              <>
                <span className="animate-spin">⏳</span>
                Deleting...
              </>
            ) : (
              <>🗑️ Delete Bank</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
