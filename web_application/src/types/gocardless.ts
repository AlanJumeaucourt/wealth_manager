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
