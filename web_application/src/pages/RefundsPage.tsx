import { useRefundGroups, useRefundItems } from "@/api/queries"
import { PageContainer } from "@/components/layout/PageContainer"
import { CreateRefundModal } from "@/components/refunds/CreateRefundModal"
import { DeleteRefundDialog } from "@/components/refunds/DeleteRefundDialog"
import { RefundsList } from "@/components/refunds/RefundsList"
import { Button } from "@/components/ui/button"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { RefundGroup, RefundItem } from "@/types"
import { Loader2, Plus } from "lucide-react"
import { useEffect, useState } from "react"

export function RefundsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [deletingRefundGroup, setDeletingRefundGroup] =
    useState<RefundGroup | null>(null)
  const [deletingRefundItem, setDeletingRefundItem] =
    useState<RefundItem | null>(null)

  const { data: refundGroups, isLoading: isLoadingGroups } = useRefundGroups({
    per_page: 100,
  })
  const { data: refundItems, isLoading: isLoadingItems } = useRefundItems({
    per_page: 100,
  })

  // Log the deletion state
  useEffect(() => {
    console.log("Deletion state changed:", {
      deletingRefundGroup,
      deletingRefundItem,
      deleteDialogOpen: !!deletingRefundGroup || !!deletingRefundItem,
    })
  }, [deletingRefundGroup, deletingRefundItem])

  const isLoading = isLoadingGroups || isLoadingItems
  const hasRefunds =
    (refundGroups?.items.length || 0) > 0 ||
    (refundItems?.items.length || 0) > 0

  const handleDeleteDialogChange = (open: boolean) => {
    console.log("DeleteDialog open changed to:", open)
    if (!open) {
      console.log("Resetting deleting states")
      setDeletingRefundGroup(null)
      setDeletingRefundItem(null)
    }
  }

  useKeyboardShortcuts({
    onNew: () => {
      if (!isCreateModalOpen) {
        setIsCreateModalOpen(true)
      }
    },
    disabled:
      isCreateModalOpen || !!deletingRefundGroup || !!deletingRefundItem,
  })

  return (
    <PageContainer title="Refunds" action={
      <Button onClick={() => setIsCreateModalOpen(true)}>
      <Plus className="w-4 h-4 mr-2" />
      New Refund (N)
    </Button>
    }>
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : !hasRefunds ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">No refunds yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new refund.
          </p>
          <div className="mt-6">
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Refund
            </Button>
          </div>
        </div>
      ) : (
        <RefundsList
          refundGroups={refundGroups?.items || []}
          refundItems={refundItems?.items || []}
          onDeleteRefundGroup={group => {
            console.log("Setting refund group to delete:", group)
            setDeletingRefundGroup(group)
          }}
          onDeleteRefundItem={item => {
            console.log("Setting refund item to delete:", item)
            setDeletingRefundItem(item)
          }}
        />
      )}

      <CreateRefundModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      <DeleteRefundDialog
        open={!!deletingRefundGroup || !!deletingRefundItem}
        onOpenChange={handleDeleteDialogChange}
        refundGroup={deletingRefundGroup || undefined}
        refundItem={deletingRefundItem || undefined}
      />
    </PageContainer>
  )
}
