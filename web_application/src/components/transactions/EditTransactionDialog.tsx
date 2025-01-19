import { Button } from "@/components/ui/button"
import { ComboboxInput, type Option } from "@/components/ui/comboboxInput"
import {
  Dialog,
  DialogContent,
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
import { useDialogStore } from "@/store/dialogStore"
import { zodResolver } from "@hookform/resolvers/zod"
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useAccounts, useCategoriesByType, useUpdateTransaction } from "../../api/queries"
import { Account, CategoryMetadata } from "../../types"

const formSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.string().min(1, "Amount is required"),
  type: z.enum(['expense', 'income', 'transfer']),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  date_accountability: z.string().min(1, "Accountability date is required"),
  from_account_id: z.number().min(1, "From account is required").optional(),
  to_account_id: z.number().min(1, "To account is required").optional(),
})

interface Props {
  redirectTo?: string
}

export const EditTransactionDialog = memo(function EditTransactionDialog({
  redirectTo
}: Props) {
  const { toast } = useToast()
  const [categoryOpen, setCategoryOpen] = useState(false)
  const { editTransaction: transaction, setEditTransaction } = useDialogStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: transaction ? {
      description: transaction.description,
      amount: transaction.amount.toString(),
      type: transaction.type,
      category: transaction.category,
      subcategory: transaction.subcategory || "",
      date: new Date(transaction.date).toISOString().split('T')[0],
      date_accountability: transaction.date_accountability ? new Date(transaction.date_accountability).toISOString().split('T')[0] : new Date(transaction.date).toISOString().split('T')[0],
      from_account_id: transaction.from_account_id,
      to_account_id: transaction.to_account_id,
    } : undefined,
  })

  const watchType = form.watch("type")
  const watchCategory = form.watch("category")

  const { data: accountsResponse } = useAccounts({
    per_page: 100,
  })

  const { data: categories = [] } = useCategoriesByType(watchType || 'expense')
  const updateMutation = useUpdateTransaction()

  // Reset form when transaction changes
  useEffect(() => {
    if (transaction) {
      form.reset({
        description: transaction.description,
        amount: transaction.amount.toString(),
        type: transaction.type,
        category: transaction.category,
        subcategory: transaction.subcategory || "",
        date: new Date(transaction.date).toISOString().split('T')[0],
        date_accountability: transaction.date_accountability ? new Date(transaction.date_accountability).toISOString().split('T')[0] : new Date(transaction.date).toISOString().split('T')[0],
        from_account_id: transaction.from_account_id,
        to_account_id: transaction.to_account_id,
      })
    }
  }, [transaction, form])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setEditTransaction(null)
    }
  }, [setEditTransaction])

  // Update account fields when type changes
  useEffect(() => {
    if (transaction && watchType !== transaction.type) {
      form.setValue('from_account_id', undefined as any)
      form.setValue('to_account_id', undefined as any)
    }
  }, [watchType, form, transaction])

  const accounts = accountsResponse?.items || []

  const categoryOptions: Option[] = useMemo(() => {
    return (categories as CategoryMetadata[]).map(category => ({
      value: category.name.fr,
      label: category.name.fr
    }))
  }, [categories])

  const subcategoryOptions: Option[] = useMemo(() => {
    if (!watchCategory) return []
    const selectedCategory = (categories as CategoryMetadata[]).find(
      cat => cat.name.fr === watchCategory
    )
    if (!selectedCategory?.subCategories) return []

    return selectedCategory.subCategories.map(sub => ({
      value: sub.name.fr,
      label: sub.name.fr
    }))
  }, [categories, watchCategory])

  // Filter accounts based on type
  const fromAccounts = accounts.filter((account: Account) => {
    if (watchType === 'expense') return account.type !== 'income'
    if (watchType === 'transfer') return account.type !== 'income' && account.type !== 'expense'
    return false
  })

  const toAccounts = accounts.filter((account: Account) => {
    if (watchType === 'income') return account.type !== 'expense'
    if (watchType === 'transfer') return account.type !== 'income' && account.type !== 'expense'
    return false
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!transaction) return

    console.log('Edit form submitted with values:', values)
    const submitData = {
      description: values.description,
      amount: values.amount,
      type: values.type,
      category: values.category,
      subcategory: values.subcategory,
      date: values.date,
      date_accountability: values.date_accountability,
      from_account_id: values.type === 'income' ? undefined : values.from_account_id,
      to_account_id: values.type === 'expense' ? undefined : values.to_account_id,
    }
    console.log('Submitting edit data to API:', submitData)
    updateMutation.mutate(
      {
        id: transaction.id,
        data: submitData
      },
      {
        onSuccess: () => {
          console.log('Transaction updated successfully')
          toast({
            title: "Transaction Updated",
            description: "Your changes have been saved successfully.",
          })
          handleOpenChange(false)
        },
        onError: (error) => {
          console.error('Failed to update transaction:', error)
          toast({
            title: "Error",
            description: "Failed to update transaction. Please try again.",
            variant: "destructive",
          })
        }
      }
    )
  }

  if (!transaction) return null

  return (
    <Dialog open={!!transaction} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px]" aria-describedby="edit-transaction-description">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
          <div id="edit-transaction-description" className="mt-2">
            {/* Description content */}
          </div>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter amount"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <ComboboxInput
                        options={categoryOptions}
                        emptyMessage="No category found"
                        value={categoryOptions.find(
                          option => option.value === field.value
                        )}
                        onValueChange={(option) => {
                          field.onChange(option.value)
                          // Reset subcategory when category changes
                          form.setValue("subcategory", "")
                        }}
                        placeholder="Search category..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchType === 'expense' && subcategoryOptions.length > 0 && (
                <FormField
                  control={form.control}
                  name="subcategory"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Subcategory</FormLabel>
                      <FormControl>
                        <ComboboxInput
                          options={subcategoryOptions}
                          emptyMessage="No subcategory found"
                          value={subcategoryOptions.find(
                            option => option.value === field.value
                          )}
                          onValueChange={(option) => {
                            field.onChange(option.value)
                          }}
                          placeholder="Search subcategory..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date_accountability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {(watchType === 'expense' || watchType === 'transfer') && (
                <FormField
                  control={form.control}
                  name="from_account_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Account</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {fromAccounts.map((account: Account) => (
                            <SelectItem
                              key={account.id}
                              value={account.id.toString()}
                            >
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {(watchType === 'income' || watchType === 'transfer') && (
                <FormField
                  control={form.control}
                  name="to_account_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To Account</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {toAccounts.map((account: Account) => (
                            <SelectItem
                              key={account.id}
                              value={account.id.toString()}
                            >
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
})
