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
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

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

export interface BatchDeleteDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  itemsToDelete: T[];
  itemDisplayField?: keyof T;
  itemIdField?: keyof T;
  deleteMutation: {
    mutate: (ids: number[]) => void;
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    data?: BatchDeleteResponse;
  };
  onSuccess?: (result: BatchDeleteResponse) => void;
}

export function BatchDeleteDialog<T extends { id?: number }>({
  open,
  onOpenChange,
  title,
  description,
  itemsToDelete,
  itemDisplayField = "name" as keyof T,
  itemIdField = "id" as keyof T,
  deleteMutation,
  onSuccess,
}: BatchDeleteDialogProps<T>) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setIsDeleting(false);
    }
  }, [open]);

  // Monitor deletion state
  useEffect(() => {
    if (!isDeleting || deleteMutation.isPending) return;

    // Check if deletion is complete
    if (!deleteMutation.isPending) {
      if (deleteMutation.isError) {
        toast({
          title: "Error",
          description: `Failed to delete items: ${deleteMutation.error?.message || "Unknown error"}`,
          variant: "destructive",
        });
        setIsDeleting(false);
      } else if (deleteMutation.data) {
        const result = deleteMutation.data;

        // Check if all operations were successful
        if (result.total_successful > 0 && result.total_failed === 0) {
          toast({
            title: "Items deleted",
            description: `Successfully deleted ${result.total_successful} items.`,
          });
          if (onSuccess) {
            onSuccess(result);
          }
          onOpenChange(false);
        }
        // Partial success
        else if (result.total_successful > 0 && result.total_failed > 0) {
          toast({
            title: "Partial success",
            description: `Deleted ${result.total_successful} items, but ${result.total_failed} failed.`,
            variant: "destructive",
          });
          if (onSuccess) {
            onSuccess(result);
          }
          onOpenChange(false);
        }
        // Complete failure
        else if (result.total_successful === 0 && result.total_failed > 0) {
          const firstError = result.failed[0]?.error || "Unknown error";
          toast({
            title: "Failed to delete items",
            description: `Error: ${firstError}`,
            variant: "destructive",
          });
          setIsDeleting(false);
        }
        // Unexpected response
        else {
          toast({
            title: "Unexpected response",
            description: "The server returned an unexpected response.",
            variant: "destructive",
          });
          setIsDeleting(false);
        }
      }
    }
  }, [deleteMutation.isPending, deleteMutation.isError, deleteMutation.data, isDeleting, toast, onOpenChange, onSuccess, itemsToDelete.length]);

  const handleDelete = () => {
    if (isDeleting || deleteMutation.isPending) return;

    // Extract IDs from items
    const ids = itemsToDelete
      .map(item => Number(item[itemIdField]))
      .filter(id => !isNaN(id));

    if (ids.length === 0) {
      toast({
        title: "Error",
        description: "No valid items to delete",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    deleteMutation.mutate(ids);
  };

  const itemCount = itemsToDelete.length;
  const itemNames = itemsToDelete
    .map(item => String(item[itemDisplayField] || `Item ${item[itemIdField]}`))
    .slice(0, 3)
    .join(", ");

  const displayNames = itemCount <= 3
    ? itemNames
    : `${itemNames}, and ${itemCount - 3} more`;

  return (
    <Dialog open={open} onOpenChange={isDeleting ? undefined : onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-red-500">
            🗑️ {title}
          </DialogTitle>
          <DialogDescription className="pt-4">
            <div className="text-red-500 font-medium mb-2">
              {description}
            </div>
            {itemCount > 0 && (
              <div className="text-sm text-muted-foreground mb-2">
                Items to delete: {displayNames}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || deleteMutation.isPending || itemsToDelete.length === 0}
          >
            {isDeleting || deleteMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              `Delete ${itemCount} ${itemCount === 1 ? 'Item' : 'Items'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
