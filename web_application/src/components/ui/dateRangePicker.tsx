"use client"

import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import * as React from "react"
import { Range } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface DateRangePickerProps {
  minDate: Date
  maxDate: Date
}

// Calculate default date range as one year from now, clamped within minDate and maxDate
const getDefaultDateRange = (minDate: Date, maxDate: Date): Range => {
  const from = new Date()
  from.setFullYear(from.getFullYear() + 1)

  const to = new Date(from)
  to.setFullYear(to.getFullYear() + 1)

  // Clamp the dates within minDate and maxDate
  const clampedFrom = from < minDate ? minDate : from
  const clampedTo = to > maxDate ? maxDate : to

  return { from: clampedFrom, to: clampedTo }
}

export function DateRangePicker({ minDate, maxDate }: DateRangePickerProps) {
  const [dateRange, setDateRange] = React.useState<Range>(getDefaultDateRange(minDate, maxDate))
  const [currentMonth, setCurrentMonth] = React.useState<Date>(getDefaultDateRange(minDate, maxDate).from)

  const handleMonthChange = (month: number) => {
    const newDate = new Date(currentMonth)
    newDate.setMonth(month)
    setCurrentMonth(newDate)
  }

  const handleYearChange = (year: number) => {
    const newDate = new Date(currentMonth)
    newDate.setFullYear(year)
    setCurrentMonth(newDate)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !dateRange?.from && !dateRange?.to && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateRange?.from && dateRange?.to
            ? `${format(dateRange.from, "yyyy-MM-dd")} - ${format(dateRange.to, "yyyy-MM-dd")}`
            : <span>Pick a date range</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <div className="flex justify-between items-center p-2 border-b">
          <Select onValueChange={(value) => handleMonthChange(Number(value))}>
            <SelectTrigger>
              <SelectValue placeholder={format(currentMonth, "LLLL")} />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i} value={i.toString()}>
                  {format(new Date(0, i), "LLLL")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(value) => handleYearChange(Number(value))}>
            <SelectTrigger>
              <SelectValue placeholder={format(currentMonth, "yyyy")} />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => {
                const year = new Date().getFullYear() - 5 + i
                return (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={setDateRange}
          initialFocus
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          fromDate={minDate}
          toDate={maxDate}
        />
      </PopoverContent>
    </Popover>
  )
}
