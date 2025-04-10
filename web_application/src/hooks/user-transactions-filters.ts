import { useDateRangeStore } from "@/store/dateRangeStore"
import { useNavigate, useSearch } from "@tanstack/react-router"

export function useTransactionsFilters(defaultType = "all") {
  const search = useSearch()
  const navigate = useNavigate()
  const { fromDate, toDate, setDateRange } = useDateRangeStore()

  const updateSearchParams = (updates: Partial<typeof search>) => {
    navigate({
      search: {
        ...search,
        ...updates,
      },
    })
  }

  const handleTypeChange = (value: string) => {
    updateSearchParams({ type: value === "all" ? undefined : value })
  }

  const handleCategoryChange = (value: string) => {
    updateSearchParams({ category: value === "all" ? undefined : value })
  }

  const handleAccountChange = (value: string) => {
    updateSearchParams({ accountId: value === "all" ? undefined : value })
  }

  const handleDateRangeChange = (value: string) => {
    const now = new Date()
    let fromDate = new Date()
    const toDate = new Date()

    switch (value) {
      case "7d":
        fromDate.setDate(now.getDate() - 7)
        break
      case "30d":
        fromDate.setDate(now.getDate() - 30)
        break
      case "90d":
        fromDate.setDate(now.getDate() - 90)
        break
      case "all":
        fromDate = new Date(0)
        break
    }

    setDateRange(fromDate, toDate)
    updateSearchParams({ date_range: value === "all" ? undefined : value })
  }

  const clearAllFilters = () => {
    navigate({
      search: {},
    })
    setDateRange(new Date(0), new Date())
  }

  return {
    search,
    handleTypeChange,
    handleCategoryChange,
    handleAccountChange,
    handleDateRangeChange,
    clearAllFilters,
    fromDate,
    toDate,
  }
}
