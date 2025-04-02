import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Keyboard } from "lucide-react"
import { KeyboardShortcut } from "@/components/ui/keyboard-shortcut"

const shortcuts = [
  { key: "N", description: "Add new item" },
  { key: "E", description: "Edit selected item" },
  { key: "D", description: "Delete selected item" },
  { key: "Home", description: "Go to top of list" },
  { key: "End", description: "Go to bottom of list" },
  { key: "Alt + ←", description: "Previous page" },
  { key: "Alt + →", description: "Next page" },
]

export function KeyboardShortcutsHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Keyboard Shortcuts"
        >
          <Keyboard className="h-4 w-4" />
          <span className="sr-only">Keyboard Shortcuts</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {shortcuts.map(({ key, description }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm">{description}</span>
              <KeyboardShortcut shortcut={key} />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
