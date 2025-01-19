import { CategoryChart } from "@/components/categories/category-chart";
import { CategoryList } from "@/components/categories/category-list";
import { CategorySankey } from "@/components/categories/category-sankey";
import { DateScopeSelector } from "@/components/categories/date-scope-selector";
import { MoneySummary } from "@/components/categories/money-summary";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangeProvider } from "@/contexts/date-range-context";
import { useCategories } from "@/hooks/use-categories";

type CategoryType = "income" | "expense";

export default function CategoriesPage() {
  const { type, setType } = useCategories()

  return (
    <DateRangeProvider>
      <PageContainer
        title="Categories"
        action={
          <Tabs value={type} onValueChange={(value) => setType(value as CategoryType)} className="w-[400px]">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expense">Expenses</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <div className="flex flex-1 flex-col gap-4">
          <DateScopeSelector />
          <MoneySummary />

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {type === "expense" ? "Spending" : "Income"} by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryChart />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Category Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryList />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Money Flow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CategorySankey />
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </DateRangeProvider>
  );
}
