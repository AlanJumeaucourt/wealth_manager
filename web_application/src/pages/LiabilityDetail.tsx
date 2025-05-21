import {
    useLiability,
    useLiabilityAmortization,
    useLiabilityPaymentsByLiability,
    useRecordLiabilityPayment,
    useUpdateLiability
} from '@/api/queries'
import { AmortizationTable } from '@/components/liabilities/AmortizationTable'
import { LiabilityAmortizationChart } from '@/components/liabilities/LiabilityAmortizationChart'
import { LiabilityBalanceChart } from '@/components/liabilities/LiabilityBalanceChart'
import { LiabilityForm } from '@/components/liabilities/LiabilityForm'
import { LiabilityPaymentChart } from '@/components/liabilities/LiabilityPaymentChart'
import { LiabilitySummaryCard } from '@/components/liabilities/LiabilitySummaryCard'
import { PaymentDetailsDialog } from '@/components/liabilities/PaymentDetailsDialog'
import { RecordPaymentDialog } from '@/components/liabilities/RecordPaymentDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LiabilityFormData } from '@/types/liability'
import { AmortizationScheduleItem, LiabilityPayment } from '@/types/liability'
import { formatCurrency } from '@/utils/format'
import { useParams, useRouter } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { ArrowLeftIcon, ClockIcon, DollarSignIcon, EditIcon, PercentIcon, PiggyBankIcon } from 'lucide-react'
import { useState } from 'react'

export default function LiabilityDetailPage() {
  const router = useRouter()
  const { liabilityId } = useParams({ from: "/authenticated/liabilities/$liabilityId" })

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isPaymentDetailsDialogOpen, setIsPaymentDetailsDialogOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<AmortizationScheduleItem | undefined>()
  const [selectedPaymentDetails, setSelectedPaymentDetails] = useState<LiabilityPayment | undefined>()

  // Fetch liability details
  const { data: liability, isLoading: isLoadingLiability } = useLiability(liabilityId)

  // Fetch amortization schedule
  const { data: amortizationSchedule, isLoading: isLoadingSchedule } = useLiabilityAmortization(liabilityId)

  // Fetch payment history
  const { data: paymentsData } = useLiabilityPaymentsByLiability(liabilityId)

  // Mutations
  const updateLiability = useUpdateLiability()
  const recordPayment = useRecordLiabilityPayment()

  // Handle updating a liability
  const handleUpdateLiability = (data: LiabilityFormData) => {
    if (liability && liability.id) {
      console.log("Updating liability with ID:", liability.id);
      updateLiability.mutate(
        { id: liability.id, ...data },
        {
          onSuccess: () => {
            setIsEditDialogOpen(false)
          }
        }
      )
    } else {
      console.error("Cannot update liability: No valid ID found");
    }
  }

  // Handle recording a payment
  const handleRecordPayment = (paymentData: any) => {
    recordPayment.mutate(paymentData)
    setIsPaymentDialogOpen(false)
    setSelectedPayment(undefined)
  }

  // Find the next scheduled payment
  const getNextScheduledPayment = () => {
    if (!amortizationSchedule || amortizationSchedule.length === 0) return undefined;

    // Find the first non-deferred payment with date in the future
    const today = new Date();
    return amortizationSchedule.find(payment => {
      // Skip deferred payments with zero amount (they don't need recording)
      if (payment.is_deferred && payment.payment_amount === 0) {
        return false;
      }

      // Return the first payment that isn't recorded yet and is not in the past
      const paymentDate = new Date(payment.payment_date);
      return !payment.transaction_id && paymentDate >= today;
    });
  }

  // Calculate the deferral period status
  const getDeferralInfo = () => {
    if (!liability || !liability.deferral_period_months || liability.deferral_period_months === 0) {
      return null;
    }

    // Calculate whether we're currently in the deferral period
    const startDate = liability.start_date ? new Date(liability.start_date) : null;
    if (!startDate) return null;

    // Calculate deferral end date
    const deferralEndDate = new Date(startDate);
    deferralEndDate.setMonth(deferralEndDate.getMonth() + liability.deferral_period_months);

    const today = new Date();
    const isCurrentlyInDeferral = today < deferralEndDate;

    return {
      deferralType: liability.deferral_type,
      deferralEndDate,
      isCurrentlyInDeferral,
      deferralPeriodMonths: liability.deferral_period_months,
      deferralFormattedEndDate: format(deferralEndDate, 'MMMM d, yyyy')
    };
  }

  const deferralInfo = getDeferralInfo();

  // Format dates for display
  const startDate = liability?.start_date ? format(parseISO(liability.start_date), 'MMMM d, yyyy') : 'N/A'
  const endDate = liability?.end_date ? format(parseISO(liability.end_date), 'MMMM d, yyyy') : 'N/A'

  if (isLoadingLiability) {
    return <div className="container mx-auto py-12 text-center">Loading liability details...</div>
  }

  if (!liability) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h2 className="text-2xl font-bold mb-4">Liability not found</h2>
        <Button onClick={() => router.navigate({ to: '/liabilities' })}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Liabilities
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.navigate({ to: '/liabilities' })}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">{liability.name}</h1>
          <Badge variant={liability.direction === 'i_owe' ? 'destructive' : 'default'}>
            {liability.direction === 'i_owe' ? 'I Owe' : 'They Owe'}
          </Badge>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => {
            // Pre-select the next scheduled payment when opening the dialog
            setSelectedPayment(getNextScheduledPayment());
            setIsPaymentDialogOpen(true);
          }}>
            <DollarSignIcon className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
          <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
            <EditIcon className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Principal Amount</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(liability.principal_amount)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground flex items-center">
              <PiggyBankIcon className="h-3 w-3 mr-1" />
              Original loan amount
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Interest Rate</CardDescription>
            <CardTitle className="text-2xl">{liability.interest_rate}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground flex items-center">
              <PercentIcon className="h-3 w-3 mr-1" />
              {liability.compounding_period} compounding
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Remaining Balance</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(liability.remaining_balance || 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground flex items-center">
              <DollarSignIcon className="h-3 w-3 mr-1" />
              {formatCurrency(liability.principal_paid || 0)} principal paid
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Term</CardDescription>
            <CardTitle className="text-2xl">{startDate} - {endDate}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground flex items-center">
              <ClockIcon className="h-3 w-3 mr-1" />
              {liability.payment_frequency} payments
            </div>
            {deferralInfo && deferralInfo.isCurrentlyInDeferral && (
              <div className="mt-2 text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded-md">
                In {deferralInfo.deferralType} deferral until {deferralInfo.deferralFormattedEndDate}
              </div>
            )}
            {deferralInfo && !deferralInfo.isCurrentlyInDeferral && deferralInfo.deferralPeriodMonths > 0 && (
              <div className="mt-2 text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-md">
                {deferralInfo.deferralType} deferral for {deferralInfo.deferralPeriodMonths} months
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="amortization">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="amortization">Amortization Schedule</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="amortization" className="mt-6">
          {isLoadingSchedule ? (
            <div className="text-center py-12">Loading amortization schedule...</div>
          ) : amortizationSchedule && amortizationSchedule.length > 0 ? (
            <AmortizationTable
              schedule={amortizationSchedule}
              liabilityId={Number(liabilityId)}
              onRecordPayment={(payment) => {
                setSelectedPayment(payment)
                setIsPaymentDialogOpen(true)
              }}
              onViewPaymentDetails={(payment) => {
                setSelectedPaymentDetails(payment)
                setIsPaymentDetailsDialogOpen(true)
              }}
            />
          ) : (
            <div className="text-center py-12 border rounded-lg bg-muted/20">
              <p className="text-muted-foreground">No amortization schedule available</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Loan Summary Card */}
            <div className="lg:col-span-2">
              {liability && <LiabilitySummaryCard liability={liability} />}
            </div>

            {/* Balance Chart */}
            <div className="lg:col-span-1">
              {amortizationSchedule && amortizationSchedule.length > 0 ? (
                <LiabilityBalanceChart
                  schedule={amortizationSchedule}
                  title="Balance Over Time"
                  description="Remaining balance throughout the loan term"
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Balance Over Time</CardTitle>
                    <CardDescription>Remaining balance throughout the loan term</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center h-80">
                      <p className="text-muted-foreground">No chart data available</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Payment Breakdown Chart */}
            <div className="lg:col-span-1">
              {amortizationSchedule && amortizationSchedule.length > 0 ? (
                <LiabilityPaymentChart
                  schedule={amortizationSchedule}
                  title="Payment Breakdown"
                  description="Principal vs interest over time"
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Breakdown</CardTitle>
                    <CardDescription>Principal vs interest over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center h-80">
                      <p className="text-muted-foreground">No chart data available</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Amortization Chart */}
            <div className="lg:col-span-2">
              {amortizationSchedule && amortizationSchedule.length > 0 ? (
                <LiabilityAmortizationChart
                  schedule={amortizationSchedule}
                  title="Amortization Schedule"
                  description="Detailed breakdown of payments over the loan term"
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Amortization Schedule</CardTitle>
                    <CardDescription>Detailed breakdown of payments over the loan term</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center h-80">
                      <p className="text-muted-foreground">No chart data available</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Liability Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl p-0">
          <LiabilityForm
            liability={liability}
            onSubmit={handleUpdateLiability}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        isOpen={isPaymentDialogOpen}
        onClose={() => {
          setIsPaymentDialogOpen(false)
          setSelectedPayment(undefined)
        }}
        onSubmit={handleRecordPayment}
        liability={liability}
        scheduledPayment={selectedPayment}
      />

      {/* Payment Details Dialog */}
      <PaymentDetailsDialog
        isOpen={isPaymentDetailsDialogOpen}
        onClose={() => {
          setIsPaymentDetailsDialogOpen(false)
          setSelectedPaymentDetails(undefined)
        }}
        payment={selectedPaymentDetails}
      />
    </div>
  )
}
