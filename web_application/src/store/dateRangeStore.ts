import { create } from "zustand"
import { persist } from "zustand/middleware"
import { parse, format } from "date-fns"

interface DateRangeState {
  fromDate: Date
  toDate: Date
  setFromDate: (date: Date) => void
  setToDate: (date: Date) => void
  setDateRange: (from: Date, to: Date) => void
}

// Helper function to get default dates (1 year from now)
const getDefaultDates = () => {
  const today = new Date()
  const oneYearFromNow = new Date(today)
  oneYearFromNow.setFullYear(today.getFullYear() + 1)
  return {
    from: today,
    to: oneYearFromNow,
  }
}

const defaultDates = getDefaultDates()

export const useDateRangeStore = create<DateRangeState>()(
  persist(
    set => ({
      fromDate: defaultDates.from,
      toDate: defaultDates.to,
      setFromDate: (date: Date) => set({ fromDate: date }),
      setToDate: (date: Date) => set({ toDate: date }),
      setDateRange: (from: Date, to: Date) =>
        set({ fromDate: from, toDate: to }),
    }),
    {
      name: "date-range-storage",
      partialize: state => ({
        fromDate: format(state.fromDate, "yyyy-MM-dd"),
        toDate: format(state.toDate, "yyyy-MM-dd"),
      }),
      onRehydrateStorage: () => state => {
        if (state) {
          // Convert string dates back to Date objects
          state.fromDate = parse(
            state.fromDate as string,
            "yyyy-MM-dd",
            new Date()
          )
          state.toDate = parse(state.toDate as string, "yyyy-MM-dd", new Date())
        }
      },
      version: 1,
    }
  )
)
