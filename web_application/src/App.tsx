import { KeyboardShortcutsProvider } from "@/contexts/keyboard-shortcuts-context"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { RouterProvider } from "@tanstack/react-router"
// Create a client
const queryClient = new QueryClient()

import { router } from "./Router"

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <KeyboardShortcutsProvider>
        <RouterProvider router={router} />
      </KeyboardShortcutsProvider>
      <ReactQueryDevtools initialIsOpen />
    </QueryClientProvider>
  )
}

export default App
