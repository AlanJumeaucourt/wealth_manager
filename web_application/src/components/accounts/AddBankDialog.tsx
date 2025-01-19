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
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"
import { useCreateBank } from "../../api/queries"

interface AddBankDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddBankDialog({ open, onOpenChange }: AddBankDialogProps) {
  const [name, setName] = useState("")
  const [website, setWebsite] = useState("")
  const { toast } = useToast()

  const createBankMutation = useCreateBank()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name) {
      toast({
        title: "📝 Hey There!",
        description: "We need a name for your bank!",
        variant: "destructive",
      })
      return
    }

    createBankMutation.mutate(
      {
        name,
        website: website || undefined,
      },
      {
        onSuccess: () => {
          toast({
            title: "🏦 Bank Added!",
            description: "Your new bank is ready for business!",
            variant: "default",
          })
          setName("")
          setWebsite("")
          onOpenChange(false)
        },
        onError: () => {
          toast({
            title: "💸 Oops!",
            description: "The bank didn't make it to the vault. Try again?",
            variant: "destructive",
          })
        }
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Bank</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Bank Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter bank name"
                required
              />
            </div>
            <div>
              <Label htmlFor="website">Website (optional)</Label>
              <Input
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="Enter bank website"
                type="url"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="submit"
              disabled={createBankMutation.isPending}
            >
              {createBankMutation.isPending ? "Adding..." : "Add Bank"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
