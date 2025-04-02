import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useBanks, useUpdateAccount } from "../../api/queries"
import { Account } from "../../types"

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["checking", "savings", "investment", "expense", "income"]),
  bank_id: z.number().min(1, "Bank is required"),
})

interface Props {
  account: Account
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditAccountDialog({ account, open, onOpenChange }: Props) {
  const { toast } = useToast()

  // Use our new hooks
  const { data: banksResponse } = useBanks(1, 100)
  const updateAccountMutation = useUpdateAccount()

  const banks = banksResponse?.items || []

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: account?.name || "",
      type: account?.type || "checking",
      bank_id: account?.bank_id || 0,
    },
  })

  useEffect(() => {
    if (account) {
      form.reset({
        name: account.name,
        type: account.type,
        bank_id: account.bank_id,
      })
    }
  }, [account, form])

  function onSubmit(values: z.infer<typeof formSchema>) {
    updateAccountMutation.mutate(
      { accountId: account.id, data: values },
      {
        onSuccess: () => {
          toast({
            title: "Account updated",
            description: "The account has been updated successfully.",
          })
          onOpenChange(false)
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to update account. Please try again.",
            variant: "destructive",
          })
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
          <DialogDescription>
            Make changes to your account here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="investment">Investment</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bank_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank</FormLabel>
                  <Select
                    onValueChange={value => field.onChange(parseInt(value))}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a bank" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {banks.map(bank => (
                        <SelectItem key={bank.id} value={bank.id.toString()}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-4 pt-4">
              <Button
                variant="outline"
                type="button"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateAccountMutation.isPending}>
                {updateAccountMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
