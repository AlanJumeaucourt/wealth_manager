/** Generated from src/db/manifest.ts - do not edit by hand. */

import type { Generated } from "kysely";

export interface BudgetsTable {
  id: Generated<number>;
  user_id: number;
  category: string;
  year: number;
  month: number;
  amount: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GocardlessCacheTable {
  cache_key: string;
  cache_type: string;
  data: string;
  last_updated: string;
}

export interface StockCacheTable {
  symbol: string;
  cache_type: string;
  data: string;
  last_updated: string;
}

export interface UsersTable {
  id: Generated<number>;
  name: string;
  email: string;
  password: string;
  last_login?: string | null;
  preferred_currency: string;
}

export interface AssetsTable {
  id: Generated<number>;
  user_id: number;
  symbol: string;
  name: string;
}

export interface BanksTable {
  id: Generated<number>;
  user_id: number;
  name: string;
  website?: string | null;
}

export interface AccountsTable {
  id: Generated<number>;
  user_id: number;
  name: string;
  type: "asset" | "loan" | "investment" | "income" | "expense" | "checking" | "savings";
  bank_id: number;
  currency?: string | null;
}

export interface CustomPricesTable {
  id: Generated<number>;
  symbol: string;
  date: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: number;
  created_at: string;
  updated_at: string;
  user_id: number;
}

export interface GocardlessAccountsTable {
  account_id: string;
  created_at: string;
  last_accessed: string;
  iban?: string | null;
  institution_id: string;
  status?: string | null;
  owner_name?: string | null;
  currency?: string | null;
  balance?: number | null;
  account_type?: string | null;
  user_id: number;
}

export interface GocardlessAgreementsTable {
  agreement_id: string;
  institution_id: string;
  max_historical_days: number;
  access_valid_for_days: number;
  access_scope: string;
  user_id: number;
  created_at: string;
}

export interface GocardlessRequisitionsTable {
  requisition_id: string;
  link: string;
  user_id: number;
  institution_id: string;
  reference?: string | null;
  agreement_id?: string | null;
  created_at?: string | null;
}

export interface LiabilitiesTable {
  id: Generated<number>;
  user_id: number;
  name: string;
  description?: string | null;
  liability_type: string;
  principal_amount: string;
  interest_rate: string;
  start_date: string;
  end_date?: string | null;
  compounding_period: string;
  payment_frequency: string;
  payment_amount?: string | null;
  deferral_period_months: number;
  deferral_type?: string | null;
  direction: string;
  account_id?: number | null;
  lender_name?: string | null;
  currency?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  capitalization_frequency?: string | null;
  interest_calculation?: string | null;
  first_period_days?: number | null;
}

export interface LiabilityScheduleOverridesTable {
  user_id: number;
  liability_id: number;
  payment_number: number;
  payment_date: string;
  scheduled_date: string;
  payment_amount: string;
  principal_amount: string;
  interest_amount: string;
  capitalized_interest: string;
  remaining_principal: string;
  is_deferred: number;
  deferral_type: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RefundGroupsTable {
  id: Generated<number>;
  user_id: number;
  name: string;
  description?: string | null;
}

export interface TransactionsTable {
  id: Generated<number>;
  user_id: number;
  date: string;
  date_accountability: string;
  description: string;
  amount: string;
  to_amount?: string | null;
  to_currency?: string | null;
  from_account_id: number;
  to_account_id: number;
  category: string;
  subcategory?: string | null;
  type: "expense" | "income" | "transfer";
  investment_id?: number | null;
}

export interface DismissedPotentialRefundsTable {
  user_id: number;
  income_transaction_id: number;
  created_at: string;
}

export interface InvestmentDetailsTable {
  transaction_id: number;
  asset_id: number;
  quantity: string;
  unit_price: string;
  fee: string;
  tax: string;
  total_paid?: string | null;
  investment_type: "Buy" | "Sell" | "Dividend" | "Interest" | "Deposit" | "Withdrawal";
  pl_transaction_id?: number | null;
  fee_transaction_id?: number | null;
  tax_transaction_id?: number | null;
  gain_loss_override?: string | null;
  gain_loss_source?: string | null;
  gain_loss_calculated?: string | null;
}

export interface LiabilityGeneratedTransactionsTable {
  user_id: number;
  liability_id: number;
  transaction_id: number;
  kind: string;
  schedule_payment_number: number;
  schedule_date: string;
  created_at?: string | null;
}

export interface LiabilityPaymentDetailsTable {
  transaction_id: number;
  user_id: number;
  liability_id: number;
  payment_date: string;
  amount: string;
  principal_amount: string;
  interest_amount: string;
  extra_payment: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RefundItemsTable {
  id: Generated<number>;
  user_id: number;
  income_transaction_id: number;
  expense_transaction_id: number;
  amount: number;
  refund_group_id?: number | null;
  description?: string | null;
}
