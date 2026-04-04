import { useAllCategories, useBudgets } from "@/api/queries";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/utils/currency";
import { CheckIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface BudgetSetupItem {
  category: string;
  amount: number | "";
  isSet: boolean;
  color?: string;
}

type CategoryType = "income" | "expense";

export default function BudgetSetupPage() {
  const [type, setType] = useState<CategoryType>("expense");
  const [budgetItems, setBudgetItems] = useState<BudgetSetupItem[]>([]);
  const [currentYear] = useState(new Date().getFullYear());
  const [currentMonth] = useState(new Date().getMonth() + 1);
  const [autoFillAmount, setAutoFillAmount] = useState<number | "">("");
  const [isLoading, setIsLoading] = useState(false);

  const { data: allCategories, isLoading: loadingCategories } = useAllCategories();
  const {
    data: existingBudgets = [],
    isLoading: budgetsLoading,
    refetch: refetchBudgets,
  } = useBudgets(currentYear, currentMonth);
  const { useCreate, useUpdate } = useBudgets();
  const createBudgetMutation = useCreate();
  const updateBudgetMutation = useUpdate();

  // Initialize budget items when categories load
  useEffect(() => {
    if (!allCategories) return;

    const categories = type === "expense" ? allCategories.expense : allCategories.income;
    if (!categories) return;

    const items: BudgetSetupItem[] = categories.map((category) => {
      const categoryForBudget = type === "expense" ? category.name.fr : `+${category.name.fr}`;
      const existingBudget = existingBudgets.find(
        (budget) =>
          budget.category === categoryForBudget &&
          budget.year === currentYear &&
          budget.month === currentMonth,
      );

      return {
        category: category.name.fr,
        amount: existingBudget ? existingBudget.amount : "",
        isSet: !!existingBudget,
        color: category.color,
      };
    });

    setBudgetItems(items);
  }, [allCategories, type, existingBudgets, currentYear, currentMonth]);

  const handleAmountChange = (index: number, value: string) => {
    const numValue = value === "" ? "" : parseFloat(value);
    if (value !== "" && (isNaN(numValue as number) || (numValue as number) < 0)) {
      return;
    }

    setBudgetItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, amount: numValue, isSet: false } : item)),
    );
  };

  const handleAutoFill = () => {
    if (autoFillAmount === "" || autoFillAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than zero for auto-fill.",
        variant: "destructive",
      });
      return;
    }

    setBudgetItems((prev) =>
      prev.map((item) =>
        item.amount === "" && !item.isSet ? { ...item, amount: autoFillAmount } : item,
      ),
    );
  };

  const saveBudget = async (index: number) => {
    const item = budgetItems[index];
    if (item.amount === "" || item.amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than zero.",
        variant: "destructive",
      });
      return;
    }

    try {
      const categoryForBudget = type === "expense" ? item.category : `+${item.category}`;
      const existingBudget = existingBudgets.find(
        (budget) =>
          budget.category === categoryForBudget &&
          budget.year === currentYear &&
          budget.month === currentMonth,
      );

      if (existingBudget) {
        await updateBudgetMutation.mutateAsync({
          id: existingBudget.id,
          amount: item.amount as number,
        });
      } else {
        const nowIso = new Date().toISOString();
        await createBudgetMutation.mutateAsync({
          category: categoryForBudget,
          amount: item.amount as number,
          year: currentYear,
          month: currentMonth,
          created_at: nowIso,
          updated_at: nowIso,
        });
      }

      setBudgetItems((prev) =>
        prev.map((budgetItem, i) => (i === index ? { ...budgetItem, isSet: true } : budgetItem)),
      );

      await refetchBudgets();

      toast({
        title: "Budget Saved",
        description: `Budget for ${item.category} has been saved successfully.`,
      });
    } catch (error) {
      console.error("Failed to save budget:", error);
      toast({
        title: "Error",
        description: "Failed to save budget. Please try again.",
        variant: "destructive",
      });
    }
  };

  const saveAllBudgets = async () => {
    const unsavedItems = budgetItems.filter(
      (item) => !item.isSet && item.amount !== "" && item.amount > 0,
    );

    if (unsavedItems.length === 0) {
      toast({
        title: "No Changes",
        description: "All budgets are already saved or no valid amounts entered.",
      });
      return;
    }

    setIsLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const item of unsavedItems) {
      try {
        const categoryForBudget = type === "expense" ? item.category : `+${item.category}`;
        const existingBudget = existingBudgets.find(
          (budget) =>
            budget.category === categoryForBudget &&
            budget.year === currentYear &&
            budget.month === currentMonth,
        );

        if (existingBudget) {
          await updateBudgetMutation.mutateAsync({
            id: existingBudget.id,
            amount: item.amount as number,
          });
        } else {
          const nowIso = new Date().toISOString();
          await createBudgetMutation.mutateAsync({
            category: categoryForBudget,
            amount: item.amount as number,
            year: currentYear,
            month: currentMonth,
            created_at: nowIso,
            updated_at: nowIso,
          });
        }

        successCount++;
      } catch (error) {
        console.error(`Failed to save budget for ${item.category}:`, error);
        errorCount++;
      }
    }

    if (successCount > 0) {
      setBudgetItems((prev) =>
        prev.map((item) =>
          !item.isSet && item.amount !== "" && item.amount > 0 ? { ...item, isSet: true } : item,
        ),
      );
      await refetchBudgets();
    }

    setIsLoading(false);

    if (errorCount === 0) {
      toast({
        title: "Success",
        description: `All ${successCount} budgets have been saved successfully.`,
      });
    } else {
      toast({
        title: "Partial Success",
        description: `${successCount} budgets saved, ${errorCount} failed. Please check and retry.`,
        variant: "destructive",
      });
    }
  };

  const totalBudget = budgetItems.reduce((sum, item) => {
    const amount = typeof item.amount === "number" ? item.amount : 0;
    return sum + amount;
  }, 0);

  const savedCount = budgetItems.filter((item) => item.isSet).length;
  const pendingCount = budgetItems.filter(
    (item) => !item.isSet && item.amount !== "" && item.amount > 0,
  ).length;

  if (loadingCategories || budgetsLoading) {
    return (
      <PageContainer title="Budget Setup">
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Budget Setup"
      description="Set up your monthly budgets for all categories. Use auto-fill to quickly set the same amount for multiple categories."
    >
      <div className="flex flex-1 flex-col gap-6">
        {/* Type Selector */}
        <Tabs
          value={type}
          onValueChange={(value) => setType(value as CategoryType)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="expense">Expense Categories</TabsTrigger>
            <TabsTrigger value="income">Income Categories</TabsTrigger>
          </TabsList>

          <TabsContent value={type} className="space-y-6">
            {/* Auto-fill Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Setup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label htmlFor="autoFillAmount">Auto-fill Amount</Label>
                    <Input
                      id="autoFillAmount"
                      type="number"
                      placeholder="Enter amount to auto-fill empty budgets"
                      value={autoFillAmount}
                      onChange={(e) =>
                        setAutoFillAmount(e.target.value === "" ? "" : parseFloat(e.target.value))
                      }
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <Button onClick={handleAutoFill} variant="outline">
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Auto-fill Empty
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  This will set the entered amount for all categories that don&apos;t have a budget
                  yet.
                </p>
              </CardContent>
            </Card>

            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Budget Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{budgetItems.length}</p>
                    <p className="text-sm text-muted-foreground">Total Categories</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{savedCount}</p>
                    <p className="text-sm text-muted-foreground">Saved</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{formatCurrency(totalBudget)}</p>
                    <p className="text-sm text-muted-foreground">Total Budget</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Budget Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">
                  {type === "expense" ? "Expense" : "Income"} Categories
                </CardTitle>
                {pendingCount > 0 && (
                  <Button onClick={saveAllBudgets} disabled={isLoading} className="ml-auto">
                    {isLoading ? "Saving..." : `Save All (${pendingCount})`}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {budgetItems.map((item, index) => (
                    <div
                      key={item.category}
                      className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color || "#888888" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.category}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={item.amount}
                          onChange={(e) => handleAmountChange(index, e.target.value)}
                          className="w-32"
                          min="0"
                          step="0.01"
                        />
                        {item.isSet ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckIcon className="h-4 w-4" />
                            <span className="text-sm">Saved</span>
                          </div>
                        ) : (
                          <Button
                            onClick={() => saveBudget(index)}
                            size="sm"
                            disabled={item.amount === "" || item.amount <= 0}
                          >
                            Save
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
