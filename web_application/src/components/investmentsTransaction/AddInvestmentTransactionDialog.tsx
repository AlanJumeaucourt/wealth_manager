import {
  useAccounts,
  useAssets,
  useCreateInvestment,
  useStockHistory,
  useUpdateInvestment,
} from "@/api/queries"
import { Button } from "@/components/ui/button"
import { ComboboxInput } from "@/components/ui/comboboxInput"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Investment } from "@/types"

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
  user_id: z.number(),
})

const investment_typeS = [
  {
    value: "Buy",
    label: "Buy",
    icon: <TrendingUp className="h-4 w-4 text-green-500" />,
  },
  {
    value: "Sell",
    label: "Sell",
    icon: <TrendingDown className="h-4 w-4 text-red-500" />,
  },
  {
    value: "Deposit",
    label: "Deposit",
    icon: <ArrowDownIcon className="h-4 w-4 text-blue-500" />,
  },
  {
    value: "Withdrawal",
    label: "Withdrawal",
    icon: <ArrowUpIcon className="h-4 w-4 text-orange-500" />,
  },
  {
    value: "Dividend",
    label: "Dividend",
    icon: <ArrowDownIcon className="h-4 w-4 text-purple-500" />,
  },
]

interface AddInvestmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  investment?: Investment
}

function accountsToOptions(accounts: Array<{ id: number; name: string }>) {
  return accounts.map(account => ({
    value: account.id.toString(),
    label: account.name,
  }))
}

function assetsToOptions(
  assets: Array<{ id: number; name: string; symbol: string }>
) {
  return assets.map(asset => ({
    value: asset.id.toString(),
    label: `${asset.name} (${asset.symbol})`,
  }))
}

type FormData = z.infer<typeof formSchema>

export function AddInvestmentDialog({
  open,
  onOpenChange,
  investment,
}: AddInvestmentDialogProps) {
  const { toast } = useToast()
  const createMutation = useCreateInvestment()
  const updateMutation = useUpdateInvestment()
  const { data: accountsResponse } = useAccounts({
    type: "investment",
    per_page: 1000,
  })
  const { data: assetsResponse } = useAssets()

  const accounts = accountsResponse?.items || []
  const assetOptions = assetsToOptions(assetsResponse?.items || [])

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      investment_type: investment?.investment_type || "Buy" as const,
      asset_id: investment?.asset_id || 0,
      date: investment?.date
        ? new Date(investment.date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      fee: investment?.fee || 0,
      from_account_id: investment?.from_account_id || 0,
      quantity: investment?.quantity || 0,
      tax: investment?.tax || 0,
      to_account_id: investment?.to_account_id || 0,
      unit_price: investment?.unit_price || 0,
      user_id: parseInt(localStorage.getItem("user_id") || "0"),
    },
  })

  const accountOptions = accountsToOptions(accounts)

  const selectedAsset = useMemo(
    () =>
      assetsResponse?.items.find(
        asset => asset.id.toString() === form.getValues("asset_id")?.toString()
      ),
    [assetsResponse?.items, form.getValues("asset_id")]
  )

  const { data: stockHistory } = useStockHistory(selectedAsset?.symbol)

  const selectedDate = form.watch("date")

  const investmentType = form.watch("investment_type")

  useEffect(() => {
    if (stockHistory && selectedDate) {
      const priceData = stockHistory.find(p => p.date === selectedDate)
      if (priceData) {
        const currentPrice = form.getValues("unit_price")
        if (currentPrice === 0) {
          form.setValue("unit_price", Number(priceData.close.toFixed(4)))
        }
      }
    }
  }, [stockHistory, selectedDate, form])

  useEffect(() => {
    if (investmentType === "Dividend") {
      form.setValue("quantity", 1)
    }
  }, [investmentType, form])

  useEffect(() => {
    if (investment) {
      form.reset({
        investment_type: investment.investment_type,
        asset_id: investment.asset_id,
        date: new Date(investment.date).toISOString().split("T")[0],
        fee: investment.fee,
        from_account_id: investment.from_account_id,
        quantity: investment.quantity,
        tax: investment.tax,
        to_account_id: investment.to_account_id,
        unit_price: investment.unit_price,
        user_id: parseInt(localStorage.getItem("user_id") || "0"),
      })
    }
  }, [investment, form])

  const onSubmit = async (data: FormData) => {
    try {
      if (investment) {
        await updateMutation.mutateAsync({
          id: investment.transaction_id,
          data: {
            ...data,
            date: new Date(data.date).toISOString(),
          },
        })
        toast({
          title: "Investment Updated",
          description: "Your investment has been updated successfully.",
        })
      } else {
        await createMutation.mutateAsync({
          ...data,
          date: new Date(data.date).toISOString(),
        })
        toast({
          title: "Investment Added",
          description: "Your investment has been added successfully.",
        })
      }
      onOpenChange(false)
      if (!investment) {
        form.reset()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${investment ? 'update' : 'add'} investment. Please try again.`,
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{investment ? "Edit Investment Transaction" : "Add Investment Transaction"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Activity Type */}
            <div className="col-span-2">
              <Label>Transaction Type</Label>
              <Select
                onValueChange={value =>
                  form.setValue("investment_type", value as any)
                }
                defaultValue={form.getValues("investment_type")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {investment_typeS.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        {type.icon}
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Asset */}
            <div className="col-span-2">
              <Label>Asset</Label>
              <ComboboxInput
                options={assetOptions}
                value={assetOptions.find(
                  opt => opt.value === form.getValues("asset_id")?.toString()
                )}
                onValueChange={option => {
                  form.setValue("asset_id", parseInt(option.value))
                }}
                placeholder="Select asset"
                emptyMessage="No assets found"
                isLoading={!assetsResponse}
              />
            </div>

            {/* Date */}
            <div className="col-span-2">
              <Label>Date</Label>
              <Input
                type="date"
                {...form.register("date")}
                className="w-full"
              />
            </div>

            {/* Accounts */}
            <div>
              <Label>From Account</Label>
              <ComboboxInput
                options={accountOptions}
                value={accountOptions.find(
                  opt =>
                    opt.value === form.getValues("from_account_id")?.toString()
                )}
                onValueChange={option => {
                  form.setValue("from_account_id", parseInt(option.value))
                }}
                placeholder="Select source account"
                emptyMessage="No accounts found"
                isLoading={!accountsResponse}
              />
            </div>

            <div>
              <Label>To Account</Label>
              <ComboboxInput
                options={accountOptions}
                value={accountOptions.find(
                  opt =>
                    opt.value === form.getValues("to_account_id")?.toString()
                )}
                onValueChange={option => {
                  form.setValue("to_account_id", parseInt(option.value))
                }}
                placeholder="Select destination account"
                emptyMessage="No accounts found"
                isLoading={!accountsResponse}
              />
            </div>

            {/* Transaction Details */}
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                placeholder="0.00"
                step="0.01"
                {...form.register("quantity", { valueAsNumber: true })}
                disabled={investmentType === "Dividend"}
              />
            </div>

            <div>
              <Label>Unit Price</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.0000"
                  step="0.0001"
                  {...form.register("unit_price", { valueAsNumber: true })}
                />
                {stockHistory && selectedDate && (
                  <div className="absolute right-0 top-0 h-full flex items-center pr-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-primary"
                      onClick={() => {
                        const priceData = stockHistory.find(
                          p => p.date === selectedDate
                        )
                        if (priceData) {
                          form.setValue(
                            "unit_price",
                            Number(priceData.close.toFixed(4))
                          )
                        }
                      }}
                    >
                      Use market price
                    </Button>
                  </div>
                )}
              </div>
              {stockHistory && selectedDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  Market price:{" "}
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: "EUR",
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4,
                  }).format(
                    stockHistory.find(p => p.date === selectedDate)?.close || 0
                  )}
                </p>
              )}
            </div>

            {/* Fees and Taxes */}
            <div>
              <Label>Fee</Label>
              <Input
                type="number"
                placeholder="0.00"
                step="0.01"
                {...form.register("fee", { valueAsNumber: true })}
              />
            </div>

            <div>
              <Label>Tax</Label>
              <Input
                type="number"
                placeholder="0.00"
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
            <Button
              type="submit"
              disabled={investment ? updateMutation.isPending : createMutation.isPending}
            >
              {investment
                ? (updateMutation.isPending ? "Updating..." : "Update Investment")
                : (createMutation.isPending ? "Adding..." : "Add Investment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
