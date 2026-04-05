import { useUpdatePreferredCurrency } from "@/api/queries";
import { useUser } from "@/hooks/use-user";

export function usePreferredCurrency() {
  const { user } = useUser();
  const updateMutation = useUpdatePreferredCurrency();
  const raw = user?.preferred_currency;
  const preferredCurrency = raw ? raw.toUpperCase() : "";

  return {
    preferredCurrency,
    /** False when the user record is not loaded yet or has no `preferred_currency`. */
    hasPreferredCurrency: Boolean(raw),
    updatePreferredCurrency: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
