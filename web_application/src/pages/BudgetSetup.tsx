import { useAllCategories, useBudgets, usePeriodSummary, useTransactions } from "@/api/queries";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import type { Budget, PeriodSummaryData } from "@/types/budget";
import type { CategoryMetadata } from "@/types/category";
import { formatCurrency } from "@/utils/currency";
import { CheckIcon, SaveIcon, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type BudgetCategoryType = "income" | "expense";

type MonthKey = `${number}-${string}`;

interface BudgetDraft {
  value: number | "";
  original: number | null;
}

interface PhaseDraft {
  splitMonth: MonthKey;
  firstAmount: number | "";
  secondAmount: number | "";
}

function toMonthKey(year: number, month: number): MonthKey {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseMonthKey(monthKey: MonthKey) {
  const [yearStr, monthStr] = monthKey.split("-");
  return {
    year: Number(yearStr),
    month: Number(monthStr),
  };
}

function monthLabel(monthKey: MonthKey) {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function addMonths(monthKey: MonthKey, monthsToAdd: number): MonthKey {
  const { year, month } = parseMonthKey(monthKey);
  const date = new Date(year, month - 1 + monthsToAdd, 1);
  return toMonthKey(date.getFullYear(), date.getMonth() + 1);
}

function buildMonthRange(start: MonthKey, end: MonthKey): MonthKey[] {
  if (start > end) return [];
  const months: MonthKey[] = [];
  let cursor = start;
  while (cursor <= end) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

function monthKeyToDateRange(monthKey: MonthKey) {
  const { year, month } = parseMonthKey(monthKey);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function getCategoryForBudget(type: BudgetCategoryType, category: string) {
  return type === "expense" ? category : `+${category}`;
}

function fromBudgetCategory(type: BudgetCategoryType, category: string) {
  if (type === "income" && category.startsWith("+")) return category.slice(1);
  return category;
}

function draftKey(type: BudgetCategoryType, category: string, month: MonthKey) {
  return `${type}|${category}|${month}`;
}

export default function BudgetSetupPage() {
  const [type, setType] = useState<BudgetCategoryType>("expense");
  const [startMonth, setStartMonth] = useState<MonthKey>(toMonthKey(new Date().getFullYear(), 1));
  const [endMonth, setEndMonth] = useState<MonthKey>(
    toMonthKey(new Date().getFullYear(), new Date().getMonth() + 1),
  );
  const [drafts, setDrafts] = useState<Record<string, BudgetDraft>>({});
  const [phaseByCategory, setPhaseByCategory] = useState<Record<string, PhaseDraft>>({});
  const [isSaving, setIsSaving] = useState(false);

  const { data: allCategories, isLoading: loadingCategories } = useAllCategories();
  const {
    data: allBudgets = [],
    isLoading: loadingBudgets,
    refetch: refetchBudgets,
  } = useBudgets();
  const { useCreate, useUpdate } = useBudgets();
  const createBudgetMutation = useCreate();
  const updateBudgetMutation = useUpdate();

  const { data: earliestTxResponse, isLoading: earliestLoading } = useTransactions({
    page: 1,
    per_page: 1,
    sort_by: "date_accountability",
    sort_order: "asc",
    type,
  });

  const firstTxDate = earliestTxResponse?.items?.[0]?.date_accountability ?? null;

  useEffect(() => {
    if (!firstTxDate) return;
    const d = new Date(firstTxDate);
    if (Number.isNaN(d.getTime())) return;
    const firstMonth = toMonthKey(d.getFullYear(), d.getMonth() + 1);
    setStartMonth((prev) => (prev > firstMonth ? firstMonth : prev));
  }, [firstTxDate]);

  const categories = useMemo<CategoryMetadata[]>(() => {
    if (!allCategories) return [];
    return type === "expense" ? allCategories.expense : allCategories.income;
  }, [allCategories, type]);

  const months = useMemo(() => buildMonthRange(startMonth, endMonth), [startMonth, endMonth]);

  const rangeStartDate = useMemo(() => monthKeyToDateRange(startMonth).start, [startMonth]);
  const rangeEndDate = useMemo(() => monthKeyToDateRange(endMonth).end, [endMonth]);

  const { data: periodSummary, isLoading: periodLoading } = usePeriodSummary(
    rangeStartDate,
    rangeEndDate,
    "month",
  );

  const summaryByMonth = useMemo(() => {
    const map = new Map<MonthKey, PeriodSummaryData>();
    for (const summary of periodSummary?.summaries ?? []) {
      const d = new Date(summary.start_date);
      const key = toMonthKey(d.getFullYear(), d.getMonth() + 1);
      map.set(key, summary);
    }
    return map;
  }, [periodSummary]);

  const budgetsMap = useMemo(() => {
    const map = new Map<string, Budget>();
    for (const budget of allBudgets) {
      const normalizedCategory = fromBudgetCategory(type, budget.category);
      const key = `${normalizedCategory}|${toMonthKey(budget.year, budget.month)}`;
      map.set(key, budget);
    }
    return map;
  }, [allBudgets, type]);

  const firstUnbudgetedMonth = useMemo(() => {
    for (const month of months) {
      const hasMissing = categories.some((category) => {
        const key = `${category.name.fr}|${month}`;
        return !budgetsMap.has(key);
      });
      if (hasMissing) return month;
    }
    return null;
  }, [months, categories, budgetsMap]);

  useEffect(() => {
    if (!categories.length || !months.length) return;

    setDrafts((prev) => {
      const next: Record<string, BudgetDraft> = { ...prev };
      for (const category of categories) {
        for (const month of months) {
          const dKey = draftKey(type, category.name.fr, month);
          if (next[dKey]) continue;
          const existing = budgetsMap.get(`${category.name.fr}|${month}`);
          next[dKey] = {
            value: existing ? existing.amount : "",
            original: existing ? existing.amount : null,
          };
        }
      }
      return next;
    });

    setPhaseByCategory((prev) => {
      const next = { ...prev };
      for (const category of categories) {
        if (next[category.name.fr]) continue;
        next[category.name.fr] = {
          splitMonth: months[Math.floor(months.length / 2)] ?? months[0],
          firstAmount: "",
          secondAmount: "",
        };
      }
      return next;
    });
  }, [categories, months, budgetsMap, type]);

  const isLoading = loadingCategories || loadingBudgets || periodLoading || earliestLoading;

  const handleMonthValueChange = (category: string, month: MonthKey, raw: string) => {
    const value = raw === "" ? "" : Number(raw);
    if (value !== "" && (!Number.isFinite(value) || value < 0)) return;
    const key = draftKey(type, category, month);
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        value,
        original: prev[key]?.original ?? null,
      },
    }));
  };

  const getSpentValue = (category: string, month: MonthKey) => {
    const monthSummary = summaryByMonth.get(month);
    if (!monthSummary) return 0;
    const source =
      type === "expense" ? monthSummary.expense.by_category : monthSummary.income.by_category;
    return Math.abs(source[category]?.net_amount ?? 0);
  };

  const applyCategoryPhase = (category: string) => {
    const phase = phaseByCategory[category];
    if (!phase) return;
    if (phase.firstAmount === "" || phase.secondAmount === "") {
      toast({
        title: "Phase values missing",
        description: "Please set both phase amounts before applying.",
        variant: "destructive",
      });
      return;
    }

    setDrafts((prev) => {
      const next = { ...prev };
      for (const month of months) {
        const key = draftKey(type, category, month);
        next[key] = {
          value: month <= phase.splitMonth ? phase.firstAmount : phase.secondAmount,
          original: prev[key]?.original ?? null,
        };
      }
      return next;
    });
  };

  const fillFromAverageSpent = (category: string) => {
    const spentValues = months.map((m) => getSpentValue(category, m));
    if (spentValues.length === 0) return;
    const avg = spentValues.reduce((sum, v) => sum + v, 0) / spentValues.length;
    const rounded = Math.round(avg);

    setDrafts((prev) => {
      const next = { ...prev };
      for (const month of months) {
        const key = draftKey(type, category, month);
        next[key] = {
          value: rounded,
          original: prev[key]?.original ?? null,
        };
      }
      return next;
    });
  };

  const changedEntries = useMemo(() => {
    const entries: Array<{
      category: string;
      month: MonthKey;
      amount: number;
      existing: Budget | null;
    }> = [];

    for (const category of categories) {
      for (const month of months) {
        const key = draftKey(type, category.name.fr, month);
        const draft = drafts[key];
        if (!draft || draft.value === "") continue;
        const existing = budgetsMap.get(`${category.name.fr}|${month}`) ?? null;
        const amount = draft.value;
        const hasChanged = existing ? existing.amount !== amount : amount > 0;
        if (hasChanged) {
          entries.push({ category: category.name.fr, month, amount, existing });
        }
      }
    }

    return entries;
  }, [categories, months, drafts, budgetsMap, type]);

  const handleSaveAll = async () => {
    if (!changedEntries.length) {
      toast({
        title: "No changes",
        description: "All budgets are already up to date.",
      });
      return;
    }

    setIsSaving(true);
    let success = 0;
    let failed = 0;

    for (const entry of changedEntries) {
      const { year, month } = parseMonthKey(entry.month);
      try {
        if (entry.existing) {
          await updateBudgetMutation.mutateAsync({
            id: entry.existing.id,
            amount: entry.amount,
          });
        } else {
          const nowIso = new Date().toISOString();
          await createBudgetMutation.mutateAsync({
            category: getCategoryForBudget(type, entry.category),
            amount: entry.amount,
            year,
            month,
            created_at: nowIso,
            updated_at: nowIso,
          });
        }
        success += 1;
      } catch {
        failed += 1;
      }
    }

    await refetchBudgets();
    setIsSaving(false);

    if (failed === 0) {
      toast({
        title: "Budgets saved",
        description: `${success} monthly budgets saved successfully.`,
      });
    } else {
      toast({
        title: "Partial save",
        description: `${success} saved, ${failed} failed. Please retry.`,
        variant: "destructive",
      });
    }
  };

  const totalPlanned = useMemo(() => {
    return categories.reduce((sum, category) => {
      return (
        sum +
        months.reduce((monthSum, month) => {
          const draft = drafts[draftKey(type, category.name.fr, month)];
          return monthSum + (typeof draft?.value === "number" ? draft.value : 0);
        }, 0)
      );
    }, 0);
  }, [categories, months, drafts, type]);

  if (isLoading) {
    return (
      <PageContainer title="Budget Setup">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Budget Setup"
      description="Plan budgets month-by-month using real spending history and apply phased values across a period in one go."
    >
      <div className="flex flex-col gap-6">
        <Tabs
          value={type}
          onValueChange={(v) => setType(v as BudgetCategoryType)}
          className="w-full"
        >
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="expense">Expense budgets</TabsTrigger>
            <TabsTrigger value="income">Income budgets</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Planning Window</CardTitle>
            <CardDescription>
              Start from first month with transactions and plan all months until your target month.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="start-month">Start month</Label>
              <Input
                id="start-month"
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth((e.target.value as MonthKey) || startMonth)}
                max={endMonth}
              />
            </div>
            <div>
              <Label htmlFor="end-month">End month</Label>
              <Input
                id="end-month"
                type="month"
                value={endMonth}
                onChange={(e) => setEndMonth((e.target.value as MonthKey) || endMonth)}
                min={startMonth}
              />
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Months in plan</p>
              <p className="text-xl font-semibold">{months.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Changed entries</p>
              <p className="text-xl font-semibold text-orange-600">{changedEntries.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Total planned for selected range</p>
              <p className="text-2xl font-semibold">{formatCurrency(totalPlanned)}</p>
              {firstUnbudgetedMonth && (
                <p className="text-xs text-amber-600 mt-1">
                  First month with missing budgets: {monthLabel(firstUnbudgetedMonth)}
                </p>
              )}
            </div>
            <Button onClick={handleSaveAll} disabled={isSaving || changedEntries.length === 0}>
              <SaveIcon className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : `Save all changes (${changedEntries.length})`}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{type === "expense" ? "Expense" : "Income"} Monthly Planner</CardTitle>
            <CardDescription>
              Each month shows actual spent/received and your editable budget. Use phased fill per
              category to set two budget levels across the range.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[240px]">Category</TableHead>
                    {months.map((month) => (
                      <TableHead key={month} className="min-w-[170px]">
                        {monthLabel(month)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => {
                    const phase = phaseByCategory[category.name.fr] ?? {
                      splitMonth: months[0],
                      firstAmount: "",
                      secondAmount: "",
                    };

                    return (
                      <TableRow key={category.id}>
                        <TableCell className="align-top">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 rounded-full"
                                style={{
                                  backgroundColor: category.color ?? "#888",
                                }}
                              />
                              <span className="font-medium">{category.name.fr}</span>
                            </div>

                            <div className="space-y-2 rounded-md border bg-muted/30 p-2">
                              <p className="text-xs font-medium text-muted-foreground">
                                Two-phase fill
                              </p>
                              <div className="grid grid-cols-1 gap-2">
                                <Input
                                  type="month"
                                  value={phase.splitMonth}
                                  min={startMonth}
                                  max={endMonth}
                                  onChange={(e) =>
                                    setPhaseByCategory((prev) => ({
                                      ...prev,
                                      [category.name.fr]: {
                                        ...phase,
                                        splitMonth:
                                          (e.target.value as MonthKey) || phase.splitMonth,
                                      },
                                    }))
                                  }
                                />
                                <Input
                                  type="number"
                                  placeholder="Amount before split"
                                  value={phase.firstAmount}
                                  min="0"
                                  step="0.01"
                                  onChange={(e) =>
                                    setPhaseByCategory((prev) => ({
                                      ...prev,
                                      [category.name.fr]: {
                                        ...phase,
                                        firstAmount:
                                          e.target.value === "" ? "" : Number(e.target.value),
                                      },
                                    }))
                                  }
                                />
                                <Input
                                  type="number"
                                  placeholder="Amount after split"
                                  value={phase.secondAmount}
                                  min="0"
                                  step="0.01"
                                  onChange={(e) =>
                                    setPhaseByCategory((prev) => ({
                                      ...prev,
                                      [category.name.fr]: {
                                        ...phase,
                                        secondAmount:
                                          e.target.value === "" ? "" : Number(e.target.value),
                                      },
                                    }))
                                  }
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => applyCategoryPhase(category.name.fr)}
                                    className="flex-1"
                                  >
                                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                                    Apply phase
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => fillFromAverageSpent(category.name.fr)}
                                  >
                                    Avg
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {months.map((month) => {
                          const spent = getSpentValue(category.name.fr, month);
                          const key = draftKey(type, category.name.fr, month);
                          const draft = drafts[key];
                          const currentValue = draft?.value ?? "";
                          const changed =
                            typeof currentValue === "number"
                              ? draft?.original == null
                                ? currentValue > 0
                                : currentValue !== draft.original
                              : false;

                          return (
                            <TableCell key={month} className="align-top">
                              <div className="space-y-2">
                                <div>
                                  <p className="text-[11px] uppercase text-muted-foreground">
                                    Actual
                                  </p>
                                  <p className="text-sm font-medium">{formatCurrency(spent)}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] uppercase text-muted-foreground">
                                    Budget
                                  </p>
                                  <Input
                                    type="number"
                                    value={currentValue}
                                    min="0"
                                    step="0.01"
                                    onChange={(e) =>
                                      handleMonthValueChange(
                                        category.name.fr,
                                        month,
                                        e.target.value,
                                      )
                                    }
                                  />
                                </div>
                                <div className="h-5">
                                  {changed ? (
                                    <span className="inline-flex items-center text-xs text-orange-600">
                                      <CheckIcon className="mr-1 h-3 w-3" />
                                      Changed
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">No change</span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
