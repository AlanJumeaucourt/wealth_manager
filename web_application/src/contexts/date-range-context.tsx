"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

type Scope = "month" | "quarter" | "year";

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface DateRangeContextType {
  scope: Scope;
  setScope: (scope: Scope) => void;
  date: Date;
  setDate: Dispatch<SetStateAction<Date>>;
  dateRange: DateRange;
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

function calculateDateRange(date: Date, scope: Scope): DateRange {
  const startDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const endDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

  switch (scope) {
    case "month":
      startDate.setDate(1);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0); // Last day of the current month
      break;
    case "quarter": {
      const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
      startDate.setMonth(quarterStartMonth);
      startDate.setDate(1);
      endDate.setMonth(quarterStartMonth + 3);
      endDate.setDate(0);
      break;
    }
    case "year":
      startDate.setMonth(0);
      startDate.setDate(1);
      endDate.setMonth(11);
      endDate.setDate(31);
      break;
  }

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<Scope>("month");
  const [date, setDate] = useState(new Date());

  const dateYear = date.getFullYear();
  const dateMonth = date.getMonth();
  const dateDay = date.getDate();
  const dateRange = useMemo(
    () => calculateDateRange(new Date(dateYear, dateMonth, dateDay), scope),
    [dateYear, dateMonth, dateDay, scope],
  );

  const value = useMemo(
    () => ({
      scope,
      setScope,
      date,
      setDate,
      dateRange,
    }),
    [scope, date, dateRange],
  );

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (context === undefined) {
    throw new Error("useDateRange must be used within a DateRangeProvider");
  }
  return context;
}
