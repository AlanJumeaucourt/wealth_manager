import { usePeriodSummary, useWealthOverTime } from "@/api/queries"
import { PageContainer } from "@/components/layout/PageContainer"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PeriodChart } from "@/components/wealth/PeriodChart"
import { WealthChart } from "@/components/wealth/WealthChart"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Share2,
} from "lucide-react"
import { Dispatch, SetStateAction, useState } from "react"

type PeriodType = "week" | "month" | "quarter" | "year"
type RangeType = 3 | 6 | 12 | 24 | 36

interface WealthSummaryProps {
  startDate: Date
  endDate: Date
}

interface DateSelectorProps {
  selectedPeriod: PeriodType
  setSelectedPeriod: (period: PeriodType) => void
  dateOffset: number
  setDateOffset: Dispatch<SetStateAction<number>>
  periodRange: RangeType
  setPeriodRange: (range: RangeType) => void
  formatDateRange: () => string
}

// Define simple types for better inline documentation
interface WealthDataPoint {
  date: string
  value: number
}

function DateSelector({
  selectedPeriod,
  setSelectedPeriod,
  dateOffset,
  setDateOffset,
  periodRange,
  setPeriodRange,
  formatDateRange,
}: DateSelectorProps) {
  const periodOptions: { value: PeriodType; label: string }[] = [
    { value: "week", label: "Weekly" },
    { value: "month", label: "Monthly" },
    { value: "quarter", label: "Quarterly" },
    { value: "year", label: "Yearly" },
  ]

  const rangeOptions: { value: RangeType; label: string }[] = [
    { value: 3, label: "3 Periods" },
    { value: 6, label: "6 Periods" },
    { value: 12, label: "12 Periods" },
    { value: 24, label: "24 Periods" },
    { value: 36, label: "36 Periods" },
  ]

  return (
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
          onValueChange={value => {
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
}

// Helper function to check if clipboard API is available
const isClipboardAvailable = () => {
  return typeof navigator !== 'undefined' &&
         navigator.clipboard &&
         typeof navigator.clipboard.writeText === 'function';
}

// Helper function to handle clipboard copy with fallback
const copyToClipboard = async (text: string, toast: any): Promise<boolean> => {
  // Check for clipboard API support
  if (isClipboardAvailable()) {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: "Text copied to clipboard. You can now paste it anywhere.",
      });
      return true;
    } catch (error) {
      console.error("Clipboard write failed:", error);
    }
  }

  // Show error or fallback message
  toast({
    title: "Copy failed",
    description: "Your browser doesn't support automatic copying. Please copy manually.",
    variant: "destructive",
  });
  return false;
}

function WealthSummary({ startDate, endDate }: WealthSummaryProps) {
  const { data: wealthData, isLoading, error } = useWealthOverTime()
  const { toast } = useToast()

  const handleExport = () => {
    // Create data to export
    if (!wealthData || wealthData.length === 0) {
      toast({
        title: "No data to export",
        description: "There is no wealth data available for the selected period.",
        variant: "destructive",
      })
      return
    }

    // Convert data to CSV format
    const csvContent = [
      "Date,Value",
      ...wealthData.map((item: WealthDataPoint) => `${item.date},${item.value}`),
    ].join("\n")

    // Create blob and download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `wealth-evolution-${format(startDate, "yyyy-MM-dd")}-to-${format(endDate, "yyyy-MM-dd")}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: "Export successful",
      description: "The wealth evolution data has been exported to CSV.",
    })
  }

  const handleShare = () => {
    // Create shareable content
    const shareText = `My Wealth Evolution from ${format(startDate, "MMM d, yyyy")} to ${format(endDate, "MMM d, yyyy")}`

    // Check if Web Share API is available
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: "Wealth Evolution",
        text: shareText,
      }).then(() => {
        toast({
          title: "Shared successfully",
          description: "Your wealth evolution data has been shared.",
        })
      }).catch((error) => {
        console.error("Share failed:", error)
        // Fall back to clipboard if sharing fails
        copyToClipboard(shareText, toast);
      })
    } else {
      // Fallback for browsers that don't support Web Share API
      copyToClipboard(shareText, toast);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-[180px] mb-2" />
          <Skeleton className="h-4 w-[220px]" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          There was an error loading wealth evolution data.
        </AlertDescription>
      </Alert>
    )
  }

  if (!wealthData || wealthData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Wealth Evolution</CardTitle>
          <CardDescription>Track your net worth over time</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <p>No wealth data available for the selected period.</p>
            <p className="text-sm mt-2">Try adjusting your date range or adding accounts.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Wealth Evolution</CardTitle>
            <CardDescription>Track your net worth over time</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={handleExport}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={handleShare}
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <WealthChart startDate={startDate} endDate={endDate} />
      </CardContent>
    </Card>
  )
}

function WealthSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[180px] mb-2" />
          <Skeleton className="h-4 w-[220px]" />
        </CardHeader>
        <CardContent className="p-6">
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[180px] mb-2" />
          <Skeleton className="h-4 w-[220px]" />
        </CardHeader>
        <CardContent className="p-6">
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export function Wealth() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("month")
  const [dateOffset, setDateOffset] = useState(0)
  const [periodRange, setPeriodRange] = useState<RangeType>(12)
  const { toast } = useToast()

  // Calculate dates for period summary
  const endDate = new Date()
  const startDate = new Date()

  // Adjust dates based on offset
  switch (selectedPeriod) {
    case "week":
      endDate.setDate(endDate.getDate() - dateOffset * 7)
      startDate.setDate(startDate.getDate() - dateOffset * 7 - 7 * periodRange)
      break
    case "month":
      endDate.setMonth(endDate.getMonth() - dateOffset)
      startDate.setMonth(startDate.getMonth() - dateOffset - periodRange)
      break
    case "quarter":
      endDate.setMonth(endDate.getMonth() - dateOffset * 3)
      startDate.setMonth(
        startDate.getMonth() - dateOffset * 3 - 3 * periodRange
      )
      break
    case "year":
      endDate.setFullYear(endDate.getFullYear() - dateOffset)
      startDate.setFullYear(startDate.getFullYear() - dateOffset - periodRange)
      break
  }

  const { data: periodData, isLoading: isLoadingPeriod, error: periodError } = usePeriodSummary(
    startDate.toISOString().split("T")[0],
    endDate.toISOString().split("T")[0],
    selectedPeriod
  )

  const handleExportPeriodData = () => {
    if (!periodData || !periodData.summaries || periodData.summaries.length === 0) {
      toast({
        title: "No data to export",
        description: "There is no period data available for the selected time range.",
        variant: "destructive",
      })
      return
    }

    // Extract CSV rows with type safety using any
    const csvRows = [
      "Period,Income,Expense,Net",
      ...periodData.summaries.map((summary: any) => {
        const income = summary.income.total.net || 0
        const expense = Math.abs(summary.expense.total.net || 0)
        const net = income - expense
        return `${format(new Date(summary.start_date), "MMM yyyy")},${income},${expense},${net}`
      }),
    ]

    // Create and download CSV
    const csvContent = csvRows.join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `income-expense-${format(startDate, "yyyy-MM-dd")}-to-${format(endDate, "yyyy-MM-dd")}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: "Export successful",
      description: "The period analysis data has been exported to CSV.",
    })
  }

  const handleSharePeriodData = () => {
    // Create shareable content
    const periodLabel = selectedPeriod === "week" ? "weekly" :
                      selectedPeriod === "month" ? "monthly" :
                      selectedPeriod === "quarter" ? "quarterly" : "yearly"

    const shareText = `My ${periodLabel} income and expense data from ${format(startDate, "MMM d, yyyy")} to ${format(endDate, "MMM d, yyyy")}`

    // Check if Web Share API is available
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: "Income & Expense Analysis",
        text: shareText,
      }).then(() => {
        toast({
          title: "Shared successfully",
          description: "Your period analysis data has been shared.",
        })
      }).catch((error) => {
        console.error("Share failed:", error)
        // Fall back to clipboard if sharing fails
        copyToClipboard(shareText, toast);
      })
    } else {
      // Fallback for browsers that don't support Web Share API
      copyToClipboard(shareText, toast);
    }
  }

  // Handle keyboard shortcuts
  useKeyboardShortcuts({
    onPrevPage: () => setDateOffset(prev => prev + 1),
    onNextPage: () => setDateOffset(prev => Math.max(0, prev - 1)),
    disabled: false,
  })

  const formatDateRange = () => {
    switch (selectedPeriod) {
      case "week":
        return `${format(startDate, "MMM d, yyyy")} - ${format(
          endDate,
          "MMM d, yyyy"
        )}`
      case "month":
        return `${format(startDate, "MMMM yyyy")} - ${format(
          endDate,
          "MMMM yyyy"
        )}`
      case "quarter":
        const startQuarter = Math.floor(startDate.getMonth() / 3) + 1
        const endQuarter = Math.floor(endDate.getMonth() / 3) + 1
        return `Q${startQuarter} ${format(
          startDate,
          "yyyy"
        )} - Q${endQuarter} ${format(endDate, "yyyy")}`
      case "year":
        return `${format(startDate, "yyyy")} - ${format(endDate, "yyyy")}`
    }
  }

  const isLoading = isLoadingPeriod
  const hasError = periodError

  const dateSelector = (
    <DateSelector
      selectedPeriod={selectedPeriod}
      setSelectedPeriod={setSelectedPeriod}
      dateOffset={dateOffset}
      setDateOffset={setDateOffset}
      periodRange={periodRange}
      setPeriodRange={setPeriodRange}
      formatDateRange={formatDateRange}
    />
  )

  if (hasError) {
    return (
      <PageContainer title="Wealth Overview" action={dateSelector}>
        <Alert variant="destructive">
          <AlertDescription>
            There was an error loading your financial data. Please try again later.
          </AlertDescription>
        </Alert>
      </PageContainer>
    )
  }

  return (
    <PageContainer title="Wealth Overview" action={dateSelector}>
      <div className="p-3 sm:p-6 space-y-6 w-full">
        {isLoading ? (
          <WealthSkeleton />
        ) : (
          <>
            {/* Wealth Evolution Chart */}
            <WealthSummary startDate={startDate} endDate={endDate} />

            {/* Period Analysis */}
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Period Analysis</CardTitle>
                    <CardDescription>
                      Compare income and expenses across {selectedPeriod}s
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={handleExportPeriodData}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Export</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={handleSharePeriodData}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Share</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {periodData ? (
                  <PeriodChart data={periodData as any} />
                ) : (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="text-muted-foreground">
                      No data available for the selected period
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PageContainer>
  )
}
