import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { CategoryMetadata } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useAccounts, useCategoriesByType, useCreateTransaction } from "../../api/queries"

const formSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.string().min(1, "Amount is required"),
  type: z.enum(['expense', 'income', 'transfer']),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  date_accountability: z.string().min(1, "Accountability date is required"),
  from_account_id: z.number().min(1, "From account is required"),
  to_account_id: z.number().min(1, "To account is required"),
  stayOnPage: z.boolean().default(false),
})

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultType?: string
}

export function AddTransactionDialog({ open, onOpenChange, defaultType }: Props) {
  const { toast } = useToast()
  const [categoryOpen, setCategoryOpen] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: (defaultType || 'expense') as 'expense' | 'income' | 'transfer',
      date: new Date().toISOString().split('T')[0],
      date_accountability: new Date().toISOString().split('T')[0],
      stayOnPage: false,
    },
  })

  // Add form validation debugging
  const formState = form.formState
  console.log('Form state:', {
    isDirty: formState.isDirty,
    isValid: formState.isValid,
    errors: formState.errors,
  })

  // Use our new hooks
  const { data: accountsResponse } = useAccounts({
    per_page: 100
  })
  const createTransactionMutation = useCreateTransaction()

  const accounts = accountsResponse?.items || []
  const watchType = form.watch("type")
  const watchCategory = form.watch("category")
  const { data: categories = [] } = useCategoriesByType(watchType)

  // Filter accounts based on type
  const fromAccounts = accounts.filter(account => {
    if (!account || !account.type) {
      console.warn('Invalid account object:', account)
      return false
    }

    switch (watchType) {
      case 'expense':
        return account.type === 'checking' || account.type === 'savings' || account.type === 'investment'
      case 'transfer':
        return account.type === 'checking' || account.type === 'savings' || account.type === 'investment'
      case 'income':
        return account.type === 'income'
      default:
        console.warn('Unknown transaction type:', watchType)
        return false
    }
  })

  const toAccounts = accounts.filter(account => {
    if (!account || !account.type) {
      console.warn('Invalid account object:', account)
      return false
    }

    switch (watchType) {
      case 'expense':
        return account.type === 'expense'
      case 'transfer':
        return account.type === 'checking' || account.type === 'savings' || account.type === 'investment'
      case 'income':
        return account.type === 'checking' || account.type === 'savings'
      default:
        console.warn('Unknown transaction type:', watchType)
        return false
    }
  })

  // Update account fields when type changes
  useEffect(() => {
    form.setValue('from_account_id', undefined as any)
    form.setValue('to_account_id', undefined as any)
  }, [watchType, form])

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log('Form submitted with values:', values)
    const { stayOnPage, ...submitData } = values

    console.log('Submitting data to API:', submitData)
    createTransactionMutation.mutate(submitData, {
      onSuccess: () => {
        console.log('Transaction created successfully')
        toast({
          title: "Transaction Created",
          description: "Your transaction has been recorded successfully.",
        })

        if (stayOnPage) {
          form.reset((formValues) => ({
            ...formValues,
            description: '',
            amount: '',
            category: '',
            date: new Date().toISOString().split('T')[0],
            date_accountability: new Date().toISOString().split('T')[0],
            from_account_id: undefined as any,
            to_account_id: undefined as any,
          }))
        } else {
          form.reset()
          onOpenChange(false)
        }
      },
      onError: (error) => {
        console.error('Failed to create transaction:', error)
        toast({
          title: "Error",
          description: "Failed to create transaction. Please try again.",
          variant: "destructive",
        })
      }
    })
  }

  // Inside the component, update the category options
  const categoryOptions: Option[] = useMemo(() => {
    if (!categories) return []
    return (categories as CategoryMetadata[]).map(category => ({
      value: category.name.fr,
      label: category.name.fr
    }))
  }, [categories])

  const subcategoryOptions: Option[] = useMemo(() => {
    if (!watchCategory || !categories) return []
    const selectedCategory = (categories as CategoryMetadata[]).find(
      cat => cat.name.fr === watchCategory
    )
    if (!selectedCategory?.subCategories) return []

    return selectedCategory.subCategories.map((sub: { name: { fr: string } }) => ({
      value: sub.name.fr,
      label: sub.name.fr
    }))
  }, [watchCategory, categories])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl mb-2">Add New Transaction</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel className="text-base">Description</FormLabel>
                    <FormControl>
                      <Input className="h-12" placeholder="Enter description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel className="text-base">Transaction Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-12">
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

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Amount</FormLabel>
                    <FormControl>
                      <Input
                        className="h-12"
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
                  <FormItem>
                    <FormLabel className="text-base">Category</FormLabel>
                    <FormControl>
                      <ComboboxInput
                        options={categoryOptions}
                        emptyMessage="No category found"
                        value={field.value ? { value: field.value, label: field.value } : undefined}
                        onValueChange={(option) => {
                          form.setValue("category", option.value)
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
                    <FormItem>
                      <FormLabel className="text-base">Subcategory</FormLabel>
                      <FormControl>
                        <ComboboxInput
                          options={subcategoryOptions}
                          emptyMessage="No subcategory found"
                          value={field.value ? { value: field.value, label: field.value } : undefined}
                          onValueChange={(option) => {
                            form.setValue("subcategory", option.value)
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
                    <FormLabel className="text-base">Transaction Date</FormLabel>
                    <FormControl>
                      <Input className="h-12" type="date" {...field} />
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
                    <FormLabel className="text-base">Budget Date</FormLabel>
                    <FormControl>
                      <Input className="h-12" type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="from_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">From Account</FormLabel>
                    <FormControl>
                      <ComboboxInput
                        options={fromAccounts.map(account => ({
                          value: account.id.toString(),
                          label: `${account.name} (${account.type})`
                        }))}
                        emptyMessage="No account found"
                        value={field.value ? {
                          value: field.value.toString(),
                          label: fromAccounts.find(a => a.id === field.value)?.name || ""
                        } : undefined}
                        onValueChange={(option) => {
                          form.setValue("from_account_id", parseInt(option.value))
                        }}
                        placeholder={
                          watchType === 'expense' ? "Search spending account" :
                          watchType === 'transfer' ? "Search source account" :
                          "Search income source"
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="to_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">To Account</FormLabel>
                    <FormControl>
                      <ComboboxInput
                        options={toAccounts.map(account => ({
                          value: account.id.toString(),
                          label: `${account.name} (${account.type})`
                        }))}
                        emptyMessage="No account found"
                        value={field.value ? {
                          value: field.value.toString(),
                          label: toAccounts.find(a => a.id === field.value)?.name || ""
                        } : undefined}
                        onValueChange={(option) => {
                          form.setValue("to_account_id", parseInt(option.value))
                        }}
                        placeholder={
                          watchType === 'expense' ? "Search expense category" :
                          watchType === 'transfer' ? "Search destination account" :
                          "Search receiving account"
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="stayOnPage"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Stay on page after adding transaction
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-4 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-28 h-11"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTransactionMutation.isPending}
                className="w-28 h-11"
              >
                {createTransactionMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
