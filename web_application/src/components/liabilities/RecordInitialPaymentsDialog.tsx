import { useAccounts, useRecordLiabilityPayment, useTransactions } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Liability, LiabilityPayment, Transaction } from '@/types';
import { formatCurrency } from '@/utils/format';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

// Define the form schema for recording a payment
const paymentFormSchema = z.object({
  payment_date: z.string().min(1, 'Payment date is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  principal_amount: z.number().min(0, 'Principal must be non-negative').optional(),
  interest_amount: z.number().min(0, 'Interest must be non-negative').optional(),
  extra_payment: z.number().min(0, 'Extra payment must be non-negative').optional(),
  transaction_id: z.number().optional(), // Link to an existing transaction
});
type PaymentFormData = z.infer<typeof paymentFormSchema>;

interface RecordInitialPaymentsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  liability: Liability;
}

export function RecordInitialPaymentsDialog({ isOpen, onClose, liability }: RecordInitialPaymentsDialogProps) {
  const { toast } = useToast();
  const recordPaymentMutation = useRecordLiabilityPayment();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [processedTransactionIds, setProcessedTransactionIds] = useState<number[]>([]);
  const [isBatchRecording, setIsBatchRecording] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const { data: transactionsResponse, isLoading: isLoadingTransactions, error: transactionsError } = useTransactions({
    account_id: liability.account_id,
    from_date: liability.start_date,
    to_date: today,
    per_page: 100,
    sort_by: 'date',
    sort_order: 'desc',
  }, {
    enabled: isOpen && !!liability.account_id && !!liability.start_date,
  });

  const allFetchedTransactions = transactionsResponse?.items || [];
  const displayedTransactions = useMemo(() => {
    return allFetchedTransactions.filter(t => !processedTransactionIds.includes(t.id));
  }, [allFetchedTransactions, processedTransactionIds]);

  const { data: accountData } = useAccounts({ id: liability.account_id ? [liability.account_id] : [] });
  const accountName = accountData?.items?.[0]?.name || 'the associated account';

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      payment_date: today,
      amount: 0,
      principal_amount: 0,
      interest_amount: 0,
      extra_payment: 0,
    },
  });

  useEffect(() => {
    if (selectedTransaction) {
      form.reset({
        payment_date: format(new Date(selectedTransaction.date), 'yyyy-MM-dd'),
        amount: Math.abs(selectedTransaction.amount),
        principal_amount: Math.abs(selectedTransaction.amount),
        interest_amount: 0,
        extra_payment: 0,
        transaction_id: selectedTransaction.id,
      });
    } else {
      form.reset({
        payment_date: today,
        amount: 0,
        principal_amount: 0,
        interest_amount: 0,
        extra_payment: 0,
        transaction_id: undefined,
      });
    }
  }, [selectedTransaction, form, today]);

  const onSubmit = (data: PaymentFormData) => {
    const paymentPayload: Omit<LiabilityPayment, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
      liability_id: liability.id,
      payment_date: data.payment_date,
      amount: data.amount,
      principal_amount: data.principal_amount || data.amount,
      interest_amount: data.interest_amount || 0,
      extra_payment: data.extra_payment || 0,
      transaction_id: data.transaction_id,
    };

    recordPaymentMutation.mutate(paymentPayload, {
      onSuccess: () => {
        toast({ title: "Payment Recorded", description: "The payment has been successfully recorded." });
        if (data.transaction_id) {
          setProcessedTransactionIds(prev => [...prev, data.transaction_id!]);
        }
        form.reset();
        setSelectedTransaction(null);
      },
      onError: (error) => {
        toast({ title: "Error Recording Payment", description: error.message, variant: "destructive" });
      },
    });
  };

  const handleTransactionSelect = (transaction: Transaction) => {
    if (processedTransactionIds.includes(transaction.id)) return;
    if (selectedTransaction?.id === transaction.id) {
      setSelectedTransaction(null);
    } else {
      setSelectedTransaction(transaction);
    }
  };

  const handleRecordAllDisplayed = async () => {
    if (displayedTransactions.length === 0 || isBatchRecording) return;
    setIsBatchRecording(true);

    const promises = displayedTransactions.map(transaction => {
      const paymentPayload: Omit<LiabilityPayment, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
        liability_id: liability.id,
        payment_date: format(new Date(transaction.date), 'yyyy-MM-dd'),
        amount: Math.abs(transaction.amount),
        principal_amount: Math.abs(transaction.amount),
        interest_amount: 0,
        extra_payment: 0,
        transaction_id: transaction.id,
      };
      return recordPaymentMutation.mutateAsync(paymentPayload)
        .then(() => ({ status: 'fulfilled' as const, id: transaction.id }))
        .catch(() => ({ status: 'rejected' as const, id: transaction.id }));
    });

    const results = await Promise.allSettled(promises);

    let successCount = 0;
    const newlyProcessedIds: number[] = [];

    results.forEach(settledResult => {
      if (settledResult.status === 'fulfilled' && settledResult.value.status === 'fulfilled') {
        successCount++;
        newlyProcessedIds.push(settledResult.value.id);
      }
    });

    if (newlyProcessedIds.length > 0) {
      setProcessedTransactionIds(prev => [...prev, ...newlyProcessedIds]);
    }

    if (successCount > 0) {
      toast({ title: "Batch Payments Processed", description: `${successCount} of ${displayedTransactions.length} payments recorded successfully.` });
    }
    if (successCount !== displayedTransactions.length) {
      const failedCount = displayedTransactions.length - successCount;
      toast({ title: "Batch Payment Issues", description: `${failedCount} payments could not be recorded.`, variant: "destructive" });
    }

    form.reset();
    setSelectedTransaction(null);
    setIsBatchRecording(false);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Record Initial Payments for: {liability.name}</DialogTitle>
          <DialogDescription>
            Liability started on {format(new Date(liability.start_date), 'PPP')}.
            Select a transaction from '{accountName}' to pre-fill payment details, or enter manually.
          </DialogDescription>
        </DialogHeader>

        {isLoadingTransactions && <p>Loading transactions...</p>}
        {transactionsError && <p className="text-red-500">Error loading transactions: {transactionsError.message}</p>}

        {!isLoadingTransactions && displayedTransactions.length === 0 && allFetchedTransactions.length > 0 && (
          <p className="text-muted-foreground my-4">
            All suggested transactions have been processed. You can still record a manual payment or finish.
          </p>
        )}
        {!isLoadingTransactions && allFetchedTransactions.length === 0 && (
           <p className="text-muted-foreground my-4">
            No transactions found for '{accountName}' between {format(new Date(liability.start_date), 'PPP')} and today. You can record a manual payment.
           </p>
        )}

        {!isLoadingTransactions && displayedTransactions.length > 0 && (
          <div className="my-4">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">Relevant Transactions from '{accountName}'</h3>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRecordAllDisplayed}
                    disabled={isBatchRecording || recordPaymentMutation.isPending}
                >
                    {isBatchRecording ? 'Processing...' : 'Record All Suggested'}
                </Button>
            </div>
            <ScrollArea className="h-64 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedTransactions.map((transaction) => (
                    <TableRow
                      key={transaction.id}
                      onClick={() => handleTransactionSelect(transaction)}
                      className={`cursor-pointer ${selectedTransaction?.id === transaction.id ? 'bg-muted' : ''}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedTransaction?.id === transaction.id}
                          onCheckedChange={() => handleTransactionSelect(transaction)}
                          disabled={processedTransactionIds.includes(transaction.id)}
                        />
                      </TableCell>
                      <TableCell>{format(new Date(transaction.date), 'yyyy-MM-dd')}</TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell className="text-right">{formatCurrency(transaction.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date</Label>
              <Controller
                name="payment_date"
                control={form.control}
                render={({ field }) => <DatePicker date={field.value ? new Date(field.value + 'T00:00:00') : undefined} onDateChange={(d) => field.onChange(d ? format(d, 'yyyy-MM-dd') : '')} />}
              />
              {form.formState.errors.payment_date && <p className="text-red-500 text-sm">{form.formState.errors.payment_date.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount</Label>
              <Controller
                name="amount"
                control={form.control}
                render={({ field }) => <Input id="amount" type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />}
              />
              {form.formState.errors.amount && <p className="text-red-500 text-sm">{form.formState.errors.amount.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="principal_amount">Principal Amount (Optional)</Label>
              <Controller
                name="principal_amount"
                control={form.control}
                render={({ field }) => <Input id="principal_amount" type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} placeholder={form.getValues('amount').toString()} />}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interest_amount">Interest Amount (Optional)</Label>
              <Controller
                name="interest_amount"
                control={form.control}
                render={({ field }) => <Input id="interest_amount" type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />}
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="extra_payment">Extra Payment (Optional)</Label>
              <Controller
                name="extra_payment"
                control={form.control}
                render={({ field }) => <Input id="extra_payment" type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />}
              />
            </div>
          </div>

          {selectedTransaction && (
            <p className="text-sm text-muted-foreground">
              Linked to transaction: '{selectedTransaction.description}' on {format(new Date(selectedTransaction.date), 'yyyy-MM-dd')} for {formatCurrency(selectedTransaction.amount)}.
            </p>
          )}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isBatchRecording || recordPaymentMutation.isPending}>
              Skip / Finish
            </Button>
            <Button type="submit" disabled={recordPaymentMutation.isPending || isBatchRecording || !form.formState.isDirty && !selectedTransaction}>
              {recordPaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
