import { useUpdatePreferredCurrency } from "@/api/queries";
import { useUser } from "@/hooks/use-user";

const DEFAULT_CURRENCY = "EUR";

export function usePreferredCurrency() {
  const { user } = useUser();
  const updateMutation = useUpdatePreferredCurrency();
  const preferredCurrency = (user?.preferred_currency || DEFAULT_CURRENCY).toUpperCase();

  return {
    preferredCurrency,
    updatePreferredCurrency: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
