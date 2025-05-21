import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AmortizationScheduleItem, Liability, LiabilityPayment } from '@/types'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { format } from 'date-fns'
import { useLiabilityPaymentsByLiability, useTransactions } from '@/api/queries'
import { ComboboxInput, Option } from '@/components/ui/comboboxInput'
import { useDebounce } from '@/hooks/useDebounce'

// Define the form schema with Zod
const paymentFormSchema = z.object({
  payment_date: z.string().min(1, 'Payment date is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  principal_amount: z.number().min(0, 'Principal amount must be positive'),
  interest_amount: z.number().min(0, 'Interest amount must be positive'),
  extra_payment: z.number().min(0, 'Extra payment must be positive'),
  transaction_id: z.number({
    required_error: "Transaction is required",
    invalid_type_error: "Transaction must be selected"
  }),
})

type PaymentFormData = z.infer<typeof paymentFormSchema>

interface RecordPaymentDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: Omit<LiabilityPayment, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void
  liability: Liability
  scheduledPayment?: AmortizationScheduleItem
}

export function RecordPaymentDialog({
  isOpen,
  onClose,
  onSubmit,
  liability,
  scheduledPayment
}: RecordPaymentDialogProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 300) // 300ms debounce

  // Fetch existing payments for this liability
  const { data: existingPayments } = useLiabilityPaymentsByLiability(liability.id)

  // Get a list of transaction IDs that are already linked to payments
  const linkedTransactionIds = existingPayments?.items?.map(payment => payment.transaction_id) || []

  // Fetch transactions, filtering out those already linked to payments
  const { data: transactionsData } = useTransactions({
    search: debouncedSearchQuery.length > 1 ? debouncedSearchQuery : undefined,
    search_fields: debouncedSearchQuery.length > 1 ? ["description"] : undefined,
    per_page: 999,
    sort_by: "date",
    sort_order: "desc",
    account_id: liability.account_id
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Handle dialog close
  const handleClose = () => {
    // Reset form to default values when dialog is closed
    reset();

    // Call the provided onClose function
    onClose();
  }

  // Set up form with default values from scheduled payment
  const { control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      amount: 0.01, // Minimum valid amount
      principal_amount: 0,
      interest_amount: 0.01, // Minimum valid interest amount
      extra_payment: 0,
      // transaction_id is required and must be selected by the user
    }
  })

  // Update form values when scheduledPayment changes or dialog opens
  useEffect(() => {
    if (isOpen && scheduledPayment) {
      // Ensure we have valid values
      const amount = Math.max(scheduledPayment.payment_amount, 0.01);
      const principalAmount = Math.max(scheduledPayment.principal_amount, 0);
      const interestAmount = Math.max(scheduledPayment.interest_amount, 0.01);

      reset({
        payment_date: scheduledPayment.payment_date,
        amount: amount,
        principal_amount: principalAmount,
        interest_amount: interestAmount,
        extra_payment: 0,
        // transaction_id must be selected by the user
      });
    }
  }, [isOpen, scheduledPayment, reset]);

  // Watch for changes to calculate total
  const principal = watch('principal_amount')
  const interest = watch('interest_amount')
  const extra = watch('extra_payment')

  // Update amount when components change
  const updateAmount = () => {
    setValue('amount', principal + interest + extra)
  }

  // Handle form submission
  const handleFormSubmit = (data: PaymentFormData) => {
    setIsSubmitting(true)

    // Prepare data for submission
    const paymentData = {
      ...data,
      liability_id: liability.id,
    }

    onSubmit(paymentData)
    setIsSubmitting(false)
    handleClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment for {liability.name}. A transaction must be selected to record a payment. Only transactions that haven't been used for other payments will be available.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="payment_date" className="text-right">
                Date
              </Label>
              <div className="col-span-3">
                <Controller
                  name="payment_date"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      value={field.value ? new Date(field.value) : undefined}
                      onChange={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                    />
                  )}
                />
                {errors.payment_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.payment_date.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="principal_amount" className="text-right">
                Principal
              </Label>
              <div className="col-span-3">
                <Controller
                  name="principal_amount"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="principal_amount"
                      type="number"
                      step="0.01"
                      onChange={(e) => {
                        field.onChange(parseFloat(e.target.value))
                        setTimeout(updateAmount, 0)
                      }}
                      value={field.value}
                    />
                  )}
                />
                {errors.principal_amount && (
                  <p className="text-red-500 text-sm mt-1">{errors.principal_amount.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="interest_amount" className="text-right">
                Interest
              </Label>
              <div className="col-span-3">
                <Controller
                  name="interest_amount"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="interest_amount"
                      type="number"
                      step="0.01"
                      onChange={(e) => {
                        field.onChange(parseFloat(e.target.value))
                        setTimeout(updateAmount, 0)
                      }}
                      value={field.value}
                    />
                  )}
                />
                {errors.interest_amount && (
                  <p className="text-red-500 text-sm mt-1">{errors.interest_amount.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="extra_payment" className="text-right">
                Extra
              </Label>
              <div className="col-span-3">
                <Controller
                  name="extra_payment"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="extra_payment"
                      type="number"
                      step="0.01"
                      onChange={(e) => {
                        field.onChange(parseFloat(e.target.value))
                        setTimeout(updateAmount, 0)
                      }}
                      value={field.value}
                    />
                  )}
                />
                {errors.extra_payment && (
                  <p className="text-red-500 text-sm mt-1">{errors.extra_payment.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Total Amount
              </Label>
              <div className="col-span-3">
                <Controller
                  name="amount"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={field.value}
                      readOnly
                      className="bg-muted"
                    />
                  )}
                />
                {errors.amount && (
                  <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="transaction_id" className="text-right">
                Transaction <span className="text-red-500">*</span>
              </Label>
              <div className="col-span-3">
                <Controller
                  name="transaction_id"
                  control={control}
                  render={({ field }) => {
                    // Filter out transactions that are already linked to payments
                    const filteredTransactions = (transactionsData?.items || []).filter(
                      transaction => !linkedTransactionIds.includes(transaction.id)
                    );

                    // Convert transactions to options format
                    const transactionOptions: Option[] = filteredTransactions.map(transaction => ({
                      value: transaction.id.toString(),
                      label: `${transaction.description} ($${transaction.amount.toFixed(2)})`,
                      date: transaction.date
                    }));

                    // Find the selected transaction
                    let selectedValue = '';
                    if (field.value !== undefined && field.value !== null) {
                      selectedValue = field.value.toString();
                    }

                    // Find the selected transaction or return undefined if none selected
                    const selectedTransaction = selectedValue
                      ? transactionOptions.find(option => option.value === selectedValue)
                      : undefined;

                    return (
                      <>
                        <ComboboxInput
                          options={transactionOptions}
                          value={selectedTransaction}
                          onValueChange={(option) => {
                            // Set the transaction ID or undefined if no option is selected
                            field.onChange(option ? parseInt(option.value) : undefined)
                            // Clear search query when an option is selected
                            setSearchQuery("")
                          }}
                          placeholder="Search for a transaction..."
                          emptyMessage="No transactions found"
                          isLoading={false}
                          // This is a custom prop we're adding to handle input changes
                          // The ComboboxInput component will call this when the input value changes
                          // @ts-ignore - We're adding a custom prop
                          onInputChange={(value: string) => {
                            setSearchQuery(value)
                          }}
                        />
                        {errors.transaction_id && (
                          <p className="text-red-500 text-sm mt-1">{errors.transaction_id.message}</p>
                        )}
                      </>
                    );
                  }}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !watch('transaction_id')}
            >
              {isSubmitting ? 'Saving...' : 'Save Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
