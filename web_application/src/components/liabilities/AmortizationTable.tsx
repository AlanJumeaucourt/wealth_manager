import { useLiabilityPaymentsByLiability } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AmortizationScheduleItem, LiabilityPayment } from '@/types/liability'
import { formatCurrency } from '@/utils/format'
import { format, parseISO } from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon, InfoIcon, SearchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

interface AmortizationTableProps {
  schedule: AmortizationScheduleItem[]
  onRecordPayment?: (payment: AmortizationScheduleItem) => void
  liabilityId: number
  onViewPaymentDetails?: (payment: LiabilityPayment) => void
}

export function AmortizationTable({
  schedule,
  onRecordPayment,
  liabilityId,
  onViewPaymentDetails
}: AmortizationTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const itemsPerPage = 10

  // Fetch actual payment records
  const { data: paymentsData } = useLiabilityPaymentsByLiability(liabilityId)

  // Filter schedule based on search term
  const filteredSchedule = searchTerm
    ? schedule.filter(item =>
        item.payment_number.toString().includes(searchTerm) ||
        item.payment_date.includes(searchTerm)
      )
    : schedule

  // Calculate pagination
  const totalPages = Math.ceil(filteredSchedule.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedSchedule = filteredSchedule.slice(startIndex, startIndex + itemsPerPage)

  // Handle pagination
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentPage > 1) {
        goToPage(currentPage - 1)
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        goToPage(currentPage + 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, totalPages])

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'missed':
        return 'bg-red-100 text-red-800'
      case 'scheduled':
        return 'bg-gray-100 text-gray-800'
      case 'deferred':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Calculate status based on transaction_id, payment date, and deferral status
  const calculateStatus = (item: AmortizationScheduleItem) => {
    if (item.transaction_id) {
      return 'paid'
    }

    // Check if this is a deferred payment
    if (item.is_deferred) {
      return 'deferred'
    }

    const paymentDate = new Date(item.payment_date)
    const today = new Date()

    // Handle $0.00 payments (typically from deferred periods)
    if (item.payment_amount === 0) {
      // If date is in the past, it's a "missed" payment only if it's not deferred
      if (paymentDate < today && !item.is_deferred) {
        return 'missed'
      }
      // Otherwise it's scheduled or skipped due to deferral
      return 'scheduled'
    }

    if (paymentDate > today) {
      return 'scheduled'
    }

    return 'missed'
  }

  // Format display elements based on payment type
  const formatPaymentAmount = (item: AmortizationScheduleItem) => {
    if (item.is_deferred && item.deferral_type === 'total') {
      return item.capitalized_interest > 0
        ? `${formatCurrency(0)} (${formatCurrency(item.capitalized_interest)} capitalized)`
        : formatCurrency(0)
    }
    return formatCurrency(item.payment_amount)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Amortization Schedule</h3>
        <div className="relative w-64">
          <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search payments..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">#</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Principal</TableHead>
              <TableHead>Interest</TableHead>
              <TableHead>Remaining Balance</TableHead>
              <TableHead>Status</TableHead>
              {onRecordPayment && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSchedule.length > 0 ? (
              paginatedSchedule.map((item) => {
                // Find the corresponding payment record if it exists
                const paymentRecord = paymentsData?.items?.find(
                  p => p.payment_date.split('T')[0] === item.payment_date.split('T')[0]
                );

                const status = calculateStatus(item)
                const isDeferred = item.is_deferred

                return (
                  <TableRow
                    key={item.payment_number}
                    className={`${item.transaction_id ? 'cursor-pointer hover:bg-muted/50' : ''} ${
                      isDeferred ? 'bg-blue-50/30' : ''
                    }`}
                    onClick={() => {
                      if (item.transaction_id && paymentRecord && onViewPaymentDetails) {
                        onViewPaymentDetails(paymentRecord);
                      }
                    }}
                  >
                    <TableCell>{item.payment_number}</TableCell>
                    <TableCell>
                      {format(parseISO(item.payment_date), 'MMM d, yyyy')}
                      {item.date_shifted && item.scheduled_date && item.scheduled_date !== item.payment_date && (
                        <div className="text-xs text-muted-foreground">
                          (Scheduled: {format(parseISO(item.scheduled_date), 'MMM d')})
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{formatPaymentAmount(item)}</TableCell>
                    <TableCell>{formatCurrency(item.principal_amount)}</TableCell>
                    <TableCell>
                      {item.capitalized_interest > 0 ? (
                        <div>
                          <span>{formatCurrency(item.interest_amount)}</span>
                          <div className="text-xs text-blue-600">
                            +{formatCurrency(item.capitalized_interest)} capitalized
                          </div>
                        </div>
                      ) : (
                        formatCurrency(item.interest_amount)
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(item.remaining_principal)}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(status)}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                          {isDeferred && item.deferral_type && (
                            <span className="ml-1 text-[10px]">
                              ({item.deferral_type === 'total' ? 'Total' : 'Partial'})
                            </span>
                          )}
                        </span>
                        {item.transaction_id && (
                          <InfoIcon className="h-4 w-4 ml-2 text-muted-foreground" />
                        )}
                        {item.is_final_balloon_payment && (
                          <span className="ml-2 text-xs text-amber-600 font-medium">
                            Balloon
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {status !== 'paid' && onRecordPayment && !isDeferred ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRecordPayment(item);
                          }}
                        >
                          Record Payment
                        </Button>
                      ) : item.transaction_id && paymentRecord && onViewPaymentDetails ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewPaymentDetails(paymentRecord);
                          }}
                        >
                          View Details
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-4">
                  No payments found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredSchedule.length)} of {filteredSchedule.length} payments
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
