import { useBanks, useCreateAccount } from "@/api/queries"
import { Button } from "@/components/ui/button"
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
import { ACCOUNT_TYPE_LABELS } from "@/constants"
import { useToast } from "@/hooks/use-toast"
import { Bank } from "@/types"
import { useEffect, useState } from "react"
import { DeleteBankDialog } from "./DeleteBankDialog"
import { EditBankDialog } from "./EditBankDialog"

interface AddAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddAccountDialog({
  open,
  onOpenChange,
}: AddAccountDialogProps) {
  const [name, setName] = useState("")
  const [type, setType] = useState("")
  const [bankId, setBankId] = useState<string | undefined>(undefined)
  const { toast } = useToast()
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null)
  const [deletingBank, setDeletingBank] = useState<Bank | null>(null)
  const [editingBank, setEditingBank] = useState<Bank | null>(null)

  // Use our hooks
  const { data: banksResponse } = useBanks(1, 100)
  const createAccountMutation = useCreateAccount()

  const banks = banksResponse?.items || []

  useEffect(() => {
    function handleKeyPress(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable

      if (isInput) return

      if (!selectedBankId) return

      const selectedBank = banks.find(b => b.id === selectedBankId)
      if (!selectedBank) return

      if (event.key === "e") {
        event.preventDefault()
        setEditingBank(selectedBank)
      }

      if (event.key === "d") {
        event.preventDefault()
        setDeletingBank(selectedBank)
      }
    }

    document.addEventListener("keydown", handleKeyPress)
    return () => document.removeEventListener("keydown", handleKeyPress)
  }, [selectedBankId, banks])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name || !type) {
      toast({
        title: "🤔 Hold Up!",
        description: "We need both a name and type for your account.",
        variant: "destructive",
      })
      return
    }

    createAccountMutation.mutate(
      {
        name,
        type,
        bank_id: bankId && bankId !== "none" ? parseInt(bankId) : undefined,
      },
      {
        onSuccess: () => {
          toast({
            title: "🎉 Account Created!",
            description: "Your new money home is ready to go!",
            variant: "default",
          })
          setName("")
          setType("")
          setBankId(undefined)
          onOpenChange(false)
        },
        onError: () => {
          toast({
            title: "😅 Oops!",
            description:
              "The account creation hit a snag. Let's try that again!",
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
          <DialogTitle>Add New Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Account Name</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter account name"
                required
              />
            </div>
            <div>
              <Label htmlFor="type">Account Type</Label>
              <Select value={type} onValueChange={setType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="bank">Bank (optional)</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a bank" />
                </SelectTrigger>
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
                            e.preventDefault()
                            e.stopPropagation()
                            setEditingBank(bank)
                          }}
                        ></Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            setDeletingBank(bank)
                          }}
                        ></Button>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={createAccountMutation.isPending}>
              {createAccountMutation.isPending
                ? "Creating..."
                : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {deletingBank && (
        <DeleteBankDialog
          bank={deletingBank}
          open={!!deletingBank}
          onOpenChange={open => !open && setDeletingBank(null)}
        />
      )}

      {editingBank && (
        <EditBankDialog
          bank={editingBank}
          open={!!editingBank}
          onOpenChange={open => !open && setEditingBank(null)}
        />
      )}
    </Dialog>
  )
}
