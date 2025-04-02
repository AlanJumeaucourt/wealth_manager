import { useEffect, useCallback } from "react"

interface KeyboardShortcutOptions {
  onNew?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onHome?: () => void
  onEnd?: () => void
  onPrevPage?: () => void
  onNextPage?: () => void
  disabled?: boolean
}

export function useKeyboardShortcuts({
  onNew,
  onEdit,
  onDelete,
  onHome,
  onEnd,
  onPrevPage,
  onNextPage,
  disabled = false,
}: KeyboardShortcutOptions) {
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (disabled) return

      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable

      if (isInput) return

      switch (event.key.toLowerCase()) {
        case "n":
          event.preventDefault()
          onNew?.()
          break
        case "e":
          event.preventDefault()
          onEdit?.()
          break
        case "d":
          event.preventDefault()
          onDelete?.()
          break
        case "home":
          event.preventDefault()
          onHome?.()
          break
        case "end":
          event.preventDefault()
          onEnd?.()
          break
        case "arrowleft":
          if (event.altKey) {
            event.preventDefault()
            onPrevPage?.()
          }
          break
        case "arrowright":
          if (event.altKey) {
            event.preventDefault()
            onNextPage?.()
          }
          break
      }
    },
    [onNew, onEdit, onDelete, onHome, onEnd, onPrevPage, onNextPage, disabled]
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress)
    return () => {
      document.removeEventListener("keydown", handleKeyPress)
    }
  }, [handleKeyPress])
}
