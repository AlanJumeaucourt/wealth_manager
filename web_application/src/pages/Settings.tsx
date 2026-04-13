import { usePreferredCurrencyOptions } from "@/api/queries";
import { PageContainer } from "@/components/layout/PageContainer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreferredCurrency } from "@/hooks/use-preferred-currency";
import { useToast } from "@/hooks/use-toast";
import { Cog, Wallet } from "lucide-react";
import { useMemo } from "react";

export function SettingsPage() {
  const { preferredCurrency, updatePreferredCurrency, isUpdating } = usePreferredCurrency();
  const { data, isLoading, error } = usePreferredCurrencyOptions();
  const { toast } = useToast();

  const availableCurrencies = useMemo(() => data?.currencies ?? [], [data]);
  const hasCurrencies = availableCurrencies.length > 0;
  const selectedCurrency = hasCurrencies
    ? availableCurrencies.includes(preferredCurrency)
      ? preferredCurrency
      : availableCurrencies[0]
    : "";

  const onCurrencyChange = (value: string) => {
    if (!value) return;
    updatePreferredCurrency(value, {
      onSuccess: () => {
        toast({
          title: "Preferred currency updated",
          description: `Amounts will now be displayed in ${value}.`,
        });
      },
      onError: () => {
        toast({
          title: "Could not update currency",
          description: "Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <PageContainer title="Settings" description="Manage your display preferences for the web app.">
      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Preferred Currency</CardTitle>
                <CardDescription>
                  Currency options are restricted to unique currencies used in your transactions.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-10 w-[220px]" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertTitle>Could not load currency options</AlertTitle>
                <AlertDescription>Please refresh and try again.</AlertDescription>
              </Alert>
            ) : !hasCurrencies ? (
              <Alert>
                <AlertTitle>No transaction currencies found</AlertTitle>
                <AlertDescription>
                  Add at least one transaction first. Then your available currencies will appear
                  here.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex flex-col gap-2 max-w-sm">
                <Label htmlFor="preferred-currency">Display currency</Label>
                <Select
                  value={selectedCurrency}
                  onValueChange={onCurrencyChange}
                  disabled={isUpdating}
                >
                  <SelectTrigger id="preferred-currency" className="w-full">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCurrencies.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Available: {availableCurrencies.join(", ")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-muted p-2">
                <Cog className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">More Preferences</CardTitle>
                <CardDescription>Additional user settings can be added here.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>
              Coming soon
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
