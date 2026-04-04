import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Tooltip as UITooltip,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import * as React from "react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  currentBalance: number;
  balanceHistory?: Array<{
    date: string;
    value: number;
    balance: number;
    investment_gain: number;
  }>;
}

const timeRangeOptions = {
  "3m": 90,
  "1y": 365,
  "5y": 365 * 5,
  max: Infinity,
} as const;

function getMainAxisFormatter(timeRange: string) {
  switch (timeRange) {
    case "3m":
      return (date: string) => {
        return new Date(date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
      };
    case "1y":
    case "5y":
      return (date: string) => {
        const d = new Date(date);
        return d.toLocaleDateString(undefined, { month: "short" });
      };
    case "max":
      return (date: string) => {
        return new Date(date).toLocaleDateString(undefined, { month: "short" });
      };
    default:
      return (date: string) => date;
  }
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const balance = data.balance;
  const investmentGain = data.investment_gain_value;
  const totalValue = data.total_value;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm">
      <div className="text-xs text-muted-foreground mb-2">
        {new Date(label).toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium">
          Total Value:{" "}
          <span className="text-blue-600">
            {new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: "EUR",
            }).format(totalValue)}
          </span>
        </div>
        <div className="text-sm">
          Balance:{" "}
          <span className="text-blue-500">
            {new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: "EUR",
            }).format(balance)}
          </span>
        </div>
        {investmentGain !== 0 && (
          <div className="text-sm">
            Investment Gain:{" "}
            <span className={investmentGain >= 0 ? "text-green-600" : "text-red-600"}>
              {investmentGain >= 0 ? "+" : ""}
              {new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: "EUR",
              }).format(investmentGain)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Today's date as YYYY-MM-DD (local). */
function getTodayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Extend history so the chart runs through today. The API returns the last
 * point at the last transaction date; from then until today balance is unchanged.
 */
function extendHistoryToToday(
  history: Array<{
    date: string;
    value: number;
    balance: number;
    investment_gain: number;
  }>,
): typeof history {
  if (!history.length) return history;
  const last = history[history.length - 1];
  const today = getTodayDateString();
  if (last.date >= today) return history;
  return [
    ...history,
    {
      date: today,
      value: last.value,
      balance: last.balance,
      investment_gain: last.investment_gain,
    },
  ];
}

type HistoryPoint = {
  date: string;
  value: number;
  balance: number;
  investment_gain: number;
};

/**
 * Fill one point per day so the tooltip doesn't jump between sparse dates.
 * For each day, use the balance from the most recent point on or before that day.
 */
function fillDailyPoints(points: HistoryPoint[]): HistoryPoint[] {
  if (!points.length) return points;
  const start = points[0].date;
  const end = points[points.length - 1].date;
  const startMs = new Date(start + "T12:00:00").getTime();
  const endMs = new Date(end + "T12:00:00").getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const result: HistoryPoint[] = [];
  let idx = 0;
  for (let t = startMs; t <= endMs; t += oneDayMs) {
    const dateStr = new Date(t).toLocaleDateString("sv-SE"); // YYYY-MM-DD
    while (idx + 1 < points.length && points[idx + 1].date <= dateStr) idx += 1;
    const p = points[idx];
    result.push({
      date: dateStr,
      value: p.value,
      balance: p.balance,
      investment_gain: p.investment_gain,
    });
  }
  return result;
}

export function AccountBalanceChart({ currentBalance, balanceHistory }: Props) {
  const [timeRange, setTimeRange] = React.useState("3m");

  // Memoize all data transformations
  const { filteredData, yDomain, valueChange, investmentGainChange, mainAxisFormatter } =
    useMemo(() => {
      if (!balanceHistory || !Array.isArray(balanceHistory))
        return {
          filteredData: [],
          yDomain: [0, 0] as [number, number],
          valueChange: 0,
          investmentGainChange: 0,
          mainAxisFormatter: getMainAxisFormatter(timeRange),
        };

      // Extend through today so the chart doesn't stop at last transaction date
      const historyWithToday = extendHistoryToToday(balanceHistory);

      // Filter data based on time range
      const referenceDate = new Date(historyWithToday[historyWithToday.length - 1].date);
      const daysToSubtract = timeRangeOptions[timeRange as keyof typeof timeRangeOptions];

      const rawFilteredData =
        timeRange === "max"
          ? historyWithToday
          : historyWithToday.filter((item) => {
              const date = new Date(item.date);
              const startDate = new Date(referenceDate);
              startDate.setDate(startDate.getDate() - daysToSubtract);
              return date >= startDate;
            });

      // One point per day so tooltip doesn't jump between sparse dates
      const dailyPoints = fillDailyPoints(rawFilteredData);

      // Transform data: add dateMs so x-axis uses time scale (gap last point → today is proportional to days)
      const filteredData = dailyPoints.map((item) => {
        const dateStr = item.date;
        const dateMs = new Date(dateStr + "T12:00:00").getTime(); // noon to avoid DST gaps
        return {
          date: dateStr,
          dateMs,
          balance: item.balance,
          total_value: item.balance + item.investment_gain,
          investment_gain_value: item.investment_gain,
          // For negative gains, we need to ensure proper stacking
          investment_gain_display:
            item.investment_gain >= 0
              ? item.balance + item.investment_gain // Positive gains stack on top
              : item.balance, // For negative gains, the "top" is just the balance
          balance_with_negative_gains:
            item.investment_gain < 0
              ? item.balance + item.investment_gain // For negative gains, this becomes the bottom
              : item.balance, // For positive gains, this stays the same
        };
      });

      const visibleBalances = filteredData.map((item) => item.balance);
      const visibleTotalValues = filteredData.map((item) => item.total_value);
      const visibleNegativeValues = filteredData.map((item) => item.balance_with_negative_gains);

      const minBalance = Math.min(...visibleBalances);
      const maxBalance = Math.max(...visibleBalances);
      const minTotal = Math.min(...visibleTotalValues, ...visibleNegativeValues);
      const maxTotal = Math.max(...visibleTotalValues, ...visibleBalances);

      const balanceRange = maxBalance - minBalance;
      const totalRange = maxTotal - minTotal;
      const padding = {
        top: Math.max(balanceRange, totalRange) * 0.1,
        bottom: Math.max(balanceRange, totalRange) * 0.1,
      };

      const shouldStartFromZero = minBalance > 0 && minBalance < maxBalance * 0.05;
      const yDomain = [
        shouldStartFromZero ? 0 : Math.min(minBalance, minTotal) - padding.bottom,
        Math.max(maxBalance, maxTotal) + padding.top,
      ] as [number, number];

      // Calculate value changes based on filtered data
      const valueChange = currentBalance - (filteredData[0]?.balance ?? currentBalance);
      const currentInvestmentGain =
        filteredData[filteredData.length - 1]?.investment_gain_value || 0;
      const initialInvestmentGain = filteredData[0]?.investment_gain_value || 0;
      const investmentGainChange = currentInvestmentGain - initialInvestmentGain;

      return {
        filteredData,
        yDomain,
        valueChange,
        investmentGainChange,
        mainAxisFormatter: getMainAxisFormatter(timeRange),
      };
    }, [balanceHistory, timeRange, currentBalance]);

  if (!balanceHistory) {
    return (
      <Card>
        <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5">
          <div className="h-16 w-full animate-pulse bg-muted rounded" />
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="h-[250px] w-full animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const currentInvestmentGain = filteredData[filteredData.length - 1]?.investment_gain_value || 0;

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <CardTitle>Balance History</CardTitle>
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Track your account balance over time, including investment gains</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>
          <CardDescription className="space-y-1">
            <div>
              Balance:{" "}
              {new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: "EUR",
              }).format(currentBalance)}
              {" · "}
              Change:{" "}
              <span className={valueChange >= 0 ? "text-green-500" : "text-red-500"}>
                {valueChange >= 0 ? "+" : ""}
                {new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency: "EUR",
                }).format(valueChange)}
              </span>
            </div>
            {currentInvestmentGain !== 0 && (
              <div>
                Investment Gain:{" "}
                <span
                  className={`font-medium ${currentInvestmentGain >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {currentInvestmentGain >= 0 ? "+" : ""}
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: "EUR",
                  }).format(currentInvestmentGain)}
                </span>
                {" · "}
                Change:{" "}
                <span className={investmentGainChange >= 0 ? "text-green-500" : "text-red-500"}>
                  {investmentGainChange >= 0 ? "+" : ""}
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: "EUR",
                  }).format(investmentGainChange)}
                </span>
              </div>
            )}
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[160px] rounded-lg sm:ml-auto" aria-label="Select time range">
            <SelectValue placeholder="3 months" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="3m" className="rounded-lg">
              3 months
            </SelectItem>
            <SelectItem value="1y" className="rounded-lg">
              1 year
            </SelectItem>
            <SelectItem value="5y" className="rounded-lg">
              5 years
            </SelectItem>
            <SelectItem value="max" className="rounded-lg">
              Max
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(217, 91%, 97%)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="fillInvestmentGain" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 76%, 90%)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="dateMs"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                interval="preserveStartEnd"
                tickFormatter={(value) =>
                  mainAxisFormatter(new Date(value).toLocaleDateString("sv-SE"))
                }
                stroke="#9CA3AF"
              />
              <YAxis
                domain={yDomain}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) =>
                  new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: "EUR",
                    notation: "compact",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 1,
                  }).format(value)
                }
                width={80}
                stroke="#9CA3AF"
              />
              {/* Base balance area - always visible */}
              <Area
                type="monotone"
                dataKey="balance_with_negative_gains"
                stroke="none"
                fill="url(#fillBalance)"
                strokeWidth={0}
              />

              {/* Balance line - the reference line that gains stick to */}
              <Area
                type="monotone"
                dataKey="balance"
                stroke="hsl(217, 91%, 60%)"
                fill="url(#fillBalance)"
                strokeWidth={2}
              />

              {/* Investment gains area - sticks to balance line */}
              <Area
                type="monotone"
                dataKey="total_value"
                stroke="hsl(142, 76%, 36%)"
                fill="url(#fillInvestmentGain)"
                strokeWidth={2}
              />
              <Tooltip content={<CustomTooltip />} wrapperStyle={{ outline: "none" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
