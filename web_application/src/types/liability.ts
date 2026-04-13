import type { Transaction } from "./transaction";

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface Liability {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  liability_type:
    | "standard_loan"
    | "partial_deferred_loan"
    | "total_deferred_loan"
    | "mortgage"
    | "credit_card"
    | "line_of_credit"
    | "other";
  principal_amount: number;
  interest_rate: number;
  start_date: string;
  end_date?: string;
  compounding_period: "daily" | "monthly" | "quarterly" | "annually";
  payment_frequency: "weekly" | "bi-weekly" | "monthly" | "quarterly" | "annually";
  payment_amount?: number;
  deferral_period_months: number;
  deferral_type: "none" | "partial" | "total";
  direction: "i_owe" | "they_owe";
  account_id?: number;
  lender_name?: string;
  created_at?: string;
  updated_at?: string;

  // Calculated fields from the view
  principal_paid?: number;
  interest_paid?: number;
  remaining_balance?: number;
  missed_payments_count?: number;
  next_payment_date?: string;
}

export interface LiabilityPayment {
  id: number;
  user_id: number;
  liability_id: number;
  payment_date: string;
  amount: number;
  principal_amount: number;
  interest_amount: number;
  extra_payment?: number;
  transaction_id?: number;
  created_at?: string;
  updated_at?: string;
  status?: string;
  transaction?: Transaction & {
    from_account_name?: string;
    to_account_name?: string;
  };
  liability?: {
    id: number;
    name: string;
    liability_type: string;
    principal_amount: number;
    interest_rate: number;
    payment_frequency: string;
  };
}

export interface LiabilityFilters {
  id?: number | number[];
  name?: string | string[];
  description?: string | string[];
  liability_type?: string | string[];
  principal_amount?: number | number[];
  interest_rate?: number | number[];
  start_date?: string | string[];
  end_date?: string | string[];
  compounding_period?: string | string[];
  payment_frequency?: string | string[];
  deferral_period_months?: number | number[];
  deferral_type?: string | string[];
  direction?: string | string[];
  account_id?: number | number[];
  lender_name?: string | string[];
}

export interface LiabilityPaymentFilters {
  id?: number | number[];
  liability_id?: number | number[];
  payment_date?: string | string[];
  amount?: number | number[];
  principal_amount?: number | number[];
  interest_amount?: number | number[];
  extra_payment?: number | number[];
  transaction_id?: number | number[];
  status?: string | string[];
}

export interface AmortizationScheduleItem {
  payment_number: number;
  payment_date: string;
  scheduled_date: string;
  payment_amount: number;
  principal_amount: number;
  interest_amount: number;
  capitalized_interest: number;
  remaining_principal: number;
  transaction_id?: number | null;
  is_actual_payment: boolean;
  extra_payment: number;
  date_shifted: boolean;
  is_deferred: boolean;
  deferral_type: "none" | "partial" | "total";
  is_final_balloon_payment?: boolean;
  /** Present when UI or API attaches a computed payment state */
  status?: "scheduled" | "paid" | "missed" | "partial" | "deferred";
  // Summary properties that might be present in the last item
  total_interest_paid?: number;
  total_principal_paid?: number;
  total_capitalized_interest?: number;
}

export interface LiabilityFormData {
  name: string;
  description?: string;
  liability_type:
    | "standard_loan"
    | "partial_deferred_loan"
    | "total_deferred_loan"
    | "mortgage"
    | "credit_card"
    | "line_of_credit"
    | "other";
  principal_amount: number;
  interest_rate: number;
  start_date: string;
  end_date?: string;
  compounding_period: "daily" | "monthly" | "quarterly" | "annually";
  payment_frequency: "weekly" | "bi-weekly" | "monthly" | "quarterly" | "annually";
  payment_amount?: number;
  deferral_period_months?: number;
  deferral_type: "none" | "partial" | "total";
  direction: "i_owe" | "they_owe";
  account_id?: number;
  lender_name?: string;
}
