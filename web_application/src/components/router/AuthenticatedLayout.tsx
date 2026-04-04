import { AppSidebar } from "@/components/app-sidebar";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Outlet, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function AuthenticatedLayout() {
  const router = useRouter();
  const [currentPath, setCurrentPath] = useState(router.state.location.pathname);

  useEffect(() => {
    setCurrentPath(router.state.location.pathname);
  }, [router.state.location.pathname]);

  const getBreadcrumbTitle = (path: string) => {
    const segments = path.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];

    if (!lastSegment) return "Dashboard";

    if (segments.length > 1) {
      const parentSegment = segments[segments.length - 2];
      switch (parentSegment) {
        case "accounts":
          switch (lastSegment) {
            case "all":
              return "All Accounts";
            case "regular":
              return "Regular Accounts";
            case "expense":
              return "Expense Accounts";
            case "income":
              return "Income Accounts";
            default:
              return "Accounts";
          }
        case "transactions":
          switch (lastSegment) {
            case "all":
              return "All Transactions";
            case "income":
              return "Income Transactions";
            case "expense":
              return "Expense Transactions";
            case "transfer":
              return "Transfer Transactions";
            default:
              return "Transactions";
          }
        default:
          return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
      }
    }

    return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
  };

  const getHomeLink = (path: string) => {
    const segments = path.split("/").filter(Boolean);
    if (segments.length > 1) {
      return `/${segments[0]}`;
    }
    return "/dashboard";
  };

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b sticky top-0 z-10 bg-background transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4 w-full justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href={getHomeLink(currentPath)}>
                      {currentPath.includes("/accounts")
                        ? "Accounts"
                        : currentPath.includes("/transactions")
                          ? "Transactions"
                          : "Home"}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{getBreadcrumbTitle(currentPath)}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <KeyboardShortcutsHelp />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
