export * from './types/account';
export * from './types/asset';
export * from './types/bank';
export * from './types/category';
export * from './types/investment';
export * from './types/liability';
export * from './types/portfolio';
export * from './types/refundGroup';
export * from './types/refundItem';
export * from './types/stock';
export * from './types/transaction';

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
}

export interface PeriodSummary {
  period: string
  income: number
  expense: number
  net: number
}

export type TimePeriod = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "max"

// User types
export interface User {
  name: string
  email: string
  avatar?: string
}

// GoCardless types
export interface GoCardlessInstitution {
  id: string
  name: string
  bic?: string
  transaction_total_days?: string
  max_access_valid_for_days?: string
  countries: string[]
  logo: string
  supported_features?: string[]
  identification_codes?: string[]
}

export type GoCardlessRequisitionStatus =
  | "CR" // Created
  | "ID" // Initiated
  | "LN" // Linked
  | "RJ" // Rejected
  | "ER" // Error
  | "SU" // Suspended
  | "EX" // Expired
  | "GC" // GivenConsent
  | "UA" // UserAuthenticated
  | "GA" // GrantedAuthorisation
  | "SA" // SelectingAccounts

export interface GoCardlessRequisition {
  id: string
  created?: string
  redirect: string
  status: GoCardlessRequisitionStatus
  institution_id: string
  agreement?: string
  reference?: string
  accounts: string[]
  user_language?: string
  link: string
  account_selection?: boolean
  redirect_immediate?: boolean
}

export interface GoCardlessAccount {
  id: string
  created: string
  last_accessed: string
  iban?: string
  bban?: string
  status: string
  institution_id: string
  owner_name?: string
  currency?: string
  balance?: number
  account_type?: string
}

export interface GoCardlessAccountDetail {
  account: {
    resourceId: string
    iban?: string
    bban?: string
    currency?: string
    ownerName?: string
    name?: string
    product?: string
    cashAccountType?: string
    status?: string
    bic?: string
    linkedAccounts?: string
  }
}

export interface GoCardlessBalanceAmount {
  amount: string
  currency: string
}

export interface GoCardlessBalance {
  balanceAmount: GoCardlessBalanceAmount
  balanceType: string
  referenceDate?: string
}

export interface GoCardlessAccountBalance {
  balances: GoCardlessBalance[]
}

export interface GoCardlessTransactionAmount {
  amount: string
  currency: string
}

export interface GoCardlessTransaction {
  transactionId?: string
  internalTransactionId?: string
  bookingDate?: string
  valueDate?: string
  transactionAmount: GoCardlessTransactionAmount
  debtorName?: string
  debtorAccount?: {
    iban?: string
  }
  creditorName?: string
  creditorAccount?: {
    iban?: string
  }
  remittanceInformationUnstructured?: string
  remittanceInformationUnstructuredArray?: string[]
  bankTransactionCode?: string
}

export interface GoCardlessAccountTransactions {
  transactions: {
    booked: GoCardlessTransaction[]
    pending?: GoCardlessTransaction[]
  }
}

export interface GoCardlessEndUserAgreement {
  id: string
  created: string
  institution_id: string
  max_historical_days?: number
  access_valid_for_days?: number
  access_scope?: string[]
  accepted?: string
}

export interface GoCardlessError {
  summary: string
  detail: string
  type?: string
  status_code: number
}

export interface GoCardlessToken {
  access: string
  access_expires: number
  refresh: string
  refresh_expires: number
}

export interface GoCardlessCredentials {
  secret_id: string
  secret_key: string
}

// Liability types

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

  // Enhanced fields returned by the backend
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
