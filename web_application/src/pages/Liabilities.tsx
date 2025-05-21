import { useCreateLiability, useDeleteLiability, useLiabilities, useLiabilityDetails, useLiabilityPayments } from '@/api/queries'
import { PageContainer } from '@/components/layout/PageContainer'
import { LiabilityCard } from '@/components/liabilities/LiabilityCard'
import { LiabilityDashboard } from '@/components/liabilities/LiabilityDashboard'
import { LiabilityForm } from '@/components/liabilities/LiabilityForm'
import { RecordInitialPaymentsDialog } from '@/components/liabilities/RecordInitialPaymentsDialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Liability } from '@/types'
import { useRouter } from '@tanstack/react-router'
import { PlusIcon, SearchIcon } from 'lucide-react'
import { useState } from 'react'

// Placeholder for the new dialog component - to be created in a new file
// const RecordInitialPaymentsDialog = ({ isOpen, onClose, liability, transactions }) => { ... };

export default function LiabilitiesPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDirection, setFilterDirection] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [liabilityToDelete, setLiabilityToDelete] = useState<Liability | null>(null)

  // State for the second step of adding a liability
  const [showRecordInitialPaymentsDialog, setShowRecordInitialPaymentsDialog] = useState(false)
  const [liabilityForInitialPayment, setLiabilityForInitialPayment] = useState<Liability | null>(null)
  // Transactions will be fetched within the RecordInitialPaymentsDialog

  // Fetch liabilities with details
  const { data: liabilitiesData, isLoading } = useLiabilityDetails()
  const { data: liabilities, isLoading: isLoadingLiabilities } = useLiabilities()

  // Fetch all payments for dashboard
  const { data: paymentsData } = useLiabilityPayments()

  // Mutations
  const createLiability = useCreateLiability()
  const deleteLiability = useDeleteLiability()

  // Filter liabilities based on search term and direction filter
  const filteredLiabilities = liabilities?.items?.filter(liability => {
    const matchesSearch = searchTerm === '' ||
      liability.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (liability.description && liability.description.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesDirection = filterDirection === 'all' || liability.direction === filterDirection

    return matchesSearch && matchesDirection
  }) || []

  // Handle creating a new liability
  const handleCreateLiability = (data: any) => {
    createLiability.mutate(data, {
      onSuccess: (createdLiability: Liability) => { // Assuming onSuccess returns the created liability
        setIsAddDialogOpen(false) // Close the main add dialog

        if (createdLiability.account_id && createdLiability.start_date) {
          const today = new Date()
          const liabilityStartDate = new Date(createdLiability.start_date)
          // Ensure date comparison is only for date part, not time
          today.setHours(0, 0, 0, 0)
          liabilityStartDate.setHours(0, 0, 0, 0)

          if (liabilityStartDate < today) {
            // Check for transactions associated with the account
            // This check will be moved into the new dialog or a helper hook
            // For now, we optimistically open the dialog if account_id and start_date conditions are met.
            // The dialog itself will fetch transactions and then decide if it should show content or a "no relevant transactions" message.
            setLiabilityForInitialPayment(createdLiability)
            setShowRecordInitialPaymentsDialog(true)
          }
        }
      },
      onError: (error) => {
        // Handle error, maybe show a toast
        console.error("Error creating liability:", error)
      }
    })
  }

  // Handle deleting a liability
  const handleDeleteLiability = () => {
    if (liabilityToDelete && liabilityToDelete.id) {
      console.log("Deleting liability with ID:", liabilityToDelete.id);
      deleteLiability.mutate(liabilityToDelete.id, {
        onSuccess: () => {
          setLiabilityToDelete(null)
        }
      })
    } else {
      console.error("Cannot delete liability: No valid ID found");
    }
  }

  // Handle viewing liability details
  const handleViewLiabilityDetails = (liability: Liability) => {
    router.navigate({ to: `/liabilities/${liability.id}` })
  }

  return (
    <PageContainer title="Liabilities"
    action={
      <div className="flex gap-2">
        <Button onClick={() => setIsAddDialogOpen(true)}>
    <PlusIcon className="h-4 w-4 mr-2" />
    Add Liability
  </Button>
      </div>
    }>

      <Tabs defaultValue="dashboard">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="liabilities">All Liabilities</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          {liabilitiesData?.items && paymentsData?.items && (
            <LiabilityDashboard
              liabilities={liabilitiesData.items}
              payments={paymentsData.items}
            />
          )}
        </TabsContent>

        <TabsContent value="liabilities" className="mt-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search liabilities..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              value={filterDirection}
              onValueChange={setFilterDirection}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Liabilities</SelectItem>
                <SelectItem value="i_owe">I Owe</SelectItem>
                <SelectItem value="they_owe">They Owe</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Liabilities Grid */}
          {isLoading ? (
            <div className="text-center py-12">Loading liabilities...</div>
          ) : filteredLiabilities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLiabilities.map((liability) => (
                <LiabilityCard
                  key={liability.id}
                  liability={liability}
                  onEdit={() => router.navigate({ to: `/liabilities/${liability.id}` })}
                  onDelete={() => setLiabilityToDelete(liability)}
                  onViewDetails={() => handleViewLiabilityDetails(liability)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border rounded-lg bg-muted/20">
              <p className="text-muted-foreground">No liabilities found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsAddDialogOpen(true)}
              >
                Add your first liability
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Liability Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Add New Liability</DialogTitle>
          </DialogHeader>
          <LiabilityForm
            onSubmit={handleCreateLiability}
            onCancel={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!liabilityToDelete}
        onOpenChange={(open) => !open && setLiabilityToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the liability "{liabilityToDelete?.name}" and all associated payments.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLiability}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Record Initial Payments Dialog */}
      {liabilityForInitialPayment && (
        <RecordInitialPaymentsDialog
          isOpen={showRecordInitialPaymentsDialog}
          onClose={() => {
            setShowRecordInitialPaymentsDialog(false);
            setLiabilityForInitialPayment(null);
          }}
          liability={liabilityForInitialPayment}
        />
      )}
    </PageContainer>

  )
}
