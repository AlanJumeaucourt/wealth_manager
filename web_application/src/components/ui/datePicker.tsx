"use client";

import { DatePicker as BaseDatePicker } from "@/components/ui/date-picker";

interface DatePickerProps {
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  minDate: Date;
  maxDate: Date;
}

/** Thin wrapper mapping selectedDate/onDateChange for CustomPriceDialog and similar callers. */
export function DatePicker({ selectedDate, onDateChange, minDate, maxDate }: DatePickerProps) {
  return (
    <BaseDatePicker
      value={selectedDate}
      onChange={onDateChange}
      minDate={minDate}
      maxDate={maxDate}
    />
  );
}
