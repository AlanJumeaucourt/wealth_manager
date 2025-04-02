import * as React from "react"
import { createContext, useContext, useState } from "react"

interface KeyboardShortcutsContextType {
  isEnabled: boolean
  enable: () => void
  disable: () => void
  toggle: () => void
}

const KeyboardShortcutsContext = createContext<
  KeyboardShortcutsContextType | undefined
>(undefined)

export function KeyboardShortcutsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isEnabled, setIsEnabled] = useState(true)

  const enable = () => setIsEnabled(true)
  const disable = () => setIsEnabled(false)
  const toggle = () => setIsEnabled(prev => !prev)

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        isEnabled,
        enable,
        disable,
        toggle,
      }}
    >
      {children}
    </KeyboardShortcutsContext.Provider>
  )
}

export function useKeyboardShortcutsContext() {
  const context = useContext(KeyboardShortcutsContext)
  if (context === undefined) {
    throw new Error(
      "useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider"
    )
  }
  return context
}
