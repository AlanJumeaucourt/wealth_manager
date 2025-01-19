import { useRefundGroups, useRefundItems } from '@/api/queries'
import { CreateRefundModal } from '@/components/refunds/CreateRefundModal'
import { DeleteRefundDialog } from '@/components/refunds/DeleteRefundDialog'
import { RefundsList } from '@/components/refunds/RefundsList'
import { Button } from '@/components/ui/button'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { RefundGroup, RefundItem } from '@/types'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'

export function RefundsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [deletingRefundGroup, setDeletingRefundGroup] = useState<RefundGroup | null>(null)
  const [deletingRefundItem, setDeletingRefundItem] = useState<RefundItem | null>(null)

  const { data: refundGroups, isLoading: isLoadingGroups } = useRefundGroups({ per_page: 100 })
  const { data: refundItems, isLoading: isLoadingItems } = useRefundItems({ per_page: 100 })

  const isLoading = isLoadingGroups || isLoadingItems
  const hasRefunds = (refundGroups?.items.length || 0) > 0 || (refundItems?.items.length || 0) > 0

  useKeyboardShortcuts({
    onKeyDown: (e) => {
      if (e.key === 'n' && !isCreateModalOpen) {
        setIsCreateModalOpen(true)
      }
    },
    disabled: isCreateModalOpen || !!deletingRefundGroup || !!deletingRefundItem,
  })

  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Refunds</h1>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Refund (N)
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : !hasRefunds ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">No refunds yet</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new refund.</p>
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
          onDeleteRefundGroup={setDeletingRefundGroup}
          onDeleteRefundItem={setDeletingRefundItem}
        />
      )}

      <CreateRefundModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      <DeleteRefundDialog
        open={!!deletingRefundGroup || !!deletingRefundItem}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingRefundGroup(null)
            setDeletingRefundItem(null)
          }
        }}
        refundGroup={deletingRefundGroup || undefined}
        refundItem={deletingRefundItem || undefined}
      />
    </div>
  )
}
