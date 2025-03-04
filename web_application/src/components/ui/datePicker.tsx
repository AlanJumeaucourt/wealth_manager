"use client"

import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  selectedDate: Date | undefined
  onDateChange: (date: Date | undefined) => void
  minDate: Date
  maxDate: Date
}

export function DatePicker({ selectedDate, onDateChange, minDate, maxDate }: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(
    selectedDate || new Date()
  )
  const [open, setOpen] = React.useState(false)

  const handleMonthChange = (value: string) => {
    const month = parseInt(value, 10)
    const newDate = new Date(currentMonth)
    newDate.setMonth(month)
    setCurrentMonth(newDate)
  }

  const handleYearChange = (value: string) => {
    const year = parseInt(value, 10)
    const newDate = new Date(currentMonth)
    newDate.setFullYear(year)
    setCurrentMonth(newDate)
  }

  const handleSelect = (date: Date | undefined) => {
    onDateChange(date)
    if (date) {
      setCurrentMonth(date)
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[200px] justify-start text-left font-normal",
            !selectedDate && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, "yyyy-MM-dd") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex justify-between items-center p-2 border-b">
          <Select onValueChange={handleMonthChange} value={currentMonth.getMonth().toString()}>
            <SelectTrigger className="w-[110px]">
              <SelectValue>{format(currentMonth, "MMMM")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i} value={i.toString()}>
                  {format(new Date(2000, i), "MMMM")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={handleYearChange} value={currentMonth.getFullYear().toString()}>
            <SelectTrigger className="w-[95px]">
              <SelectValue>{format(currentMonth, "yyyy")}</SelectValue>
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
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          defaultMonth={currentMonth}
          fromDate={minDate}
          toDate={maxDate}
          disabled={(date) =>
            date < minDate || date > maxDate
          }
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
