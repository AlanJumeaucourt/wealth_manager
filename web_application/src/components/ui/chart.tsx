"use client"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart as Chart } from "@tremor/react"
import { cn } from "@/lib/utils"

export type ChartConfig = Record<string, { label: string; color: string }>

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig
}

export function ChartContainer({
  config,
  children,
  className,
  ...props
}: ChartContainerProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  )
}

interface ChartTooltipProps extends React.ComponentProps<typeof Tooltip> {
  content: React.ReactNode
}

export function ChartTooltip({
  content,
  children,
  className,
  ...props
}: ChartTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip {...props}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className={className}>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface ChartTooltipContentProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; payload: Record<string, any> }>
  hideLabel?: boolean
}

export function ChartTooltipContent({
  active,
  payload,
  hideLabel = false,
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="rounded-lg border bg-background p-2 shadow-sm">
      {payload.map((item, index) => (
        <div key={index} className="flex flex-col">
          {!hideLabel && (
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              {item.name}
            </span>
          )}
          <span className="font-bold">
            {item.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

interface ChartProps extends React.ComponentProps<typeof Chart> {
  className?: string
}

export function BarChart({ className, ...props }: ChartProps) {
  return (
    <Chart
      {...props}
      className={cn("text-sm [&_.tremor-BarChart-bar]:!stroke-[3]", className)}
      showAnimation
      showLegend
      showGridLines
      showXAxis
      showYAxis
    />
  )
}
