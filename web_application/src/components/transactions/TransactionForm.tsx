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
import { useDialogStore } from "@/store/dialogStore"
import { zodResolver } from "@hookform/resolvers/zod"
import { memo, useCallback, useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import * as z from "zod"
import {
  useAccounts,
  useCategoriesByType,
  useCreateTransaction,
  useUpdateTransaction,
} from "../../api/queries"
import { CategoryMetadata, Transaction } from "../../types"

const formSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.string().min(1, "Amount is required"),
  type: z.enum(["expense", "income", "transfer"]),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  date_accountability: z.string().min(1, "Accountability date is required"),
  from_account_id: z.number().min(1, "From account is required"),
  to_account_id: z.number().min(1, "To account is required"),
  stayOnPage: z.boolean().default(false),
  is_investment: z.boolean().optional().default(false),
})

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction
  defaultType?: "expense" | "income" | "transfer"
  redirectTo?: string
}

export const TransactionForm = memo(function TransactionForm({
  open,
  onOpenChange,
  transaction,
  defaultType,
  redirectTo,
}: Props) {
  const { toast } = useToast()
  const { setEditTransaction } = useDialogStore()

  const isEditMode = !!transaction

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  })

  const watchType = form.watch("type")
  const watchCategory = form.watch("category")

  const { data: accountsResponse } = useAccounts({
    per_page: 9999,
  })

  const { data: categories = [] } = useCategoriesByType(
    watchType || transaction?.type || defaultType || "expense"
  )
  const updateMutation = useUpdateTransaction()
  const createMutation = useCreateTransaction()

  useEffect(() => {
    if (isEditMode && transaction) {
      form.reset({
        description: transaction.description,
        amount: transaction.amount.toString(),
        type: transaction.type,
        category: transaction.category,
        subcategory: transaction.subcategory || "",
        date: new Date(transaction.date).toISOString().split("T")[0],
        date_accountability: transaction.date_accountability
          ? new Date(transaction.date_accountability)
              .toISOString()
              .split("T")[0]
          : new Date(transaction.date).toISOString().split("T")[0],
        from_account_id: transaction.from_account_id,
        to_account_id: transaction.to_account_id,
        stayOnPage: false,
        is_investment: transaction.is_investment,
      })
    } else {
      form.reset({
        description: "",
        amount: "",
        type: defaultType || "expense",
        category: "",
        subcategory: "",
        date: new Date().toISOString().split("T")[0],
        date_accountability: new Date().toISOString().split("T")[0],
        from_account_id: undefined,
        to_account_id: undefined,
        stayOnPage: false,
        is_investment: false,
      })
    }
  }, [transaction, isEditMode, form, defaultType])

  const handleOpenChange = useCallback(
    (shouldOpen: boolean) => {
      if (!shouldOpen) {
        if (isEditMode) {
          setEditTransaction(null)
        }
        onOpenChange(false)
        form.reset()
      } else {
        onOpenChange(true)
      }
    },
    [isEditMode, setEditTransaction, onOpenChange, form]
  )

  useEffect(() => {
    if (isEditMode && transaction && watchType !== transaction.type) {
      // form.setValue("from_account_id", undefined) // Removed due to non-optional schema
      // form.setValue("to_account_id", undefined)   // Removed due to non-optional schema
    } else if (!isEditMode) {
      // For add mode, always reset accounts when type changes
      // form.setValue("from_account_id", undefined) // Removed due to non-optional schema
      // form.setValue("to_account_id", undefined)   // Removed due to non-optional schema
    }
  }, [watchType, form, transaction, isEditMode])

  const accounts = accountsResponse?.items || []

  const categoryOptions: Option[] = useMemo(() => {
    if (!categories) return []
    return (categories as unknown as CategoryMetadata[]).map(category => ({
      value: category.name.fr,
      label: category.name.fr,
    }))
  }, [categories])

  const subcategoryOptions: Option[] = useMemo(() => {
    if (!watchCategory || !categories) return []
    const selectedCategory = (
      categories as unknown as CategoryMetadata[]
    ).find(cat => cat.name.fr === watchCategory)
    if (!selectedCategory?.subCategories) return []

    return selectedCategory.subCategories.map(
      (sub: { name: { fr: string } }) => ({
        value: sub.name.fr,
        label: sub.name.fr,
      })
    )
  }, [categories, watchCategory])

  const fromAccounts = accounts.filter(account => {
    if (!account || !account.type) return false
    switch (watchType) {
      case "expense":
      case "transfer":
        return (
          account.type === "checking" ||
          account.type === "savings" ||
          account.type === "investment" ||
          (watchType === "transfer" && account.type === "loan")
        )
      case "income":
        return account.type === "income"
      default:
        return false
    }
  })

  const toAccounts = accounts.filter(account => {
    if (!account || !account.type) return false
    switch (watchType) {
      case "expense":
        return account.type === "expense"
      case "transfer":
        return (
          account.type === "checking" ||
          account.type === "savings" ||
          account.type === "investment" ||
          account.type === "loan"
        )
      case "income":
        return account.type === "checking" || account.type === "savings"
      default:
        return false
    }
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    const { stayOnPage, ...apiData } = values

    const submitPayload = {
      ...apiData,
      amount: parseFloat(apiData.amount),
      from_account_id: apiData.from_account_id,
      to_account_id: apiData.to_account_id,
      is_investment: apiData.is_investment || false,
    };

    if (isEditMode && transaction) {
      console.log("Submitting edit data to API:", submitPayload)
      updateMutation.mutate(
        {
          id: transaction.id,
          ...(submitPayload as Omit<Transaction, "id" | "refunded_amount">),
        },
        {
          onSuccess: () => {
            toast({
              title: "Transaction Updated",
              description: "Your changes have been saved successfully.",
            })
            handleOpenChange(false)
            if (redirectTo) {
              // router.navigate({ to: redirectTo }) // Assuming router is available or passed
            }
          },
          onError: error => {
            console.error("Failed to update transaction:", error)
            toast({
              title: "Error",
              description: "Failed to update transaction. Please try again.",
              variant: "destructive",
            })
          },
        }
      )
    } else {
      console.log("Submitting new data to API:", submitPayload)
      createMutation.mutate(
        submitPayload as Omit<Transaction, "id" | "refunded_amount">,
        {
          onSuccess: () => {
            toast({
              title: "Transaction Created",
              description: "Your transaction has been recorded successfully.",
            })
            if (stayOnPage) {
              form.reset(currentValues => ({
                ...currentValues,
                description: "",
                amount: "",
                date: new Date().toISOString().split("T")[0],
                date_accountability: new Date().toISOString().split("T")[0],
              }))
            } else {
              handleOpenChange(false)
            }
          },
          onError: error => {
            console.error("Failed to create transaction:", error)
            toast({
              title: "Error",
              description: "Failed to create transaction. Please try again.",
              variant: "destructive",
            })
          },
        }
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[700px] max-h-[95vh] overflow-y-auto"
        aria-describedby={isEditMode ? "edit-transaction-description" : "add-transaction-description"}
      >
        <DialogHeader>
          <DialogTitle className="text-xl mb-2">
            {isEditMode ? "Edit Transaction" : "Add New Transaction"}
          </DialogTitle>
          <div id={isEditMode ? "edit-transaction-description" : "add-transaction-description"} className="mt-2">
            {/* Description content if any */}
          </div>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Description</FormLabel>
                  <FormControl>
                    <Input
                      className="h-12"
                      placeholder="Enter description"
                      {...field}
                    />
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
              name="type"
              render={({ field }) => (
                <FormItem className="col-span-1 md:col-span-2">
                  <FormLabel className="text-base">Transaction Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-base">Category</FormLabel>
                    <FormControl>
                      <ComboboxInput
                        options={categoryOptions}
                        emptyMessage="No category found"
                        value={
                          field.value
                            ? categoryOptions.find(option => option.value === field.value) || { value: field.value, label: field.value }
                            : undefined
                        }
                        onValueChange={option => {
                          form.setValue("category", option.value)
                          form.setValue("subcategory", "")
                        }}
                        placeholder="Search category..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(watchType === "expense" || (isEditMode && transaction?.type === "expense")) && subcategoryOptions.length > 0 && (
                <FormField
                  control={form.control}
                  name="subcategory"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-base">Subcategory</FormLabel>
                      <FormControl>
                        <ComboboxInput
                          options={subcategoryOptions}
                          emptyMessage="No subcategory found"
                          value={
                            field.value
                              ? subcategoryOptions.find(option => option.value === field.value) || { value: field.value, label: field.value }
                              : undefined
                          }
                          onValueChange={option => {
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
                          label: `${account.name} (${account.type})`,
                        }))}
                        emptyMessage="No account found"
                        value={
                          field.value
                            ? {
                                value: field.value.toString(),
                                label:
                                  fromAccounts.find(a => a.id === field.value)
                                    ?.name || "",
                              }
                            : undefined
                        }
                        onValueChange={option => {
                          form.setValue(
                            "from_account_id",
                            parseInt(option.value)
                          )
                        }}
                        placeholder={
                          watchType === "expense"
                            ? "Search source account"
                            : watchType === "transfer"
                              ? "Search source account"
                              : "Search income source"
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
                          label: `${account.name} (${account.type})`,
                        }))}
                        emptyMessage="No account found"
                        value={
                          field.value
                            ? {
                                value: field.value.toString(),
                                label:
                                  toAccounts.find(a => a.id === field.value)
                                    ?.name || "",
                              }
                            : undefined
                        }
                        onValueChange={option => {
                          form.setValue("to_account_id", parseInt(option.value))
                        }}
                        placeholder={
                          watchType === "expense"
                            ? "Search expense account"
                            : watchType === "transfer"
                              ? "Search source account"
                              : "Search destination account"
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!isEditMode && (
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
                      <FormLabel>Stay on page after adding transaction</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end space-x-4 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="w-28 h-11"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isEditMode ? updateMutation.isPending : createMutation.isPending}
                className="w-28 h-11"
              >
                {isEditMode
                  ? updateMutation.isPending
                    ? "Saving..."
                    : "Save Changes"
                  : createMutation.isPending
                    ? "Creating..."
                    : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
})
