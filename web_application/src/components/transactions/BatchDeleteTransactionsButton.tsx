import { useBatchDeleteTransactions } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { Transaction } from "@/types";
import { Trash } from "lucide-react";
import { useState } from "react";
import { BatchDeleteDialog } from "../common/BatchDeleteDialog";

// Match the backend response format
export interface BatchDeleteResponse {
  successful: number[];
  failed: Array<{
    id: number;
    error: string;
  }>;
  total_successful: number;
  total_failed: number;
}

interface BatchDeleteTransactionsButtonProps {
  selectedTransactions: Transaction[];
  onSuccess?: (result: BatchDeleteResponse) => void;
  disabled?: boolean;
}

export function BatchDeleteTransactionsButton({
  selectedTransactions = [],
  onSuccess,
  disabled = false
}: BatchDeleteTransactionsButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const batchDeleteTransactions = useBatchDeleteTransactions();

  const totalSelected = selectedTransactions.length;

  // No need to show if nothing is selected
  if (totalSelected === 0) {
    return null;
  }

  const getTitle = () => {
    return "Delete Selected Transactions";
  };

  const getDescription = () => {
    return `You are about to delete ${totalSelected} transaction${totalSelected !== 1 ? 's' : ''}. This action cannot be undone.`;
  };

  const handleBatchDelete = () => {
    setIsDialogOpen(true);
  };

  const handleSuccess = (result: BatchDeleteResponse) => {
    console.log("Batch delete result:", result);
    if (onSuccess) {
      onSuccess(result);
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleBatchDelete}
        disabled={disabled || batchDeleteTransactions.isPending}
      >
        <Trash className="w-4 h-4 mr-2" />
        Delete {totalSelected > 1 ? `(${totalSelected})` : ""}
      </Button>

      <BatchDeleteDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={getTitle()}
        description={getDescription()}
        itemsToDelete={selectedTransactions}
        itemDisplayField="description"
        deleteMutation={batchDeleteTransactions}
        onSuccess={handleSuccess}
      />
    </>
  );
}
