import { usePeriodSummary, useWealthOverTimeWithGains } from "@/api/queries";
import { PageContainer } from "@/components/layout/PageContainer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PeriodChart } from "@/components/wealth/PeriodChart";
import { WealthChart } from "@/components/wealth/WealthChart";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { useToast } from "@/hooks/use-toast";
import { formatCompactCurrency, formatCurrency } from "@/utils/currency";
import { format } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Minus,
  PiggyBank,
  Share2,
  TrendingUp,
  Wallet,
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

// --- KPI Hero Cards ---

interface KPICardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  icon: React.ReactNode;
  accentClass?: string;
}

function KPICard({
  label,
  value,
  subValue,
  trend,
  trendLabel,
  icon,
  accentClass = "text-foreground",
}: KPICardProps) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor =
    trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground";

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <div className="rounded-lg bg-muted/50 p-1.5">{icon}</div>
      </div>
      <div className={`text-xl sm:text-2xl font-bold tabular-nums tracking-tight ${accentClass}`}>
        {value}
      </div>
      {(subValue || trendLabel) && (
        <div className="flex items-center gap-1.5 text-xs">
          {trend && <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />}
          {trendLabel && <span className={trendColor}>{trendLabel}</span>}
          {subValue && <span className="text-muted-foreground">{subValue}</span>}
        </div>
      )}
    </div>
  );
}

interface WealthKPIsProps {
  startDate: Date;
  endDate: Date;
  visibleSummaries: any[];
}

function WealthKPIs({ startDate, endDate, visibleSummaries }: WealthKPIsProps) {
  const { data: wealthData } = useWealthOverTimeWithGains();
  const { preferredCurrency } = usePreferredCurrency();
  const curr = preferredCurrency || "EUR";

  const kpis = useMemo(() => {
    if (!wealthData) return null;

    const entries = Object.entries(wealthData);
    if (entries.length === 0) return null;

    const visibleEntries = entries.filter(([date]) => {
      const d = new Date(date);
      return d >= startDate && d <= endDate;
    });

    const latestEntry = entries[entries.length - 1];
    const currentBalance = latestEntry[1].balance;
    const currentInvestmentGain = latestEntry[1].investment_gain;
    const latestCurrencies = latestEntry[1].balance_by_currency;

    let periodChangeAbs = 0;
    let periodChangePct = 0;
    let periodTrend: "up" | "down" | "neutral" = "neutral";

    if (visibleEntries.length >= 2) {
      const firstBalance = visibleEntries[0][1].balance;
      const lastBalance = visibleEntries[visibleEntries.length - 1][1].balance;
      periodChangeAbs = lastBalance - firstBalance;
      periodChangePct = firstBalance !== 0 ? (periodChangeAbs / Math.abs(firstBalance)) * 100 : 0;
      periodTrend = periodChangeAbs > 0 ? "up" : periodChangeAbs < 0 ? "down" : "neutral";
    }

    let savingsRate = 0;
    let savingsTrend: "up" | "down" | "neutral" = "neutral";
    if (visibleSummaries.length > 0) {
      const totalIncome = visibleSummaries.reduce(
        (sum: number, s: any) => sum + (s.income?.total?.net ?? s.income?.total ?? 0),
        0,
      );
      const totalExpense = visibleSummaries.reduce(
        (sum: number, s: any) => sum + Math.abs(s.expense?.total?.net ?? s.expense?.total ?? 0),
        0,
      );
      savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
      savingsTrend = savingsRate >= 20 ? "up" : savingsRate >= 0 ? "neutral" : "down";
    }

    return {
      currentBalance,
      currentInvestmentGain,
      periodChangeAbs,
      periodChangePct,
      periodTrend,
      savingsRate,
      savingsTrend,
      latestCurrencies,
    };
  }, [wealthData, startDate, endDate, visibleSummaries]);

  if (!kpis) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 shadow-sm">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-7 w-28 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KPICard
          label="Net Worth"
          value={formatCompactCurrency(kpis.currentBalance, curr)}
          icon={<Wallet className="h-4 w-4 text-blue-500" />}
          accentClass="text-blue-600"
          subValue={formatCurrency(kpis.currentBalance, curr)}
        />
        <KPICard
          label="Period Change"
          value={`${kpis.periodChangePct >= 0 ? "+" : ""}${kpis.periodChangePct.toFixed(1)}%`}
          trend={kpis.periodTrend}
          trendLabel={`${kpis.periodChangeAbs >= 0 ? "+" : ""}${formatCompactCurrency(kpis.periodChangeAbs, curr)}`}
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          accentClass={
            kpis.periodTrend === "up"
              ? "text-green-600"
              : kpis.periodTrend === "down"
                ? "text-red-600"
                : ""
          }
        />
        <KPICard
          label="Savings Rate"
          value={`${kpis.savingsRate.toFixed(1)}%`}
          trend={kpis.savingsTrend}
          trendLabel={
            kpis.savingsRate >= 20
              ? "Healthy"
              : kpis.savingsRate >= 10
                ? "Moderate"
                : kpis.savingsRate >= 0
                  ? "Low"
                  : "Negative"
          }
          icon={<PiggyBank className="h-4 w-4 text-amber-500" />}
          accentClass={
            kpis.savingsRate >= 20
              ? "text-green-600"
              : kpis.savingsRate >= 10
                ? "text-amber-600"
                : "text-red-600"
          }
        />
        <KPICard
          label="Investment Gain"
          value={`${kpis.currentInvestmentGain >= 0 ? "+" : ""}${formatCompactCurrency(kpis.currentInvestmentGain, curr)}`}
          trend={kpis.currentInvestmentGain >= 0 ? "up" : "down"}
          trendLabel={formatCurrency(kpis.currentInvestmentGain, curr)}
          icon={<TrendingUp className="h-4 w-4 text-purple-500" />}
          accentClass={kpis.currentInvestmentGain >= 0 ? "text-green-600" : "text-red-600"}
        />
      </div>

      {/* Currency Breakdown */}
      {kpis.latestCurrencies && Object.keys(kpis.latestCurrencies).length > 1 && (
        <CurrencyBreakdown
          balanceByCurrency={kpis.latestCurrencies}
          totalBalance={kpis.currentBalance}
          preferredCurrency={curr}
        />
      )}
    </div>
  );
}

// --- Currency Breakdown ---

interface CurrencyBreakdownProps {
  balanceByCurrency: Record<string, number>;
  totalBalance: number;
  preferredCurrency: string;
}

function CurrencyBreakdown({
  balanceByCurrency,
  totalBalance,
  preferredCurrency,
}: CurrencyBreakdownProps) {
  const sorted = Object.entries(balanceByCurrency).sort(
    ([, a], [, b]) => Math.abs(b) - Math.abs(a),
  );
  const absTotal = sorted.reduce((sum, [, amt]) => sum + Math.abs(amt), 0);

  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-purple-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-orange-500",
    "bg-teal-500",
  ];

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Net Worth by Currency
        </span>
        <span className="text-sm font-medium tabular-nums">
          {formatCurrency(totalBalance, preferredCurrency)}
          <span className="text-muted-foreground text-xs ml-1">(converted)</span>
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 mb-3">
        {sorted.map(([currency, amt], i) => {
          const pct = absTotal > 0 ? (Math.abs(amt) / absTotal) * 100 : 0;
          if (pct < 0.5) return null;
          return (
            <div
              key={currency}
              className={`${colors[i % colors.length]} rounded-full transition-all`}
              style={{ width: `${pct}%` }}
              title={`${currency}: ${formatCurrency(amt, currency)}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {sorted.map(([currency, amt], i) => {
          const pct = absTotal > 0 ? (Math.abs(amt) / absTotal) * 100 : 0;
          return (
            <div key={currency} className="flex items-center gap-1.5 text-xs">
              <div className={`h-2.5 w-2.5 rounded-full ${colors[i % colors.length]}`} />
              <span className="font-medium">{currency}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatCurrency(amt, currency)}
              </span>
              <span className="text-muted-foreground">({pct.toFixed(0)}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Loading Skeleton ---

function WealthSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 shadow-sm">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-7 w-28 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
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
  );
}

// --- Main Page ---

export function Wealth() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("month");
  const [dateOffset, setDateOffset] = useState(0);
  const [periodRange, setPeriodRange] = useState<RangeType>(12);
  const [selectedDateRange, setSelectedDateRange] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);
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

  const { data: wealthData, isLoading: isLoadingWealth } = useWealthOverTimeWithGains();

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

  const displayStartDate =
    visibleSummaries.length > 0 ? new Date(visibleSummaries[0].start_date) : startDate;
  const displayEndDate =
    visibleSummaries.length > 0
      ? new Date(visibleSummaries[visibleSummaries.length - 1].end_date)
      : endDate;

  const periodData = rawPeriodData ? { ...rawPeriodData, summaries: visibleSummaries } : undefined;

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
      "Date,Balance,Investment Gain",
      ...Object.entries(wealthData).map(
        ([date, data]) => `${date},${data.balance},${data.investment_gain}`,
      ),
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

  const isLoading = isLoadingPeriod || isLoadingWealth;
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
          {/* KPI Hero Cards + Currency Breakdown */}
          <WealthKPIs
            startDate={displayStartDate}
            endDate={displayEndDate}
            visibleSummaries={visibleSummaries}
          />

          {/* Wealth Evolution Chart */}
          <Card className="shadow-sm">
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Wealth Evolution</CardTitle>
                  <CardDescription>Track your net worth over time</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <WealthChart
                startDate={displayStartDate}
                endDate={displayEndDate}
                periodType={selectedPeriod}
                headerActions={exportShareButtons}
                selectedRange={selectedDateRange}
                onSelectedRangeChange={setSelectedDateRange}
              />
            </CardContent>
          </Card>

          {/* Period Analysis */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-lg font-semibold">Period Analysis</h2>
                <p className="text-sm text-muted-foreground">
                  Compare income and expenses across {selectedPeriod}s
                </p>
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
