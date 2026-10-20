import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { KeyboardShortcutsProvider } from "@/contexts/keyboard-shortcuts-context";
import { CommandPaletteProvider } from "@/hooks/useCommandPalette";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "@tanstack/react-router";

import { router } from "./Router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <KeyboardShortcutsProvider>
        <CommandPaletteProvider>
          <RouterProvider router={router} />
          <PWAInstallPrompt />
        </CommandPaletteProvider>
      </KeyboardShortcutsProvider>
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}

export default App;
