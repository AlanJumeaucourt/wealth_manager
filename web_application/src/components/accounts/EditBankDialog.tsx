import { API_URL } from "@/api/queries"
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
import { Bank } from "@/types"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

interface EditBankDialogProps {
  bank: Bank
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditBankDialog({
  bank,
  open,
  onOpenChange,
}: EditBankDialogProps) {
  const [name, setName] = useState(bank.name)
  const [website, setWebsite] = useState(bank.website || "")
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const updateBankMutation = useMutation({
    mutationFn: async (data: { name: string; website?: string }) => {
      const token = localStorage.getItem("access_token")
      const response = await fetch(`${API_URL}/banks/${bank.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error("Failed to update bank")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["banks"] })
      toast({
        title: "🏦 Bank Updated!",
        description: "Changes saved successfully!",
      })
      onOpenChange(false)
    },
    onError: error => {
      toast({
        title: "😅 Oops!",
        description: "Couldn't update the bank. Please try again.",
        variant: "destructive",
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) {
      toast({
        title: "📝 Hey There!",
        description: "Bank name is required!",
        variant: "destructive",
      })
      return
    }

    updateBankMutation.mutate({
      name,
      website: website || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Bank</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Bank Name</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter bank name"
                required
              />
            </div>
            <div>
              <Label htmlFor="website">Website (optional)</Label>
              <Input
                id="website"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="Enter bank website"
                type="url"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={updateBankMutation.isPending}>
              {updateBankMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
