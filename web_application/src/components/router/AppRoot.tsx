import { CommandPalette } from "@/components/CommandPalette";
import { Toaster } from "@/components/ui/toaster";
import { Outlet } from "@tanstack/react-router";

export function AppRoot() {
  return (
    <>
      <Outlet />
      <CommandPalette />
      <Toaster />
    </>
  );
}
