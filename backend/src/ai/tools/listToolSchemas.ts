import type { TSchema } from "@sinclair/typebox";
import {
  tAccountsListQuerySchema,
  tAssetsListQuerySchema,
  tBanksListQuerySchema,
  tBaseListQuerySchema,
  tBudgetsLegacyListQuerySchema,
  tLiabilitiesListQuerySchema,
  tLiabilitiesPaymentStatusQuerySchema,
  tLiabilitiesSchedulePaymentsQuerySchema,
  tLiabilityPaymentsListQuerySchema,
  tPotentialRefundsListQuerySchema,
  tRefundGroupsListQuerySchema,
  tRefundItemsListQuerySchema,
  tTransactionsListQuerySchema,
} from "../../schemas/typebox.js";

export const LIST_TOOL_SCHEMA_BY_EXPORT: Record<string, TSchema> = {
  tBanksListQuerySchema,
  tAccountsListQuerySchema,
  tAssetsListQuerySchema,
  tRefundGroupsListQuerySchema,
  tRefundItemsListQuerySchema,
  tTransactionsListQuerySchema,
  tLiabilitiesListQuerySchema,
  tLiabilityPaymentsListQuerySchema,
  tBaseListQuerySchema,
  tBudgetsLegacyListQuerySchema,
  tPotentialRefundsListQuerySchema,
  tLiabilitiesPaymentStatusQuerySchema,
  tLiabilitiesSchedulePaymentsQuerySchema,
};
