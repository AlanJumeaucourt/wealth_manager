import { LiabilityPayment, Transaction } from '@/types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/utils/format'
import { format, parseISO } from 'date-fns'
import { ArrowRightIcon, ExternalLinkIcon, Loader2Icon } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useAccounts, useLiability, useTransactions } from '@/api/queries'
import { useEffect, useState } from 'react'

interface PaymentDetailsDialogProps {
  isOpen: boolean
  onClose: () => void
  payment?: LiabilityPayment
}

export function PaymentDetailsDialog({
  isOpen,
  onClose,
  payment
}: PaymentDetailsDialogProps) {
  const navigate = useNavigate()
  const [transactionDetails, setTransactionDetails] = useState<Transaction | null>(null)
  const [fromAccountName, setFromAccountName] = useState<string>('')
  const [toAccountName, setToAccountName] = useState<string>('')

  // Fetch transaction details if payment has transaction_id
  const { data: transactionData } = useTransactions(
    payment?.transaction_id ? {
      id: payment.transaction_id,
      per_page: 1
    } : undefined
  )

  // Fetch liability details
  const { data: liabilityData } = useLiability(
    payment?.liability_id ? payment.liability_id : 0
  )

  // Get account IDs from transaction data
  const fromAccountId = transactionData?.items?.[0]?.from_account_id
  const toAccountId = transactionData?.items?.[0]?.to_account_id

  // Fetch only the specific accounts needed for the transaction
  const { data: accountsData } = useAccounts(
    (fromAccountId || toAccountId) ? {
      id: [fromAccountId, toAccountId].filter(Boolean) as number[]
    } : undefined
  )

  // Update local state when data is loaded
  useEffect(() => {
    if (transactionData?.items && transactionData.items.length > 0) {
      setTransactionDetails(transactionData.items[0])

      // Get account names if accounts data is available
      if (accountsData?.items) {
        const transaction = transactionData.items[0]
        const fromAccount = accountsData.items.find(acc => acc.id === transaction.from_account_id)
        const toAccount = accountsData.items.find(acc => acc.id === transaction.to_account_id)

        if (fromAccount) {
          setFromAccountName(fromAccount.name)
        }

        if (toAccount) {
          setToAccountName(toAccount.name)
        }
      }
    }
  }, [transactionData, accountsData])

  if (!payment) {
    return null
  }

  const handleViewTransaction = () => {
    if (payment.transaction_id) {
      // Navigate to transaction detail page
      navigate({
        to: "/transactions/$transactionId",
        params: { transactionId: payment.transaction_id }
      })
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Payment Details</DialogTitle>
          <DialogDescription>
            {liabilityData?.name && `Payment for ${liabilityData.name}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Date</h3>
              <p className="text-base">
                {format(parseISO(payment.payment_date), 'MMMM d, yyyy')}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
              <p className="text-base capitalize">{payment.status}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Principal</h3>
              <p className="text-base">{formatCurrency(payment.principal_amount)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Interest</h3>
              <p className="text-base">{formatCurrency(payment.interest_amount)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Extra</h3>
              <p className="text-base">{formatCurrency(payment.extra_payment || 0)}</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Total Amount</h3>
            <p className="text-xl font-semibold">{formatCurrency(payment.amount)}</p>
          </div>

          {payment.transaction_id && transactionData?.items && transactionData.items.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h3 className="text-base font-medium mb-2">Linked Transaction</h3>
              <div className="bg-muted p-4 rounded-md">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium">{transactionData.items[0].description}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(transactionData.items[0].date), 'MMMM d, yyyy')}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatCurrency(transactionData.items[0].amount)}
                  </p>
                </div>

                <div className="flex items-center text-sm text-muted-foreground mt-2">
                  <span>{fromAccountName}</span>
                  <ArrowRightIcon className="h-3 w-3 mx-2" />
                  <span>{toAccountName}</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={handleViewTransaction}
                >
                  <ExternalLinkIcon className="h-4 w-4 mr-2" />
                  View Transaction Details
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
