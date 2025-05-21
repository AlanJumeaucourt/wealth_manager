import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Liability } from '@/types'
import { useAccounts } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DatePicker } from '@/components/ui/date-picker'
import { format } from 'date-fns'
import { ComboboxInput, type Option } from '@/components/ui/comboboxInput'

// Define the form schema with Zod
const liabilityFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  liability_type: z.enum([
    'standard_loan', 'partial_deferred_loan', 'total_deferred_loan',
    'mortgage', 'credit_card', 'line_of_credit', 'other'
  ]),
  principal_amount: z.number().min(0, 'Principal amount must be positive'),
  interest_rate: z.number().min(0, 'Interest rate must be positive'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  compounding_period: z.enum(['daily', 'monthly', 'quarterly', 'annually']),
  payment_frequency: z.enum(['weekly', 'bi-weekly', 'monthly', 'quarterly', 'annually']),
  payment_amount: z.number().optional(),
  deferral_period_months: z.number().min(0, 'Deferral period must be positive').optional(),
  deferral_type: z.enum(['none', 'partial', 'total']),
  direction: z.enum(['i_owe', 'they_owe']),
  account_id: z.number().optional(),
  lender_name: z.string().optional(),
})

type LiabilityFormData = z.infer<typeof liabilityFormSchema>

interface LiabilityFormProps {
  liability?: Liability
  onSubmit: (data: LiabilityFormData) => void
  onCancel: () => void
}

export function LiabilityForm({ liability, onSubmit, onCancel }: LiabilityFormProps) {
  const { data: accountsData } = useAccounts({ per_page: 1000 })

  // Define liability types
  const liabilityTypes = [
    { id: 'standard_loan', name: 'Standard Loan' },
    { id: 'partial_deferred_loan', name: 'Partial Deferred Loan' },
    { id: 'total_deferred_loan', name: 'Total Deferred Loan' },
    { id: 'mortgage', name: 'Mortgage' },
    { id: 'credit_card', name: 'Credit Card' },
    { id: 'line_of_credit', name: 'Line of Credit' },
    { id: 'other', name: 'Other' }
  ]

  // Helper function to calculate term length and period from start and end dates
  const calculateTermFromDates = (startDate: string, endDate?: string) => {
    if (!endDate) {
      return { termLength: 5, termPeriod: 'years' as const };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Calculate difference in months
    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 +
                       (end.getMonth() - start.getMonth());

    // If more than 24 months, convert to years
    if (diffMonths >= 24) {
      return {
        termLength: Math.round(diffMonths / 12),
        termPeriod: 'years' as const
      };
    } else {
      return {
        termLength: diffMonths,
        termPeriod: 'months' as const
      };
    }
  };

  // Initialize term state
  const initialTermValues = liability
    ? calculateTermFromDates(liability.start_date, liability.end_date)
    : { termLength: 5, termPeriod: 'years' as const };

  const [termLength, setTermLength] = useState(initialTermValues.termLength);
  const [termPeriod, setTermPeriod] = useState<'months' | 'years'>(initialTermValues.termPeriod);

  // Set up form with default values
  const { control, handleSubmit, watch, formState: { errors } } = useForm<LiabilityFormData>({
    resolver: zodResolver(liabilityFormSchema),
    defaultValues: liability ? {
      ...liability,
      principal_amount: liability.principal_amount,
      interest_rate: liability.interest_rate,
      deferral_period_months: liability.deferral_period_months,
      payment_amount: liability.payment_amount,
      account_id: liability.account_id,
    } : {
      name: '',
      description: '',
      liability_type: 'standard_loan',
      principal_amount: 0,
      interest_rate: 0,
      start_date: format(new Date(), 'yyyy-MM-dd'),
      compounding_period: 'monthly',
      payment_frequency: 'monthly',
      deferral_period_months: 0,
      deferral_type: 'none',
      direction: 'i_owe',
    }
  })

  // Watch for changes to deferral_type
  const deferralType = watch('deferral_type')

  return (
    <Card className="w-full border-0 shadow-none">
      <CardHeader>
        <CardTitle>{liability ? 'Edit Liability' : 'Add New Liability'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit((data) => {
        // Calculate end date based on term length and period
        const startDate = new Date(data.start_date);
        let endDate = new Date(startDate);

        if (termPeriod === 'months') {
          endDate.setMonth(startDate.getMonth() + termLength);
        } else { // years
          endDate.setFullYear(startDate.getFullYear() + termLength);
        }

        // Add end_date to the data before submitting
        const formDataWithEndDate = {
          ...data,
          end_date: format(endDate, 'yyyy-MM-dd')
        };

        // Call the original onSubmit with the modified data
        onSubmit(formDataWithEndDate);
      })}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Information */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input id="name" {...field} />
                )}
              />
              {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="liability_type">Liability Type</Label>
              <Controller
                name="liability_type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a liability type" />
                    </SelectTrigger>
                    <SelectContent>
                      {liabilityTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.liability_type && (
                <p className="text-red-500 text-sm">{errors.liability_type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <Textarea id="description" {...field} />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="direction">Direction</Label>
              <Controller
                name="direction"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="flex flex-col space-y-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="i_owe" id="i_owe" />
                      <Label htmlFor="i_owe">I Owe Money</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="they_owe" id="they_owe" />
                      <Label htmlFor="they_owe">Someone Owes Me</Label>
                    </div>
                  </RadioGroup>
                )}
              />
            </div>

            {/* Financial Details */}
            <div className="space-y-2">
              <Label htmlFor="principal_amount">Principal Amount</Label>
              <Controller
                name="principal_amount"
                control={control}
                render={({ field }) => (
                  <Input
                    id="principal_amount"
                    type="number"
                    step="0.01"
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    value={field.value}
                  />
                )}
              />
              {errors.principal_amount && (
                <p className="text-red-500 text-sm">{errors.principal_amount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="interest_rate">Interest Rate (%)</Label>
              <Controller
                name="interest_rate"
                control={control}
                render={({ field }) => (
                  <Input
                    id="interest_rate"
                    type="number"
                    step="0.01"
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    value={field.value}
                  />
                )}
              />
              {errors.interest_rate && (
                <p className="text-red-500 text-sm">{errors.interest_rate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Controller
                name="start_date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    value={field.value ? new Date(field.value) : undefined}
                    onChange={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                  />
                )}
              />
              {errors.start_date && (
                <p className="text-red-500 text-sm">{errors.start_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="term_length">Term Length</Label>
              <Input
                id="term_length"
                type="number"
                min="1"
                onChange={(e) => setTermLength(parseInt(e.target.value) || 1)}
                value={termLength}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="term_period">Term Period</Label>
              <Select
                value={termPeriod}
                onValueChange={(value: 'months' | 'years') => setTermPeriod(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select term period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="months">Months</SelectItem>
                  <SelectItem value="years">Years</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Interest and Payment Details */}
            <div className="space-y-2">
              <Label htmlFor="compounding_period">Compounding Period</Label>
              <Controller
                name="compounding_period"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select compounding period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_frequency">Payment Frequency</Label>
              <Controller
                name="payment_frequency"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_amount">
                Payment Amount (Optional - will be calculated if not provided)
              </Label>
              <Controller
                name="payment_amount"
                control={control}
                render={({ field }) => (
                  <Input
                    id="payment_amount"
                    type="number"
                    step="0.01"
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                    value={field.value ?? ''}
                  />
                )}
              />
            </div>

            {/* Deferral Details */}
            <div className="space-y-2">
              <Label htmlFor="deferral_type">Deferral Type</Label>
              <Controller
                name="deferral_type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select deferral type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="partial">Partial (Interest Only)</SelectItem>
                      <SelectItem value="total">Total (No Payments)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {deferralType !== 'none' && (
              <div className="space-y-2">
                <Label htmlFor="deferral_period_months">Deferral Period (Months)</Label>
                <Controller
                  name="deferral_period_months"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="deferral_period_months"
                      type="number"
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                      value={field.value}
                    />
                  )}
                />
                {errors.deferral_period_months && (
                  <p className="text-red-500 text-sm">{errors.deferral_period_months.message}</p>
                )}
              </div>
            )}

            {/* Additional Details */}
            <div className="space-y-2">
              <Label htmlFor="account_id">Associated Account (Optional)</Label>
              <Controller
                name="account_id"
                control={control}
                render={({ field }) => {
                  const accountOptions: Option[] = accountsData?.items?.map((account) => ({
                    value: account.id.toString(),
                    label: account.name
                  })) || []

                  const selectedAccount = accountOptions.find(
                    option => option.value === field.value?.toString()
                  )

                  return (
                    <ComboboxInput
                      options={accountOptions}
                      value={selectedAccount}
                      onValueChange={(option) => {
                        field.onChange(option ? parseInt(option.value) : undefined)
                      }}
                      placeholder="Select an account"
                      emptyMessage="No accounts found."
                    />
                  )
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lender_name">Lender/Borrower Name (Optional)</Label>
              <Controller
                name="lender_name"
                control={control}
                render={({ field }) => (
                  <Input id="lender_name" {...field} />
                )}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {liability ? 'Update Liability' : 'Create Liability'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
