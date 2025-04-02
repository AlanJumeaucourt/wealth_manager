import { useAccounts, useUpdateInvestment } from "@/api/queries"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Investment } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

const formSchema = z.object({
  investment_type: z.enum([
    "Buy",
    "Sell",
    "Dividend",
    "Interest",
    "Deposit",
    "Withdrawal",
  ]),
  asset_id: z.number(),
  date: z.string(),
  fee: z.number(),
  from_account_id: z.number(),
  quantity: z.number(),
  tax: z.number(),
  to_account_id: z.number(),
  unit_price: z.number(),
})

type FormData = z.infer<typeof formSchema>

interface EditInvestmentDialogProps {
  investment: Investment
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditInvestmentDialog({
  investment,
  open,
  onOpenChange,
}: EditInvestmentDialogProps) {
  const { toast } = useToast()
  const updateMutation = useUpdateInvestment()
  const { data: accountsResponse } = useAccounts({
    type: "investment",
    per_page: 1000,
  })

  const accounts = accountsResponse?.items || []

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      investment_type: investment.investment_type,
      asset_id: investment.asset_id,
      date: new Date(investment.date).toISOString().split("T")[0],
      fee: investment.fee,
      from_account_id: investment.from_account_id,
      quantity: investment.quantity,
      tax: investment.tax,
      to_account_id: investment.to_account_id,
      unit_price: investment.unit_price,
    },
  })

  const onSubmit = async (data: FormData) => {
    try {
      await updateMutation.mutateAsync({
        transaction_id: investment.transaction_id,
        data: {
          ...data,
          date: new Date(data.date).toISOString(),
          date_accountability: new Date(data.date).toISOString(),
          description: `${data.investment_type === "Buy" ? "Buy" : "Sell"} ${
            data.quantity
          } units of asset ${data.asset_id}`,
        },
      })
      toast({
        title: "Investment Updated",
        description: "Your investment has been updated successfully.",
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update investment. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Investment</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4">
            <div>
              <Select
                onValueChange={value =>
                  form.setValue("investment_type", value as any)
                }
                defaultValue={investment.investment_type}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Buy">Buy</SelectItem>
                  <SelectItem value="Sell">Sell</SelectItem>
                  <SelectItem value="Dividend">Dividend</SelectItem>
                  <SelectItem value="Interest">Interest</SelectItem>
                  <SelectItem value="Deposit">Deposit</SelectItem>
                  <SelectItem value="Withdrawal">Withdrawal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Input
                type="date"
                {...form.register("date")}
                className="w-full"
              />
            </div>

            <div>
              <Select
                onValueChange={value =>
                  form.setValue("from_account_id", parseInt(value))
                }
                defaultValue={investment.from_account_id.toString()}
              >
                <SelectTrigger>
                  <SelectValue placeholder="From Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select
                onValueChange={value =>
                  form.setValue("to_account_id", parseInt(value))
                }
                defaultValue={investment.to_account_id.toString()}
              >
                <SelectTrigger>
                  <SelectValue placeholder="To Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Input
                type="number"
                placeholder="Quantity"
                step="0.01"
                {...form.register("quantity", { valueAsNumber: true })}
              />
            </div>

            <div>
              <Input
                type="number"
                placeholder="Unit Price"
                step="0.01"
                {...form.register("unit_price", { valueAsNumber: true })}
              />
            </div>

            <div>
              <Input
                type="number"
                placeholder="Fee"
                step="0.01"
                {...form.register("fee", { valueAsNumber: true })}
              />
            </div>

            <div>
              <Input
                type="number"
                placeholder="Tax"
                step="0.01"
                {...form.register("tax", { valueAsNumber: true })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update Investment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
