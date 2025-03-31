import { usePeriodSummary } from "@/api/queries"
import { PageContainer } from "@/components/layout/PageContainer"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PeriodChart } from "@/components/wealth/PeriodChart"
import { WealthChart } from "@/components/wealth/WealthChart"
import { format } from "date-fns"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { useState } from "react"

type PeriodType = 'week' | 'month' | 'quarter' | 'year'
type RangeType = 3 | 6 | 12 | 24 | 36

export function Wealth() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('month')
  const [dateOffset, setDateOffset] = useState(0)
  const [periodRange, setPeriodRange] = useState<RangeType>(12)

  // Calculate dates for period summary
  const endDate = new Date()
  const startDate = new Date()

  // Adjust dates based on offset
  switch (selectedPeriod) {
    case 'week':
      endDate.setDate(endDate.getDate() - (dateOffset * 7))
      startDate.setDate(startDate.getDate() - (dateOffset * 7) - (7 * periodRange))
      break
    case 'month':
      endDate.setMonth(endDate.getMonth() - dateOffset)
      startDate.setMonth(startDate.getMonth() - dateOffset - periodRange)
      break
    case 'quarter':
      endDate.setMonth(endDate.getMonth() - (dateOffset * 3))
      startDate.setMonth(startDate.getMonth() - (dateOffset * 3) - (3 * periodRange))
      break
    case 'year':
      endDate.setFullYear(endDate.getFullYear() - dateOffset)
      startDate.setFullYear(startDate.getFullYear() - dateOffset - periodRange)
      break
  }

  const { data: wealthData, isLoading } = usePeriodSummary(
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0],
    selectedPeriod
  )

  const formatDateRange = () => {
    switch (selectedPeriod) {
      case 'week':
        return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`
      case 'month':
        return `${format(startDate, 'MMMM yyyy')} - ${format(endDate, 'MMMM yyyy')}`
      case 'quarter':
        const startQuarter = Math.floor(startDate.getMonth() / 3) + 1
        const endQuarter = Math.floor(endDate.getMonth() / 3) + 1
        return `Q${startQuarter} ${format(startDate, 'yyyy')} - Q${endQuarter} ${format(endDate, 'yyyy')}`
      case 'year':
        return `${format(startDate, 'yyyy')} - ${format(endDate, 'yyyy')}`
    }
  }

  const periodOptions: { value: PeriodType; label: string }[] = [
    { value: 'week', label: 'Weekly' },
    { value: 'month', label: 'Monthly' },
    { value: 'quarter', label: 'Quarterly' },
    { value: 'year', label: 'Yearly' }
  ]

  const rangeOptions: { value: RangeType; label: string }[] = [
    { value: 3, label: '3 Periods' },
    { value: 6, label: '6 Periods' },
    { value: 12, label: '12 Periods' },
    { value: 24, label: '24 Periods' },
    { value: 36, label: '36 Periods' }
  ]

  const dateSelector = (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDateOffset(prev => prev + 5)}
          title="Jump back 5 periods"
          className="h-8 w-8"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDateOffset(prev => prev + 1)}
          title="Previous period"
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDateOffset(prev => Math.max(0, prev - 1))}
          disabled={dateOffset === 0}
          title="Next period"
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDateOffset(prev => Math.max(0, prev - 5))}
          disabled={dateOffset < 5}
          title="Jump forward 5 periods"
          className="h-8 w-8"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={selectedPeriod}
          onValueChange={(value: PeriodType) => {
            setSelectedPeriod(value)
            setDateOffset(0)
          }}
        >
          <SelectTrigger className="w-[120px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={periodRange.toString()}
          onValueChange={(value) => {
            setPeriodRange(Number(value) as RangeType)
          }}
        >
          <SelectTrigger className="w-[120px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rangeOptions.map(option => (
              <SelectItem key={option.value} value={option.value.toString()}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">
          {formatDateRange()}
        </span>
      </div>
    </div>
  )

  return (
    <PageContainer
      title="Wealth Overview"
      action={dateSelector}
    >
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 w-full">
        {/* Wealth Evolution Chart */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <WealthChart
            startDate={startDate}
            endDate={endDate}
          />
        </div>

        {/* Period Analysis */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-muted-foreground">Loading data...</div>
            </div>
          ) : wealthData ? (
            <PeriodChart data={wealthData} />
          ) : (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-muted-foreground">No data available for the selected period</div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
