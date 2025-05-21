import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "../api/queryKeys";
import {
  fetchWithAuth,
  createQuery,
  createCrudOperations,
  formatQueryValue
} from "../api/apiUtils";
import type { Transaction } from "./transaction"; // Import Transaction

// Define PaginatedResponse locally since we need it
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface LiabilityType {
  id: number;
  name: string;
  description?: string;
}

export interface Liability {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  liability_type: 'standard_loan' | 'partial_deferred_loan' | 'total_deferred_loan' |
                  'mortgage' | 'credit_card' | 'line_of_credit' | 'other';
  principal_amount: number;
  interest_rate: number;
  start_date: string;
  end_date?: string;
  compounding_period: 'daily' | 'monthly' | 'quarterly' | 'annually';
  payment_frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'annually';
  payment_amount?: number;
  deferral_period_months: number;
  deferral_type: 'none' | 'partial' | 'total';
  direction: 'i_owe' | 'they_owe';
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
  transaction?: Transaction & { // Uses imported Transaction
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
  deferral_type: 'none' | 'partial' | 'total';
  is_final_balloon_payment?: boolean;
  // Summary properties that might be present in the last item
  total_interest_paid?: number;
  total_principal_paid?: number;
  total_capitalized_interest?: number;
}

export interface LiabilityFormData {
  name: string;
  description?: string;
  liability_type: 'standard_loan' | 'partial_deferred_loan' | 'total_deferred_loan' |
                 'mortgage' | 'credit_card' | 'line_of_credit' | 'other';
  principal_amount: number;
  interest_rate: number;
  start_date: string;
  end_date?: string;
  compounding_period: 'daily' | 'monthly' | 'quarterly' | 'annually';
  payment_frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'annually';
  payment_amount?: number;
  deferral_period_months: number;
  deferral_type: 'none' | 'partial' | 'total';
  direction: 'i_owe' | 'they_owe';
  account_id?: number;
  lender_name?: string;
}

export interface LiabilityPaymentFormData {
  liability_id: number;
  payment_date: string;
  amount: number;
  principal_amount: number;
  interest_amount: number;
  extra_payment?: number;
  transaction_id?: number;
  status: 'scheduled' | 'paid' | 'missed' | 'partial';
}

export interface LiabilityDashboardStats {
  total_liabilities: number;
  total_debt: number;
  total_principal_paid: number;
  total_interest_paid: number;
  total_remaining_balance: number;
  missed_payments_count: number;
  upcoming_payments: LiabilityPayment[];
}

export interface LiabilityDetails {
  "direction": "i_owe" | "they_owe",
  "end_date": string,
  "interest_paid": number,
  "interest_rate": number,
  "liability_id": number,
  "liability_name": string,
  "liability_type": string,
  "missed_payments_count": number,
  "next_payment_date": string,
  "principal_amount": number,
  "principal_paid": number,
  "remaining_balance": number,
  "start_date": string,
}

// #region Liability Operations and Queries (Moved from queries.ts)
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

const liabilityOperations = createCrudOperations<Liability>({
  endpoint: "liabilities",
  queryKeysToInvalidate: ["liabilities", "liabilityById"],
});

export const {
  useBatchDelete: useBatchDeleteLiabilities,
  useDelete: useDeleteLiability,
  useCreate: useCreateLiability,
  useUpdate: useUpdateLiability,
} = liabilityOperations;

const liabilityPaymentOperations = createCrudOperations<LiabilityPayment>({
  endpoint: "liability_payments",
  queryKeysToInvalidate: ["liabilityPayments", "liabilities", "liabilityPaymentsByLiability"],
});

export const {
  useBatchDelete: useBatchDeleteLiabilityPayments,
  useDelete: useDeleteLiabilityPayment,
  useCreate: useCreateLiabilityPayment,
  useUpdate: useUpdateLiabilityPayment,
} = liabilityPaymentOperations;

export function useLiabilities(params?: LiabilityFilters) {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, formatQueryValue(value as any));
      }
    });
  }
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  return createQuery<PaginatedResponse<Liability>>({
    queryKey: [...QueryKeys.liabilities, params],
    queryFn: () => fetchWithAuth(`liabilities${queryString}`),
  });
}

export function useLiabilityDetails(params?: LiabilityFilters) {
  return useLiabilities(params);
}

export function useLiability(id: number) {
  return createQuery<Liability>({
    queryKey: QueryKeys.liabilityById(id),
    queryFn: () => fetchWithAuth(`liabilities/${id}`),
    enabled: !!id,
  });
}

export function useLiabilityDetail(id: number) {
  return useLiability(id);
}

export function useLiabilityAmortization(id: number) {
  return createQuery<AmortizationScheduleItem[]>({
    queryKey: QueryKeys.liabilityAmortization(id),
    queryFn: () => fetchWithAuth(`liabilities/${id}/amortization`),
    enabled: !!id,
  });
}

export function useLiabilityPayments(params?: LiabilityPaymentFilters) {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, formatQueryValue(value as any));
      }
    });
  }
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  return createQuery<PaginatedResponse<LiabilityPayment>>({
    queryKey: [...QueryKeys.liabilityPayments, params],
    queryFn: () => fetchWithAuth(`liability_payments${queryString}`),
  });
}

export function useLiabilityPaymentsByLiability(liabilityId: number) {
  return createQuery<{ items: LiabilityPayment[] }>({
    queryKey: QueryKeys.liabilityPaymentsByLiability(liabilityId),
    queryFn: () => fetchWithAuth(`liability_payments/liability/${liabilityId}`),
    enabled: !!liabilityId,
  });
}

export function useRecordLiabilityPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<LiabilityPayment, "id" | "created_at" | "updated_at">) =>
      fetchWithAuth<LiabilityPayment>("liability_payments/record", {
        method: "POST",
        body: data,
      }),
    onSuccess: (returnedData: LiabilityPayment) => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.liabilityPayments });
      if (returnedData && returnedData.liability_id) {
        queryClient.invalidateQueries({
          queryKey: QueryKeys.liabilityPaymentsByLiability(returnedData.liability_id)
        });
        queryClient.invalidateQueries({
          queryKey: QueryKeys.liabilityById(returnedData.liability_id)
        });
      }
      queryClient.invalidateQueries({ queryKey: QueryKeys.liabilities });
      queryClient.invalidateQueries({ queryKey: QueryKeys.transactions});
    },
  });
}
// #endregion
