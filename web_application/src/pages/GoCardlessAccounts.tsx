import {
  getAccountBalances,
  getAccountDetails,
  getAccountTransactions,
  getUserAccounts,
  RateLimitError,
} from "@/api/gocardlessApi"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  GoCardlessAccount,
  GoCardlessAccountBalance,
  GoCardlessAccountDetail,
  GoCardlessAccountTransactions,
} from "@/types/gocardless"
import { formatCurrency } from "@/utils/format"
import { AlertCircle } from "lucide-react"
import { useEffect, useState } from "react"

interface AccountInfo {
  account: GoCardlessAccount
  details: GoCardlessAccountDetail
  balances: GoCardlessAccountBalance
  transactions: GoCardlessAccountTransactions
}

interface RateLimitState {
  message: string
  retryAfter: number
  accountId: string
}

export default function GoCardlessAccounts() {
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rateLimitError, setRateLimitError] = useState<RateLimitState | null>(
    null
  )

  const formatTimeRemaining = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60
    return `${hours}h ${minutes}m ${remainingSeconds}s`
  }

  const fetchAccountInfo = async (accountId: string) => {
    try {
      const [details, balances, transactions] = await Promise.all([
        getAccountDetails(accountId),
        getAccountBalances(accountId),
        getAccountTransactions(accountId),
      ])

      return {
        account: {
          id: accountId,
          // Add other account fields as needed
        } as GoCardlessAccount,
        details,
        balances,
        transactions,
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        setRateLimitError({
          message: err.message,
          retryAfter: err.retryAfter,
          accountId,
        })
      }
      throw err
    }
  }

  const refreshAccountData = async (accountId: string) => {
    try {
      const [details, balances, transactions] = await Promise.all([
        getAccountDetails(accountId, true),
        getAccountBalances(accountId, true),
        getAccountTransactions(accountId, undefined, undefined, true),
      ])

      setAccounts(prevAccounts =>
        prevAccounts.map(acc =>
          acc.account.id === accountId
            ? { ...acc, details, balances, transactions }
            : acc
        )
      )
    } catch (err) {
      if (err instanceof RateLimitError) {
        setRateLimitError({
          message: err.message,
          retryAfter: err.retryAfter,
          accountId,
        })
      } else {
        console.error(`Error refreshing data for account ${accountId}:`, err)
        setError("Failed to refresh account data")
      }
    }
  }

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const accounts = await getUserAccounts()
        const accountInfos = await Promise.all(
          accounts.map(account => fetchAccountInfo(account.id))
        )
        setAccounts(accountInfos)
      } catch (err) {
        if (err instanceof RateLimitError) {
          setRateLimitError({
            message: err.message,
            retryAfter: err.retryAfter,
            accountId: "all",
          })
        } else {
          console.error("Error fetching accounts:", err)
          setError("Failed to fetch account information")
        }
      } finally {
        setLoading(false)
      }
    }

    fetchAccounts()
  }, [])

  if (loading) {
    return <div className="p-4">Loading accounts...</div>
  }

  if (rateLimitError) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 shadow-md">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <svg
                className="h-12 w-12 text-amber-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-amber-800">
                Data Sync Limit Reached
              </h3>
              <div className="mt-2 text-amber-700">
                <p className="mb-2">
                  The bank provider's API limits the number of data syncs per
                  day. This isn't an error with our app, but rather a
                  restriction from the bank's side.
                </p>
                <p className="font-medium">
                  {rateLimitError.accountId === "all"
                    ? "All account data"
                    : `Data for this account`}{" "}
                  will be available to sync in:
                </p>
                <div className="mt-3 mb-3">
                  <div className="text-2xl font-bold text-amber-800">
                    {formatTimeRemaining(rateLimitError.retryAfter)}
                  </div>
                </div>
                <p className="text-sm">
                  You can still view the cached data while waiting for the next
                  sync window.
                  {rateLimitError.message && (
                    <span className="block mt-1 text-xs text-amber-600">
                      {rateLimitError.message}
                    </span>
                  )}
                </p>
                {rateLimitError.accountId !== "all" && (
                  <button
                    className="mt-4 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-md transition-colors duration-200"
                    onClick={() => setRateLimitError(null)}
                  >
                    View Cached Data
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">GoCardless Accounts</h1>

      <div className="grid gap-4">
        {accounts.map(({ account, details, balances, transactions }) => (
          <Card key={account.id} className="mb-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {details.account?.ownerName || "Unknown Account"}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshAccountData(account.id)}
              >
                Refresh Data
              </Button>
            </CardHeader>

            <CardContent>
              <Tabs defaultValue="details">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="balances">Balances</TabsTrigger>
                  <TabsTrigger value="transactions">Transactions</TabsTrigger>
                </TabsList>

                <TabsContent value="details">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold">Account Information</h3>
                      <p>IBAN: {details.account?.iban || "N/A"}</p>
                      <p>Type: {details.account?.cashAccountType || "N/A"}</p>
                      <p>Status: {details.account?.status || "N/A"}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold">Additional Details</h3>
                      <p>Currency: {details.account?.currency || "N/A"}</p>
                      <p>Product: {details.account?.product || "N/A"}</p>
                      <p>BIC: {details.account?.bic || "N/A"}</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="balances">
                  <div className="grid grid-cols-2 gap-4">
                    {balances.balances?.map((balance, index) => (
                      <div key={index} className="border rounded p-4">
                        <h3 className="font-semibold">Balance {index + 1}</h3>
                        <p>
                          Amount:{" "}
                          {formatCurrency(
                            balance.balanceAmount.amount,
                            balance.balanceAmount.currency
                          )}
                        </p>
                        <p>Type: {balance.balanceType}</p>
                        <p>
                          Date:{" "}
                          {balance.referenceDate
                            ? new Date(
                                balance.referenceDate
                              ).toLocaleDateString()
                            : "N/A"}
                        </p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="transactions">
                  <div className="space-y-4">
                    {transactions.transactions?.booked?.map(
                      (transaction, index) => (
                        <div key={index} className="border rounded p-4">
                          <div className="flex justify-between">
                            <div className="flex-1">
                              <p className="font-semibold">
                                {transaction.remittanceInformationUnstructured ||
                                  (transaction.remittanceInformationUnstructuredArray &&
                                    transaction.remittanceInformationUnstructuredArray.join(
                                      ", "
                                    ))}
                              </p>
                              <div className="flex gap-3 text-sm text-gray-500">
                                <p>
                                  {transaction.bookingDate
                                    ? new Date(
                                        transaction.bookingDate
                                      ).toLocaleDateString()
                                    : "N/A"}
                                </p>
                                {transaction.transactionId && (
                                  <p>Ref: {transaction.transactionId}</p>
                                )}
                              </div>
                              {(transaction.creditorName ||
                                transaction.debtorName) && (
                                <p className="text-sm mt-1">
                                  {transaction.transactionAmount.amount.startsWith(
                                    "-"
                                  )
                                    ? `To: ${
                                        transaction.creditorName ||
                                        "Unknown recipient"
                                      }`
                                    : `From: ${
                                        transaction.debtorName ||
                                        "Unknown sender"
                                      }`}
                                </p>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <p
                                className={
                                  transaction.transactionAmount.amount.startsWith(
                                    "-"
                                  )
                                    ? "text-red-500 font-semibold"
                                    : "text-green-500 font-semibold"
                                }
                              >
                                {formatCurrency(
                                  transaction.transactionAmount.amount,
                                  transaction.transactionAmount.currency
                                )}
                              </p>
                              <p className="text-sm text-gray-500">
                                {transaction.valueDate
                                  ? "Value date: " +
                                    new Date(
                                      transaction.valueDate
                                    ).toLocaleDateString()
                                  : ""}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
