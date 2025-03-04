import { useDeleteRefundGroup, useDeleteRefundItem } from '@/api/queries'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { RefundGroup, RefundItem } from '@/types'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

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
  const deleteRefundGroup = useDeleteRefundGroup()
  const deleteRefundItem = useDeleteRefundItem()

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      if (refundGroup) {
        await deleteRefundGroup.mutateAsync(refundGroup.id!)
        toast({
          title: "Refund group deleted",
          description: `Successfully deleted "${refundGroup.name}"`,
        })
      } else if (refundItem) {
        await deleteRefundItem.mutateAsync(refundItem.id!)
        toast({
          title: "Refund deleted",
          description: "Successfully deleted the refund",
        })
      }
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete the refund. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-red-500">
            🗑️ Delete {refundGroup ? 'Refund Group' : 'Refund'}
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
                You are about to delete this refund. This action cannot be undone.
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
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
