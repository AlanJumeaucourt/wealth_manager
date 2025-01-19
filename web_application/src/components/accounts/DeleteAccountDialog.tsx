import { useDeleteAccount } from "@/api/queries"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Account } from "@/types"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"

interface DeleteAccountDialogProps {
  account: Account | null
  open: boolean
  onOpenChange: (open: boolean) => void
  redirectTo?: string
}

export function DeleteAccountDialog({
  account,
  open,
  onOpenChange,
  redirectTo = "/accounts"
}: DeleteAccountDialogProps) {
  const [confirmName, setConfirmName] = useState("")
  const [acceptRisks, setAcceptRisks] = useState(false)
  const { toast } = useToast()
  const navigate = useNavigate()
  const deleteMutation = useDeleteAccount()

  if (!account) return null

  const isConfirmNameValid = confirmName === account.name
  const canDelete = isConfirmNameValid && acceptRisks

  const handleDelete = async () => {
    if (!canDelete || !account) return

    try {
      console.log("Deleting account", account.id)
      await deleteMutation.mutateAsync(account.id)
      toast({
        title: "Account Deleted",
        description: "The account has been successfully deleted.",
      })
      setConfirmName("")
      setAcceptRisks(false)
      onOpenChange(false)
      if (redirectTo) {
        navigate({
          to: redirectTo as any,
          params: {},
          search: {}
        })
      }
    } catch (error) {
      console.error("Error deleting account", error)
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-red-500">💰 Delete Account: {account.name}</DialogTitle>
          <DialogDescription className="space-y-3 pt-4">
            <div className="text-red-500 font-medium">
              This action cannot be undone. This will:
            </div>
            <ul className="list-disc pl-4 space-y-2 text-muted-foreground">
              <li>Permanently delete the account "{account.name}"</li>
              <li>Remove all transactions associated with this account</li>
              <li>Delete all historical balance data</li>
            </ul>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>
              Type <span className="font-medium">{account.name}</span> to confirm:
            </Label>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={`Type ${account.name} to confirm`}
              className={!isConfirmNameValid && confirmName ? "border-red-500" : ""}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="acceptRisks"
              checked={acceptRisks}
              onCheckedChange={(checked) => setAcceptRisks(checked as boolean)}
            />
            <Label
              htmlFor="acceptRisks"
              className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I understand that this action will delete all associated data and cannot be reversed
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => {
              setConfirmName("")
              setAcceptRisks(false)
              onOpenChange(false)
            }}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || deleteMutation.isPending}
            className="gap-2"
          >
            {deleteMutation.isPending ? (
              <>
                <span className="animate-spin">⏳</span>
                Deleting...
              </>
            ) : (
              <>
                🗑️ Delete Account
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
