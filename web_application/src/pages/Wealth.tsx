import {
  usePeriodSummary,
  usePortfolioSummary,
  useWealthOverTimeWithGains,
  useWealthSummary,
} from "@/api/queries";
import { PageContainer } from "@/components/layout/PageContainer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PeriodChart } from "@/components/wealth/PeriodChart";
import { WealthChart } from "@/components/wealth/WealthChart";
import { WealthSnapshot } from "@/components/wealth/WealthSnapshot";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useToast } from "@/hooks/use-toast";
import { computeWealthBreakdown } from "@/utils/wealthBreakdown";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Share2,
} from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";

type PeriodType = "week" | "month" | "quarter" | "year";
type RangeType = 3 | 6 | 12 | 24 | 36 | 48 | 60 | 72 | 84 | 96 | 108 | 120;

interface DateSelectorProps {
  selectedPeriod: PeriodType;
  setSelectedPeriod: (period: PeriodType) => void;
  dateOffset: number;
  setDateOffset: Dispatch<SetStateAction<number>>;
  periodRange: RangeType;
  setPeriodRange: (range: RangeType) => void;
  formatDateRange: () => string;
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
  ];

  const rangeOptions: { value: RangeType; label: string }[] = [
    { value: 3, label: "3 Periods" },
    { value: 6, label: "6 Periods" },
    { value: 12, label: "12 Periods" },
    { value: 24, label: "24 Periods" },
    { value: 36, label: "36 Periods" },
    { value: 48, label: "48 Periods" },
    { value: 60, label: "60 Periods" },
    { value: 72, label: "72 Periods" },
    { value: 84, label: "84 Periods" },
    { value: 96, label: "96 Periods" },
    { value: 108, label: "108 Periods" },
    { value: 120, label: "120 Periods" },
  ];

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex items-center justify-between gap-2 sm:justify-start">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDateOffset((prev) => prev + 5)}
            title="Jump back 5 periods"
            className="h-8 w-8 shrink-0"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDateOffset((prev) => prev + 1)}
            title="Previous period"
            className="h-8 w-8 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDateOffset((prev) => Math.max(0, prev - 1))}
            disabled={dateOffset === 0}
            title="Next period"
            className="h-8 w-8 shrink-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDateOffset((prev) => Math.max(0, prev - 5))}
            disabled={dateOffset < 5}
            title="Jump forward 5 periods"
            className="h-8 w-8 shrink-0"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-xs text-muted-foreground sm:hidden">{formatDateRange()}</span>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Select
          value={selectedPeriod}
          onValueChange={(value: PeriodType) => {
            setSelectedPeriod(value);
            setDateOffset(0);
          }}
        >
          <SelectTrigger className="h-8 w-full min-w-0 sm:w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={periodRange.toString()}
          onValueChange={(value) => {
            setPeriodRange(Number(value) as RangeType);
          }}
        >
          <SelectTrigger className="h-8 w-full min-w-0 sm:w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rangeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value.toString()}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="hidden text-sm text-muted-foreground font-medium sm:inline sm:whitespace-nowrap">
          {formatDateRange()}
        </span>
      </div>
    </div>
  );
}

const isClipboardAvailable = () => {
  return (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  );
};

const copyToClipboard = async (text: string, toast: any): Promise<boolean> => {
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
  toast({
    title: "Copy failed",
    description: "Your browser doesn't support automatic copying. Please copy manually.",
    variant: "destructive",
  });
  return false;
};

function marketValueFromPoint(point: {
  balance: number;
  market_value?: number;
  investment_gain_unrealized?: number;
  investment_gain: number;
}) {
  if (point.market_value != null) return point.market_value;
  const uplift = point.investment_gain_unrealized ?? point.investment_gain;
  return point.balance + uplift;
}

// --- Loading Skeleton ---

function WealthSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[220px] w-full rounded-xl" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[180px] mb-2" />
        </CardHeader>
        <CardContent className="p-6">
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[180px] mb-2" />
        </CardHeader>
        <CardContent className="p-6">
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

// --- Main Page ---

function hasSummaryActivity(summary: any): boolean {
  const incomeTotal = Number(summary?.income?.total?.net ?? summary?.income?.total ?? 0);
  const expenseTotal = Number(summary?.expense?.total?.net ?? summary?.expense?.total ?? 0);
  if (incomeTotal !== 0 || expenseTotal !== 0) return true;

  const incomeCategories = Object.values(summary?.income?.by_category ?? {}) as Array<{
    count?: number;
  }>;
  const expenseCategories = Object.values(summary?.expense?.by_category ?? {}) as Array<{
    count?: number;
  }>;
  return [...incomeCategories, ...expenseCategories].some((c) => Number(c?.count ?? 0) > 0);
}

export function Wealth() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("month");
  const [dateOffset, setDateOffset] = useState(0);
  const [periodRange, setPeriodRange] = useState<RangeType>(12);
  const [selectedDateRange, setSelectedDateRange] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);
  /** Net worth includes loan balances; gross excludes them (assets only). */
  const [wealthIncludeDebt, setWealthIncludeDebt] = useState(true);
  const [wealthShowInvestmentGain, setWealthShowInvestmentGain] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Period/navigation changes define a new base window, so clear synced chart selection.
    setSelectedDateRange(null);
  }, [selectedPeriod, dateOffset, periodRange]);

  // Calculate display window
  const endDate = new Date();
  const startDate = new Date();

  switch (selectedPeriod) {
    case "week":
      endDate.setDate(endDate.getDate() - dateOffset * 7);
      startDate.setDate(startDate.getDate() - dateOffset * 7 - 7 * periodRange);
      break;
    case "month":
      endDate.setMonth(endDate.getMonth() - dateOffset);
      startDate.setMonth(startDate.getMonth() - dateOffset - periodRange);
      break;
    case "quarter":
      endDate.setMonth(endDate.getMonth() - dateOffset * 3);
      startDate.setMonth(startDate.getMonth() - dateOffset * 3 - 3 * periodRange);
      break;
    case "year":
      endDate.setFullYear(endDate.getFullYear() - dateOffset);
      startDate.setFullYear(startDate.getFullYear() - dateOffset - periodRange);
      break;
  }

  // Fetch a large fixed window for period data (caches across navigation)
  const maxPeriods: RangeType = 120;
  const fetchEndDate = new Date();
  const fetchStartDate = new Date(fetchEndDate);

  switch (selectedPeriod) {
    case "week":
      fetchStartDate.setDate(fetchStartDate.getDate() - maxPeriods * 7);
      break;
    case "month":
      fetchStartDate.setMonth(fetchStartDate.getMonth() - maxPeriods);
      break;
    case "quarter":
      fetchStartDate.setMonth(fetchStartDate.getMonth() - maxPeriods * 3);
      break;
    case "year":
      fetchStartDate.setFullYear(fetchStartDate.getFullYear() - maxPeriods);
      break;
  }

  const fetchStartDateStr = fetchStartDate.toISOString().split("T")[0];
  const fetchEndDateStr = fetchEndDate.toISOString().split("T")[0];

  const {
    data: rawPeriodData,
    isLoading: isLoadingPeriod,
    error: periodError,
  } = usePeriodSummary(fetchStartDateStr, fetchEndDateStr, selectedPeriod);

  const { data: wealthData, isLoading: isLoadingWealth } = useWealthOverTimeWithGains({
    includeDebt: wealthIncludeDebt,
  });
  const { data: periodWealthData } = useWealthOverTimeWithGains({ includeDebt: true });
  const { data: wealthSummary, isLoading: isLoadingWealthSummary } = useWealthSummary();
  const { data: portfolioSummary, isLoading: isLoadingPortfolio } = usePortfolioSummary();

  const wealthBreakdown = useMemo(
    () => computeWealthBreakdown(wealthSummary, portfolioSummary, periodWealthData),
    [wealthSummary, portfolioSummary, periodWealthData],
  );

  // Derive the visible window from the cached full range
  const totalSummaries = rawPeriodData?.summaries?.length ?? 0;
  const effectiveWindowSize = Math.min(periodRange, totalSummaries);
  const effectiveOffset = Math.min(dateOffset, Math.max(0, totalSummaries - effectiveWindowSize));

  const endIndexExclusive = totalSummaries - effectiveOffset;
  const startIndex = Math.max(0, endIndexExclusive - effectiveWindowSize);

  const visibleSummaries =
    rawPeriodData && totalSummaries > 0
      ? rawPeriodData.summaries.slice(startIndex, endIndexExclusive)
      : [];

  const trimmedVisibleSummaries = useMemo(() => {
    if (visibleSummaries.length === 0) return visibleSummaries;

    const firstWithData = visibleSummaries.findIndex(hasSummaryActivity);
    if (firstWithData < 0) return visibleSummaries;

    let lastWithData = -1;
    for (let i = visibleSummaries.length - 1; i >= 0; i -= 1) {
      if (hasSummaryActivity(visibleSummaries[i])) {
        lastWithData = i;
        break;
      }
    }

    return visibleSummaries.slice(firstWithData, lastWithData + 1);
  }, [visibleSummaries]);

  const displayStartDate =
    trimmedVisibleSummaries.length > 0
      ? new Date(trimmedVisibleSummaries[0].start_date)
      : startDate;
  const displayEndDate =
    trimmedVisibleSummaries.length > 0
      ? new Date(trimmedVisibleSummaries[trimmedVisibleSummaries.length - 1].end_date)
      : endDate;

  const periodData = rawPeriodData
    ? { ...rawPeriodData, summaries: trimmedVisibleSummaries }
    : undefined;

  const periodStats = useMemo(() => {
    let periodChangeAbs = 0;
    let periodChangePct = 0;
    let periodTrend: "up" | "down" | "neutral" = "neutral";
    let savingsRate = 0;

    if (periodWealthData) {
      const visibleEntries = Object.entries(periodWealthData).filter(([date]) => {
        const d = new Date(date);
        return d >= displayStartDate && d <= displayEndDate;
      });
      if (visibleEntries.length >= 2) {
        const firstMarket = marketValueFromPoint(visibleEntries[0]![1]);
        const lastMarket = marketValueFromPoint(visibleEntries[visibleEntries.length - 1]![1]);
        periodChangeAbs = lastMarket - firstMarket;
        periodChangePct = firstMarket !== 0 ? (periodChangeAbs / Math.abs(firstMarket)) * 100 : 0;
        periodTrend = periodChangeAbs > 0 ? "up" : periodChangeAbs < 0 ? "down" : "neutral";
      }
    }

    if (trimmedVisibleSummaries.length > 0) {
      const totalIncome = trimmedVisibleSummaries.reduce((sum: number, s: any) => {
        const incomeTotal = s.income?.total;
        const net =
          typeof incomeTotal === "object" && incomeTotal != null
            ? (incomeTotal.net ?? incomeTotal)
            : (incomeTotal ?? 0);
        return sum + Number(net);
      }, 0);
      const totalExpense = trimmedVisibleSummaries.reduce((sum: number, s: any) => {
        const expenseTotal = s.expense?.total;
        const net =
          typeof expenseTotal === "object" && expenseTotal != null
            ? (expenseTotal.net ?? expenseTotal)
            : (expenseTotal ?? 0);
        return sum + Math.abs(Number(net));
      }, 0);
      savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
    }

    return { periodChangeAbs, periodChangePct, periodTrend, savingsRate };
  }, [periodWealthData, displayStartDate, displayEndDate, trimmedVisibleSummaries]);

  // --- Export & Share handlers ---

  const handleExportWealth = () => {
    if (!wealthData || Object.keys(wealthData).length === 0) {
      toast({
        title: "No data to export",
        description: "There is no wealth data available.",
        variant: "destructive",
      });
      return;
    }
    const csvContent = [
      "Date,Balance,Investment Gain Unrealized,Investment Gain Realized,Investment Gain Total",
      ...Object.entries(wealthData).map(([date, data]) => {
        const unrealized = data.investment_gain_unrealized ?? data.investment_gain;
        const realized = data.investment_gain_realized ?? 0;
        return `${date},${data.balance},${unrealized},${realized},${data.investment_gain}`;
      }),
    ].join("\n");
    downloadCsv(
      csvContent,
      `wealth-evolution-${format(displayStartDate, "yyyy-MM-dd")}-to-${format(displayEndDate, "yyyy-MM-dd")}.csv`,
    );
    toast({
      title: "Export successful",
      description: "Wealth evolution data exported to CSV.",
    });
  };

  const handleShareWealth = () => {
    const shareText = `My Wealth Evolution from ${format(displayStartDate, "MMM d, yyyy")} to ${format(displayEndDate, "MMM d, yyyy")}`;
    shareOrCopy("Wealth Evolution", shareText, toast);
  };

  const handleExportPeriodData = () => {
    if (!periodData?.summaries?.length) {
      toast({
        title: "No data to export",
        description: "No period data available.",
        variant: "destructive",
      });
      return;
    }
    const csvRows = [
      "Period,Income,Expense,Net",
      ...periodData.summaries.map((summary: any) => {
        const income = summary.income.total.net || 0;
        const expense = Math.abs(summary.expense.total.net || 0);
        return `${format(new Date(summary.start_date), "MMM yyyy")},${income},${expense},${income - expense}`;
      }),
    ];
    downloadCsv(
      csvRows.join("\n"),
      `income-expense-${format(displayStartDate, "yyyy-MM-dd")}-to-${format(displayEndDate, "yyyy-MM-dd")}.csv`,
    );
    toast({
      title: "Export successful",
      description: "Period analysis data exported to CSV.",
    });
  };

  const handleSharePeriodData = () => {
    const periodLabel =
      selectedPeriod === "week"
        ? "weekly"
        : selectedPeriod === "month"
          ? "monthly"
          : selectedPeriod === "quarter"
            ? "quarterly"
            : "yearly";
    const shareText = `My ${periodLabel} income and expense data from ${format(displayStartDate, "MMM d, yyyy")} to ${format(displayEndDate, "MMM d, yyyy")}`;
    shareOrCopy("Income & Expense Analysis", shareText, toast);
  };

  useKeyboardShortcuts({
    onPrevPage: () => setDateOffset((prev) => prev + 1),
    onNextPage: () => setDateOffset((prev) => Math.max(0, prev - 1)),
    disabled: false,
  });

  const formatDateRange = () => {
    switch (selectedPeriod) {
      case "week":
        return `${format(displayStartDate, "MMM d, yyyy")} - ${format(displayEndDate, "MMM d, yyyy")}`;
      case "month":
        return `${format(displayStartDate, "MMMM yyyy")} - ${format(displayEndDate, "MMMM yyyy")}`;
      case "quarter": {
        const startQuarter = Math.floor(displayStartDate.getMonth() / 3) + 1;
        const endQuarter = Math.floor(displayEndDate.getMonth() / 3) + 1;
        return `Q${startQuarter} ${format(displayStartDate, "yyyy")} - Q${endQuarter} ${format(displayEndDate, "yyyy")}`;
      }
      case "year":
        return `${format(displayStartDate, "yyyy")} - ${format(displayEndDate, "yyyy")}`;
    }
  };

  /** Full-page skeleton only when there is nothing to render yet; not on net↔gross refetch. */
  const isLoading =
    isLoadingPeriod ||
    (isLoadingWealth && !wealthData) ||
    (isLoadingWealthSummary && !wealthSummary) ||
    (isLoadingPortfolio && !portfolioSummary);
  const hasError = periodError;

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
  );

  const exportShareButtons = (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-1" onClick={handleExportWealth}>
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Export</span>
      </Button>
      <Button variant="outline" size="sm" className="h-8 gap-1" onClick={handleShareWealth}>
        <Share2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Share</span>
      </Button>
    </>
  );

  if (hasError) {
    return (
      <PageContainer title="Wealth Overview" action={dateSelector}>
        <Alert variant="destructive">
          <AlertDescription>
            There was an error loading your financial data. Please try again later.
          </AlertDescription>
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Wealth Overview" action={dateSelector}>
      {isLoading ? (
        <WealthSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          <WealthSnapshot
            breakdown={wealthBreakdown}
            periodChangePct={periodStats.periodChangePct}
            periodChangeAbs={periodStats.periodChangeAbs}
            periodTrend={periodStats.periodTrend}
            savingsRate={periodStats.savingsRate}
            isLoading={isLoadingWealthSummary || isLoadingPortfolio}
          />

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Wealth evolution</CardTitle>
                </div>
                <div className="flex flex-col gap-3 sm:items-end">
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Label
                      htmlFor="wealth-basis"
                      className="text-xs text-muted-foreground shrink-0"
                    >
                      Basis
                    </Label>
                    <Select
                      value={wealthIncludeDebt ? "net" : "gross"}
                      onValueChange={(v) => setWealthIncludeDebt(v === "net")}
                    >
                      <SelectTrigger id="wealth-basis" className="h-8 w-full min-w-0 sm:w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="net">Net worth (with debt)</SelectItem>
                        <SelectItem value="gross">Gross assets (no debt)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="wealth-gain-chart"
                        checked={wealthShowInvestmentGain}
                        onCheckedChange={setWealthShowInvestmentGain}
                      />
                      <Label
                        htmlFor="wealth-gain-chart"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Investment layers
                      </Label>
                    </div>
                    {exportShareButtons}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-0 pb-0">
              <WealthChart
                startDate={displayStartDate}
                endDate={displayEndDate}
                periodType={selectedPeriod}
                wealthData={wealthData}
                isLoading={isLoadingWealth && !wealthData}
                showInvestmentGain={wealthShowInvestmentGain}
                includeDebt={wealthIncludeDebt}
                selectedRange={selectedDateRange}
                onSelectedRangeChange={setSelectedDateRange}
              />
            </CardContent>
          </Card>

          {/* Period Analysis */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-lg font-semibold">Period Analysis</h2>
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
            {periodData ? (
              <PeriodChart
                data={periodData as any}
                selectedRange={selectedDateRange}
                onSelectedRangeChange={setSelectedDateRange}
              />
            ) : (
              <Card className="shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="text-muted-foreground">
                      No data available for the selected period
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

// --- Utility helpers ---

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function shareOrCopy(title: string, text: string, toast: any) {
  if (typeof navigator !== "undefined" && navigator.share) {
    navigator
      .share({ title, text })
      .then(() =>
        toast({
          title: "Shared successfully",
          description: "Your data has been shared.",
        }),
      )
      .catch(() => {
        void copyToClipboard(text, toast);
      });
  } else {
    void copyToClipboard(text, toast);
  }
}
