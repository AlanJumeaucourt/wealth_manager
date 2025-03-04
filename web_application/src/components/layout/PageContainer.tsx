import { Toaster } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

interface PageContainerProps {
  children: React.ReactNode
  title?: string
  action?: React.ReactNode
  className?: string
}

export function PageContainer({
  children,
  title,
  action,
  className
}: PageContainerProps) {
  return (
    <div className={cn(
      "p-3 sm:p-4 m-2 sm:m-4 bg-card rounded-xl shadow-sm border border-border/50 min-h-[95%]",
      "transform-gpu will-change-transform overflow-x-hidden",
      "transition-transform duration-200 ease-in-out",
      className
    )}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-4">
          {title && <h1 className="text-2xl font-semibold tracking-tight ml-2">{title}</h1>}
          {action}
        </div>
      )}
      {children}
      <Toaster />
    </div>
  )
}
