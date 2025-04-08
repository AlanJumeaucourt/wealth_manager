import { useDeleteRefundGroup, useDeleteRefundItem } from "@/api/queries"
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
import { RefundGroup, RefundItem } from "@/types"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

interface DeleteRefundDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  refundGroup?: RefundGroup
  refundItem?: RefundItem
}

export function DeleteRefundDialog({
  open,
  onOpenChange,
  refundGroup,
  refundItem,
}: DeleteRefundDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  // Get mutation hooks with direct access to their states
  const deleteRefundGroupMutation = useDeleteRefundGroup()
  const deleteRefundItemMutation = useDeleteRefundItem()

  // Reset deleting state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setIsDeleting(false)
    }
  }, [open])

  // Watch mutation states to detect completion
  useEffect(() => {
    // Only check if we're in deleting state
    if (!isDeleting) return

    const isGroupDeleting = deleteRefundGroupMutation.isPending
    const isItemDeleting = deleteRefundItemMutation.isPending

    // If we were deleting and both mutations are no longer pending
    if (!isGroupDeleting && !isItemDeleting) {
      const groupError = deleteRefundGroupMutation.error
      const itemError = deleteRefundItemMutation.error

      // Check for errors
      if (groupError || itemError) {
        console.error("Deletion error:", groupError || itemError)
        toast({
          title: "Error",
          description: "Failed to delete the refund. Please try again.",
          variant: "destructive",
        })
        setIsDeleting(false)
      } else {
        // No errors, successfully deleted
        if (refundGroup) {
          toast({
            title: "Refund group deleted",
            description: `Successfully deleted "${refundGroup.name}"`,
          })
        } else if (refundItem) {
          toast({
            title: "Refund deleted",
            description: "Successfully deleted the refund",
          })
        }
        // Close dialog after successful deletion
        onOpenChange(false)
      }
    }
  }, [
    isDeleting,
    deleteRefundGroupMutation.isPending,
    deleteRefundItemMutation.isPending,
    deleteRefundGroupMutation.error,
    deleteRefundItemMutation.error,
    refundGroup,
    refundItem,
    toast,
    onOpenChange
  ])

  const handleDelete = async () => {
    if (isDeleting) return

    setIsDeleting(true)

    try {
      if (refundGroup && refundGroup.id) {
        console.log("Deleting refund group with ID:", refundGroup.id)
        deleteRefundGroupMutation.mutate(refundGroup.id)
      } else if (refundItem && refundItem.id) {
        console.log("Deleting refund item with ID:", refundItem.id)
        deleteRefundItemMutation.mutate(refundItem.id)
      } else {
        console.error("Nothing to delete: no valid refund group or item provided")
        setIsDeleting(false)
        toast({
          title: "Error",
          description: "Nothing to delete. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error triggering deletion:", error)
      setIsDeleting(false)
      toast({
        title: "Error",
        description: "Failed to start deletion process. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={isDeleting ? undefined : onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-red-500">
            🗑️ Delete {refundGroup ? "Refund Group" : "Refund"}
          </DialogTitle>
          <DialogDescription className="pt-4">
            {refundGroup ? (
              <>
                <div className="text-red-500 font-medium mb-2">
                  You are about to delete the refund group "{refundGroup.name}".
                  This will delete all refunds in this group.
                </div>
                {refundGroup.description && (
                  <div className="text-sm text-muted-foreground mb-2">
                    {refundGroup.description}
                  </div>
                )}
              </>
            ) : (
              <div className="text-red-500 font-medium">
                You are about to delete this refund. This action cannot be
                undone.
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
            disabled={isDeleting || deleteRefundGroupMutation.isPending || deleteRefundItemMutation.isPending}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
