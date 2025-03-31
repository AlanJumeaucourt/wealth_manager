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
      "m-4 sm:m-6 p-4 sm:p-6 bg-card rounded-xl shadow-sm border border-border/50",
      "transform-gpu will-change-transform",
      "transition-transform duration-200 ease-in-out",
      className
    )}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
