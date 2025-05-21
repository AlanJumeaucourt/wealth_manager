import { Liability } from '@/types'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/utils/format'
import { format, parseISO } from 'date-fns'
import { PencilIcon, TrashIcon, CalendarIcon, ArrowRightIcon } from 'lucide-react'

interface LiabilityCardProps {
  liability: Liability
  onEdit: (liability: Liability) => void
  onDelete: (liability: Liability) => void
  onViewDetails: (liability: Liability) => void
}

export function LiabilityCard({ liability, onEdit, onDelete, onViewDetails }: LiabilityCardProps) {
  // Format dates
  const startDate = liability.start_date ? format(parseISO(liability.start_date), 'MMM d, yyyy') : 'N/A'
  const endDate = liability.end_date ? format(parseISO(liability.end_date), 'MMM d, yyyy') : 'N/A'
  const nextPaymentDate = liability.next_payment_date
    ? format(parseISO(liability.next_payment_date), 'MMM d, yyyy')
    : 'N/A'

  // Calculate progress percentage
  const progressPercentage = liability.principal_paid && liability.principal_amount
    ? Math.min(100, (liability.principal_paid / liability.principal_amount) * 100)
    : 0

  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">{liability.name}</CardTitle>
            <CardDescription>
              {liability.liability_type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </CardDescription>
          </div>
          <Badge variant={liability.direction === 'i_owe' ? 'destructive' : 'default'}>
            {liability.direction === 'i_owe' ? 'I Owe' : 'They Owe'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Principal</p>
              <p className="font-medium">{formatCurrency(liability.principal_amount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Interest Rate</p>
              <p className="font-medium">{liability.interest_rate}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Remaining Balance</p>
              <p className="font-medium">{formatCurrency(liability.remaining_balance || 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Interest Paid</p>
              <p className="font-medium">{formatCurrency(liability.interest_paid || 0)}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Progress</span>
              <span>{progressPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Next payment info */}
          {liability.next_payment_date && (
            <div className="flex items-center text-sm">
              <CalendarIcon className="h-4 w-4 mr-1 text-muted-foreground" />
              <span>Next payment: {nextPaymentDate}</span>
            </div>
          )}

          {/* Missed payments warning */}
          {liability.missed_payments_count && liability.missed_payments_count > 0 && (
            <div className="text-destructive text-sm font-medium">
              {liability.missed_payments_count} missed payment{liability.missed_payments_count > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <div className="flex justify-between w-full">
          <Button variant="ghost" size="sm" onClick={() => onDelete(liability)}>
            <TrashIcon className="h-4 w-4 mr-1" />
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(liability)}>
            <PencilIcon className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button variant="default" size="sm" onClick={() => onViewDetails(liability)}>
            Details
            <ArrowRightIcon className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
