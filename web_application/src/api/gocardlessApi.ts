import {
  GoCardlessAccount,
  GoCardlessAccountBalance,
  GoCardlessAccountDetail,
  GoCardlessAccountTransactions,
  GoCardlessCredentials,
  GoCardlessEndUserAgreement,
  GoCardlessInstitution,
  GoCardlessRequisition,
} from "@/types/gocardless";
import { type TreatyResult, unwrapEden } from "./edenUnwrap";
import { wealthApi } from "./wealthApi";

/** GoCardless stub routes are not fully present on `Treaty.Create<App>`; still use Eden Treaty + authFetch. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Eden path typing gap for stub module
const gc = wealthApi.gocardless as any;

// Custom error class for rate limit errors
export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number,
    public summary: string,
    public detail: string,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

// Utility function for API error handling
const handleApiError = (error: any): Error => {
  if (error.response) {
    const errorData = error.response.data?.error || error.response.data;

    // Handle rate limit errors
    if (error.response.status === 429) {
      // Get retry_after directly if available, otherwise parse from detail message
      const retryAfter =
        errorData.retry_after ||
        parseInt(errorData.detail?.match(/try again in (\d+) seconds/)?.[1] || "0");

      return new RateLimitError(
        errorData.summary || "Rate limit exceeded",
        retryAfter,
        errorData.summary || "Rate limit exceeded",
        errorData.detail || "The rate limit has been exceeded",
      );
    }

    // Handle other API errors
    const errorMessage = errorData?.summary || errorData?.detail || "An error occurred";
    return new Error(errorMessage);
  } else if (error.request) {
    return new Error("No response from server");
  } else {
    return new Error(error.message || "Unknown error");
  }
};

// Function to fetch institutions
export const fetchInstitutions = async (countryCode?: string): Promise<GoCardlessInstitution[]> => {
  try {
    return unwrapEden(
      gc.institutions.get({
        query: countryCode ? { country: countryCode } : ({} as never),
      }) as Promise<TreatyResult<GoCardlessInstitution[]>>,
    );
  } catch (error) {
    console.error("Error fetching institutions:", error);
    throw handleApiError(error);
  }
};

// Function to create an end user agreement
export const createEndUserAgreement = async (
  institutionId: string,
  maxHistoricalDays: number = 90,
  accessValidForDays: number = 90,
  accessScope: string[] = ["balances", "details", "transactions"],
): Promise<GoCardlessEndUserAgreement> => {
  try {
    return unwrapEden(
      gc.agreements.enduser.post({
        body: {
          institution_id: institutionId,
          max_historical_days: maxHistoricalDays,
          access_valid_for_days: accessValidForDays,
          access_scope: accessScope,
        },
      }) as Promise<TreatyResult<GoCardlessEndUserAgreement>>,
    );
  } catch (error) {
    console.error("Error creating end user agreement:", error);
    throw handleApiError(error);
  }
};

// Function to create a requisition
export const createRequisition = async (
  institutionId: string,
  redirectUrl: string,
  agreementId?: string,
  reference?: string,
  userLanguage?: string,
  accountSelection: boolean = false,
): Promise<GoCardlessRequisition> => {
  try {
    const requisitionData: Record<string, unknown> = {
      institution_id: institutionId,
      redirect: redirectUrl,
      account_selection: accountSelection,
    };

    if (agreementId) requisitionData.agreement = agreementId;
    if (reference) requisitionData.reference = reference;
    if (userLanguage) requisitionData.user_language = userLanguage;

    return unwrapEden(
      gc.requisitions.post({
        body: requisitionData,
      }) as Promise<TreatyResult<GoCardlessRequisition>>,
    );
  } catch (error) {
    console.error("Error creating requisition:", error);
    throw handleApiError(error);
  }
};

// Function to get requisition status
export const getRequisitionStatus = async (
  requisitionId: string,
): Promise<GoCardlessRequisition> => {
  try {
    return unwrapEden(
      gc.requisitions({ id: requisitionId }).get() as Promise<TreatyResult<GoCardlessRequisition>>,
    );
  } catch (error) {
    console.error("Error getting requisition status:", error);
    throw handleApiError(error);
  }
};

// Function to get requisition by reference
export const getRequisitionByReference = async (
  reference: string,
): Promise<GoCardlessRequisition> => {
  try {
    const byRef = (
      gc.requisitions as unknown as {
        "by-reference": (p: { reference: string }) => { get: () => Promise<unknown> };
      }
    )["by-reference"];
    return unwrapEden(byRef({ reference }).get() as Promise<TreatyResult<GoCardlessRequisition>>);
  } catch (error) {
    console.error("Error getting requisition by reference:", error);
    throw handleApiError(error);
  }
};

// Function to get accounts by requisition
const getAccountsByRequisition = async (requisitionId: string): Promise<GoCardlessAccount[]> => {
  try {
    return unwrapEden(
      gc.accounts({ id: requisitionId }).get() as Promise<TreatyResult<GoCardlessAccount[]>>,
    );
  } catch (error) {
    console.error("Error getting accounts by requisition:", error);
    throw handleApiError(error);
  }
};

// Function to get account details
export const getAccountDetails = async (
  accountId: string,
  updateCache: boolean = false,
): Promise<GoCardlessAccountDetail> => {
  try {
    return unwrapEden(
      gc
        .accounts({ id: accountId })
        .details.get({ query: { update_cache: updateCache } }) as Promise<
        TreatyResult<GoCardlessAccountDetail>
      >,
    );
  } catch (error) {
    console.error("Error getting account details:", error);
    throw handleApiError(error);
  }
};

// Function to get account balances
export const getAccountBalances = async (
  accountId: string,
  updateCache: boolean = false,
): Promise<GoCardlessAccountBalance> => {
  try {
    return unwrapEden(
      gc
        .accounts({ id: accountId })
        .balances.get({ query: { update_cache: updateCache } }) as Promise<
        TreatyResult<GoCardlessAccountBalance>
      >,
    );
  } catch (error) {
    console.error("Error getting account balances:", error);
    throw handleApiError(error);
  }
};

// Function to get account transactions
export const getAccountTransactions = async (
  accountId: string,
  dateFrom?: string,
  dateTo?: string,
  updateCache: boolean = false,
): Promise<GoCardlessAccountTransactions> => {
  try {
    const query: Record<string, string | boolean> = { update_cache: updateCache };
    if (dateFrom) query.date_from = dateFrom;
    if (dateTo) query.date_to = dateTo;
    return unwrapEden(
      gc.accounts({ id: accountId }).transactions.get({
        query: query as never,
      }) as Promise<TreatyResult<GoCardlessAccountTransactions>>,
    );
  } catch (error) {
    console.error("Error getting account transactions:", error);
    throw handleApiError(error);
  }
};

// Function to link accounts to user
const linkAccountsToUser = async (requisitionId: string, accountIds: string[]): Promise<void> => {
  try {
    await unwrapEden(
      gc["link-accounts"].post({
        body: { requisition_id: requisitionId, account_ids: accountIds },
      }) as Promise<TreatyResult<unknown>>,
    );
  } catch (error) {
    console.error("Error linking accounts:", error);
    throw handleApiError(error);
  }
};

// Function to handle the GoCardless callback
export const handleGoCardlessCallback = async (
  requisitionId: string,
  code: string | null,
): Promise<GoCardlessCredentials> => {
  void code;
  try {
    // 1. Get the requisition status to check if it's completed
    const requisition = await getRequisitionStatus(requisitionId);

    if (requisition.status !== "LN" && requisition.status !== "GA") {
      throw new Error(
        `Requisition is not in a completed state. Current status: ${requisition.status}`,
      );
    }

    // 2. Get the accounts associated with this requisition
    const accounts = await getAccountsByRequisition(requisitionId);

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found for this requisition");
    }

    // 3. Link accounts to the user
    await linkAccountsToUser(
      requisitionId,
      accounts.map((acc) => acc.id),
    );

    // 4. Return the credentials (in a real app, you'd probably store these more securely)
    return {
      secret_id: requisitionId,
      secret_key: accounts[0].id, // Using first account ID as a stand-in for the key
    };
  } catch (error) {
    console.error("Error processing callback:", error);
    throw handleApiError(error);
  }
};

export async function getAccount(accountId: string): Promise<GoCardlessAccount> {
  return unwrapEden(
    gc.accounts({ id: accountId }).get() as Promise<TreatyResult<GoCardlessAccount>>,
  );
}

// Function to get all GoCardless accounts for the current user
export const getUserAccounts = async (): Promise<GoCardlessAccount[]> => {
  try {
    return unwrapEden(gc.accounts.get() as Promise<TreatyResult<GoCardlessAccount[]>>);
  } catch (error) {
    console.error("Error getting user accounts:", error);
    throw handleApiError(error);
  }
};
