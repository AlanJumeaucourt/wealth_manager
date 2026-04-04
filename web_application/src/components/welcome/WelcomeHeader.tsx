import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCommandPalette } from "@/hooks/useCommandPalette";
import { Bell, CalendarDays, Search, Settings } from "lucide-react";

interface WelcomeHeaderProps {
  greeting: string;
  currentTime: Date;
  userName: string;
}

export function WelcomeHeader({ greeting, currentTime, userName }: WelcomeHeaderProps) {
  const { open } = useCommandPalette();

  return (
    <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-t-xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {greeting}, <span className="text-primary">{userName}</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            {currentTime.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={open}>
                  <Search className="h-5 w-5" />
                  <span className="sr-only">Search</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Search (Ctrl+K)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button variant="ghost" size="icon" className="rounded-full">
            <CalendarDays className="h-5 w-5" />
            <span className="sr-only">Calendar</span>
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Notifications</span>
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Settings className="h-5 w-5" />
            <span className="sr-only">Settings</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
