import {
  GoCardlessAccount,
  GoCardlessAccountBalance,
  GoCardlessAccountDetail,
  GoCardlessAccountTransactions,
  GoCardlessCredentials,
  GoCardlessEndUserAgreement,
  GoCardlessInstitution,
  GoCardlessRequisition,
  GoCardlessToken,
} from "@/types/gocardless"
import { API_URL } from "./queries"

// Base GoCardless API URL
const GOCARDLESS_API_URL = `${API_URL}/gocardless`

// Custom error class for rate limit errors
export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number,
    public summary: string,
    public detail: string
  ) {
    super(message)
    this.name = "RateLimitError"
  }
}

// Utility function for API error handling
export const handleApiError = (error: any): Error => {
  if (error.response) {
    const errorData = error.response.data?.error || error.response.data

    // Handle rate limit errors
    if (error.response.status === 429) {
      // Get retry_after directly if available, otherwise parse from detail message
      const retryAfter =
        errorData.retry_after ||
        parseInt(
          errorData.detail?.match(/try again in (\d+) seconds/)?.[1] || "0"
        )

      return new RateLimitError(
        errorData.summary || "Rate limit exceeded",
        retryAfter,
        errorData.summary || "Rate limit exceeded",
        errorData.detail || "The rate limit has been exceeded"
      )
    }

    // Handle other API errors
    const errorMessage =
      errorData?.summary || errorData?.detail || "An error occurred"
    return new Error(errorMessage)
  } else if (error.request) {
    return new Error("No response from server")
  } else {
    return new Error(error.message || "Unknown error")
  }
}

// Function to fetch institutions
export const fetchInstitutions = async (
  countryCode?: string
): Promise<GoCardlessInstitution[]> => {
  const token = localStorage.getItem("access_token")

  try {
    // According to docs, country is a required parameter
    const url = `${GOCARDLESS_API_URL}/institutions${
      countryCode ? `?country=${countryCode}` : ""
    }`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch institutions: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching institutions:", error)
    throw handleApiError(error)
  }
}

// Function to get institution details
export const getInstitution = async (
  institutionId: string
): Promise<GoCardlessInstitution> => {
  const token = localStorage.getItem("access_token")

  try {
    const response = await fetch(
      `${GOCARDLESS_API_URL}/institutions/${institutionId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(
        `Failed to get institution details: ${response.statusText}`
      )
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting institution details:", error)
    throw handleApiError(error)
  }
}

// Function to create an end user agreement
export const createEndUserAgreement = async (
  institutionId: string,
  maxHistoricalDays: number = 90,
  accessValidForDays: number = 90,
  accessScope: string[] = ["balances", "details", "transactions"]
): Promise<GoCardlessEndUserAgreement> => {
  const token = localStorage.getItem("access_token")

  try {
    const response = await fetch(`${GOCARDLESS_API_URL}/agreements/enduser`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        institution_id: institutionId,
        max_historical_days: maxHistoricalDays,
        access_valid_for_days: accessValidForDays,
        access_scope: accessScope,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        errorData.summary ||
          `Failed to create end user agreement: ${response.statusText}`
      )
    }

    return await response.json()
  } catch (error) {
    console.error("Error creating end user agreement:", error)
    throw handleApiError(error)
  }
}

// Function to create a requisition
export const createRequisition = async (
  institutionId: string,
  redirectUrl: string,
  agreementId?: string,
  reference?: string,
  userLanguage?: string,
  accountSelection: boolean = false
): Promise<GoCardlessRequisition> => {
  const token = localStorage.getItem("access_token")

  try {
    const requisitionData: any = {
      institution_id: institutionId,
      redirect: redirectUrl,
      account_selection: accountSelection,
    }

    if (agreementId) requisitionData.agreement = agreementId
    if (reference) requisitionData.reference = reference
    if (userLanguage) requisitionData.user_language = userLanguage

    const response = await fetch(`${GOCARDLESS_API_URL}/requisitions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requisitionData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        errorData.summary ||
          `Failed to create requisition: ${response.statusText}`
      )
    }

    return await response.json()
  } catch (error) {
    console.error("Error creating requisition:", error)
    throw handleApiError(error)
  }
}

// Function to get requisition status
export const getRequisitionStatus = async (
  requisitionId: string
): Promise<GoCardlessRequisition> => {
  const token = localStorage.getItem("access_token")

  try {
    const response = await fetch(
      `${GOCARDLESS_API_URL}/requisitions/${requisitionId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(
        `Failed to get requisition status: ${response.statusText}`
      )
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting requisition status:", error)
    throw handleApiError(error)
  }
}

// Function to get requisition by reference
export const getRequisitionByReference = async (
  reference: string
): Promise<GoCardlessRequisition> => {
  const token = localStorage.getItem("access_token")

  try {
    const response = await fetch(
      `${GOCARDLESS_API_URL}/requisitions/by-reference/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(
        `Failed to get requisition by reference: ${response.statusText}`
      )
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting requisition by reference:", error)
    throw handleApiError(error)
  }
}

// Function to get accounts by requisition
export const getAccountsByRequisition = async (
  requisitionId: string
): Promise<GoCardlessAccount[]> => {
  const token = localStorage.getItem("access_token")

  try {
    // First, get the requisition to get the account IDs
    const response = await fetch(
      `${GOCARDLESS_API_URL}/accounts/${requisitionId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get accounts: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting accounts by requisition:", error)
    throw handleApiError(error)
  }
}

// Function to get account details
export const getAccountDetails = async (
  accountId: string,
  updateCache: boolean = false
): Promise<GoCardlessAccountDetail> => {
  const token = localStorage.getItem("access_token")

  try {
    const response = await fetch(
      `${GOCARDLESS_API_URL}/accounts/${accountId}/details?update_cache=${updateCache}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get account details: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting account details:", error)
    throw handleApiError(error)
  }
}

// Function to get account balances
export const getAccountBalances = async (
  accountId: string,
  updateCache: boolean = false
): Promise<GoCardlessAccountBalance> => {
  const token = localStorage.getItem("access_token")

  try {
    const response = await fetch(
      `${GOCARDLESS_API_URL}/accounts/${accountId}/balances?update_cache=${updateCache}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get account balances: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting account balances:", error)
    throw handleApiError(error)
  }
}

// Function to get account transactions
export const getAccountTransactions = async (
  accountId: string,
  dateFrom?: string,
  dateTo?: string,
  updateCache: boolean = false
): Promise<GoCardlessAccountTransactions> => {
  const token = localStorage.getItem("access_token")

  try {
    const params = new URLSearchParams()
    if (dateFrom) params.append("date_from", dateFrom)
    if (dateTo) params.append("date_to", dateTo)
    params.append("update_cache", updateCache.toString())

    const response = await fetch(
      `${GOCARDLESS_API_URL}/accounts/${accountId}/transactions?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(
        `Failed to get account transactions: ${response.statusText}`
      )
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting account transactions:", error)
    throw handleApiError(error)
  }
}

// Function to link accounts to user
export const linkAccountsToUser = async (
  requisitionId: string,
  accountIds: string[]
): Promise<void> => {
  const token = localStorage.getItem("access_token")

  try {
    const response = await fetch(`${GOCARDLESS_API_URL}/link-accounts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requisition_id: requisitionId,
        account_ids: accountIds,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to link accounts: ${response.statusText}`)
    }
  } catch (error) {
    console.error("Error linking accounts:", error)
    throw handleApiError(error)
  }
}

// Function to get a GoCardless API token
export const getGoCardlessToken = async (
  secretId: string,
  secretKey: string
): Promise<GoCardlessToken> => {
  try {
    const response = await fetch(`${GOCARDLESS_API_URL}/token/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret_id: secretId,
        secret_key: secretKey,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to get GoCardless token: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error getting GoCardless token:", error)
    throw handleApiError(error)
  }
}

// Function to handle the GoCardless callback
export const handleGoCardlessCallback = async (
  requisitionId: string,
  code: string | null
): Promise<GoCardlessCredentials> => {
  const token = localStorage.getItem("access_token")

  try {
    // 1. Get the requisition status to check if it's completed
    const requisition = await getRequisitionStatus(requisitionId)

    if (requisition.status !== "LN" && requisition.status !== "GA") {
      throw new Error(
        `Requisition is not in a completed state. Current status: ${requisition.status}`
      )
    }

    // 2. Get the accounts associated with this requisition
    const accounts = await getAccountsByRequisition(requisitionId)

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found for this requisition")
    }

    // 3. Link accounts to the user
    await linkAccountsToUser(
      requisitionId,
      accounts.map(acc => acc.id)
    )

    // 4. Return the credentials (in a real app, you'd probably store these more securely)
    return {
      secret_id: requisitionId,
      secret_key: accounts[0].id, // Using first account ID as a stand-in for the key
    }
  } catch (error) {
    console.error("Error processing callback:", error)
    throw handleApiError(error)
  }
}

export async function getAccount(
  accountId: string
): Promise<GoCardlessAccount> {
  const token = localStorage.getItem("gocardless_token")
  if (!token) {
    throw new Error("No GoCardless token found")
  }

  const response = await fetch(`${GOCARDLESS_API_URL}/accounts/${accountId}/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || "Failed to fetch account details")
  }

  return response.json()
}

// Function to get all GoCardless accounts for the current user
export const getUserAccounts = async (): Promise<GoCardlessAccount[]> => {
  const token = localStorage.getItem("access_token")

  try {
    const response = await fetch(`${GOCARDLESS_API_URL}/accounts`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return await response.json()
  } catch (error) {
    console.error("Error getting user accounts:", error)
    throw handleApiError(error)
  }
}
