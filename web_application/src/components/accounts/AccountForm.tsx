import { useBanks, useCreateAccount, useUpdateAccount } from "@/api/queries";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_TYPE_LABELS, AccountType } from "@/constants";
import { useToast } from "@/hooks/use-toast";
import { Account, Bank } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { DeleteBankDialog } from "./DeleteBankDialog";
import { EditBankDialog } from "./EditBankDialog";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(Object.keys(ACCOUNT_TYPE_LABELS) as [AccountType, ...AccountType[]]),
  bank_id: z.number().optional().nullable(),
});

type AccountFormValues = z.infer<typeof formSchema>;

interface AccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account; // If account is provided, it's an edit operation
}

export function AccountForm({
  open,
  onOpenChange,
  account,
}: AccountFormProps) {
  const { toast } = useToast();
  const isEditMode = !!account;

  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [deletingBank, setDeletingBank] = useState<Bank | null>(null);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);

  // API Hooks
  const { data: banksResponse } = useBanks(); // Assuming useBanks takes no args or options for pagination
  const createAccountMutation = useCreateAccount();
  const updateAccountMutation = useUpdateAccount();

  const banks = banksResponse?.items || [];

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: undefined, // Default to undefined, let placeholder show
      bank_id: undefined,
    },
  });

  useEffect(() => {
    if (account) {
      form.reset({
        name: account.name,
        type: account.type,
        bank_id: account.bank_id,
      });
    } else {
      form.reset({ // Reset for add mode
        name: "",
        type: undefined,
        bank_id: undefined,
      });
    }
  }, [account, form, open]); // Reset form when dialog opens or account changes


  useEffect(() => {
    function handleKeyPress(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInput) return;
      if (!selectedBankId) return;

      const currentSelectedBank = banks.find(b => b.id === selectedBankId);
      if (!currentSelectedBank) return;

      if (event.key === "e") {
        event.preventDefault();
        setEditingBank(currentSelectedBank);
      }

      if (event.key === "d") {
        event.preventDefault();
        setDeletingBank(currentSelectedBank);
      }
    }

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [selectedBankId, banks]);

  const onSubmit = async (values: AccountFormValues) => {
    const payload = {
      ...values,
      bank_id: values.bank_id === null || values.bank_id === undefined || values.bank_id === 0 ? undefined : Number(values.bank_id),
    };

    if (isEditMode && account) {
      updateAccountMutation.mutate(
        { id: account.id, ...payload },
        {
          onSuccess: () => {
            toast({
              title: "🎉 Account Updated!",
              description: "Your money home has been refreshed.",
            });
            onOpenChange(false);
          },
          onError: (error: any) => {
            toast({
              title: "😅 Oops!",
              description: error?.message || "The account update hit a snag. Let's try that again!",
              variant: "destructive",
            });
          },
        }
      );
    } else {
      createAccountMutation.mutate(
        payload,
        {
          onSuccess: () => {
            toast({
              title: "🎉 Account Created!",
              description: "Your new money home is ready to go!",
            });
            onOpenChange(false);
          },
          onError: (error: any) => {
            toast({
              title: "😅 Oops!",
              description: error?.message || "The account creation hit a snag. Let's try that again!",
              variant: "destructive",
            });
          },
        }
      );
    }
  };

  const dialogTitle = isEditMode ? "Edit Account" : "Add New Account";
  const dialogDescription = isEditMode
    ? "Make changes to your account here. Click save when you're done."
    : "Fill in the details to add a new account.";
  const submitButtonText = isEditMode ? "Save Changes" : "Create Account";
  const submittingButtonText = isEditMode ? "Saving..." : "Creating...";

  const isSubmitting = createAccountMutation.isPending || updateAccountMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {dialogDescription && <DialogDescription>{dialogDescription}</DialogDescription>}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter account name" />
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
                  <FormLabel>Account Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(ACCOUNT_TYPE_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
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
                  <FormLabel>Bank (optional)</FormLabel>
                  <Select
                     onValueChange={value => field.onChange(value === "none" ? null : parseInt(value))}
                     value={field.value?.toString() === "0" || field.value === null || field.value === undefined ? "none" : field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a bank" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No Bank</SelectItem>
                      {banks.map(bank => (
                        <SelectItem
                          key={bank.id}
                          value={bank.id.toString()}
                          className="flex justify-between items-center group relative"
                          onMouseEnter={() => setSelectedBankId(bank.id)}
                          onMouseLeave={() => setSelectedBankId(null)}
                          onFocus={() => setSelectedBankId(bank.id)}
                          onBlur={() => setSelectedBankId(null)}
                        >
                          {bank.name}
                          <span className="opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity absolute right-2 flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingBank(bank);
                              }}
                            >
                              {/* Using an icon or text like 'E' would be better here */}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeletingBank(bank);
                              }}
                            >
                              {/* Using an icon or text like 'D' would be better here */}
                            </Button>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="mt-6">
               <Button
                variant="outline"
                type="button"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? submittingButtonText : submitButtonText}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {deletingBank && (
        <DeleteBankDialog
          bank={deletingBank}
          open={!!deletingBank}
          onOpenChange={openDialog => !openDialog && setDeletingBank(null)}
        />
      )}

      {editingBank && (
        <EditBankDialog
          bank={editingBank}
          open={!!editingBank}
          onOpenChange={openDialog => !openDialog && setEditingBank(null)}
        />
      )}
    </Dialog>
  );
}
