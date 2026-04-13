import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  title?: string;
  /** Optional subtitle shown under the title */
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageContainer({
  children,
  title,
  description,
  action,
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "m-4 sm:m-6 p-4 sm:p-6 bg-card rounded-xl shadow-sm border border-border/50",
        "transform-gpu will-change-transform",
        "transition-transform duration-200 ease-in-out",
        className,
      )}
    >
      {(title || description || action) && (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {(title || description) && (
            <div className="space-y-1">
              {title && (
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
              )}
              {description && (
                <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
              )}
            </div>
          )}
          {action && <div className="min-w-0 flex-1 sm:flex-initial">{action}</div>}
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}
