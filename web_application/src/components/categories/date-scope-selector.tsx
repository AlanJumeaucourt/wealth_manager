"use client"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDateRange } from "@/contexts/date-range-context"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function DateScopeSelector() {
  const { scope, setScope, date, setDate } = useDateRange()

  const formatDate = () => {
    switch (scope) {
      case "month":
        return date.toLocaleString('default', { month: 'long', year: 'numeric' })
      case "quarter":
        const quarter = Math.floor(date.getMonth() / 3) + 1
        return `Q${quarter} ${date.getFullYear()}`
      case "year":
        return date.getFullYear().toString()
    }
  }

  const navigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(date)
    switch (scope) {
      case "month":
        newDate.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1))
        break
      case "quarter":
        newDate.setMonth(date.getMonth() + (direction === 'next' ? 3 : -3))
        break
      case "year":
        newDate.setFullYear(date.getFullYear() + (direction === 'next' ? 1 : -1))
        break
    }
    setDate(newDate)
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-3 sm:p-4 rounded-lg border">
      <div className="flex items-center gap-2 w-full sm:w-auto">
        {["month", "quarter", "year"].map((s) => (
          <Button
            key={s}
            variant={scope === s ? "default" : "outline"}
            onClick={() => setScope(s as any)}
            className="text-sm flex-1 sm:flex-initial h-8"
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('prev')}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="flex-1 sm:min-w-[140px] h-8 px-3 text-sm"
            >
              {formatDate()}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            className="min-w-[140px]"
          >
            {scope === "month" && Array.from({ length: 12 }, (_, i) => {
              const d = new Date(date.getFullYear(), i)
              return (
                <DropdownMenuItem
                  key={i}
                  onClick={() => {
                    const newDate = new Date(date)
                    newDate.setMonth(i)
                    setDate(newDate)
                  }}
                  className="text-sm"
                >
                  {d.toLocaleString('default', { month: 'long' })}
                </DropdownMenuItem>
              )
            })}
            {scope === "quarter" && Array.from({ length: 4 }, (_, i) => (
              <DropdownMenuItem
                key={i}
                onClick={() => {
                  const newDate = new Date(date)
                  newDate.setMonth(i * 3)
                  setDate(newDate)
                }}
                className="text-sm"
              >
                Q{i + 1}
              </DropdownMenuItem>
            ))}
            {scope === "year" && Array.from({ length: 5 }, (_, i) => {
              const year = new Date().getFullYear() - 2 + i
              return (
                <DropdownMenuItem
                  key={i}
                  onClick={() => {
                    const newDate = new Date(date)
                    newDate.setFullYear(year)
                    setDate(newDate)
                  }}
                  className="text-sm"
                >
                  {year}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('next')}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
