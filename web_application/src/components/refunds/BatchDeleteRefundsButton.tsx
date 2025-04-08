import { useBatchDeleteRefundGroups, useBatchDeleteRefundItems } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { RefundGroup, RefundItem } from "@/types";
import { Trash } from "lucide-react";
import { useState } from "react";
import { BatchDeleteDialog } from "../common/BatchDeleteDialog";

// Match the backend response format
interface BatchDeleteResponse {
  successful: number[];
  failed: Array<{
    id: number;
    error: string;
  }>;
  total_successful: number;
  total_failed: number;
}

interface BatchDeleteRefundsButtonProps {
  selectedRefundGroups?: RefundGroup[];
  selectedRefundItems?: RefundItem[];
  onSuccess?: (result: BatchDeleteResponse) => void;
  disabled?: boolean;
}

export function BatchDeleteRefundsButton({
  selectedRefundGroups = [],
  selectedRefundItems = [],
  onSuccess,
  disabled = false
}: BatchDeleteRefundsButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const batchDeleteGroups = useBatchDeleteRefundGroups();
  const batchDeleteItems = useBatchDeleteRefundItems();

  const hasSelectedGroups = selectedRefundGroups.length > 0;
  const hasSelectedItems = selectedRefundItems.length > 0;
  const totalSelected = selectedRefundGroups.length + selectedRefundItems.length;

  // Determine which batch delete to use based on selection
  const currentBatchDelete = hasSelectedGroups ? batchDeleteGroups : batchDeleteItems;
  const itemsToDelete = hasSelectedGroups ? selectedRefundGroups : selectedRefundItems;

  // No need to show if nothing is selected
  if (totalSelected === 0) {
    return null;
  }

  const getTitle = () => {
    if (hasSelectedGroups && hasSelectedItems) {
      return "Delete Selected Refunds";
    } else if (hasSelectedGroups) {
      return "Delete Selected Refund Groups";
    } else {
      return "Delete Selected Refunds";
    }
  };

  const getDescription = () => {
    if (hasSelectedGroups && hasSelectedItems) {
      return `You are about to delete ${selectedRefundGroups.length} refund groups and ${selectedRefundItems.length} individual refunds. This action cannot be undone.`;
    } else if (hasSelectedGroups) {
      return `You are about to delete ${selectedRefundGroups.length} refund groups. This will delete all refunds in these groups. This action cannot be undone.`;
    } else {
      return `You are about to delete ${selectedRefundItems.length} refunds. This action cannot be undone.`;
    }
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
        disabled={disabled || currentBatchDelete.isPending}
      >
        <Trash className="w-4 h-4 mr-2" />
        Delete {totalSelected > 1 ? `(${totalSelected})` : ""}
      </Button>

      <BatchDeleteDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={getTitle()}
        description={getDescription()}
        itemsToDelete={itemsToDelete}
        itemDisplayField={hasSelectedGroups ? "name" : "id"}
        deleteMutation={currentBatchDelete}
        onSuccess={handleSuccess}
      />
    </>
  );
}
