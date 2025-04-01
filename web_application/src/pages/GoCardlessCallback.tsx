import { getAccount, getAccountBalances, getAccountDetails, getAccountTransactions, getRequisitionByReference, getRequisitionStatus, handleGoCardlessCallback } from '@/api/gocardlessApi';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { GoCardlessAccount, GoCardlessAccountBalance, GoCardlessAccountDetail, GoCardlessAccountTransactions, GoCardlessCredentials } from '@/types/gocardless';
import { useRouter } from "@tanstack/react-router";
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const REQUISITION_STATUS_MESSAGES = {
  CR: 'Connection request has been created',
  GC: 'Waiting for consent at GoCardless...',
  UA: 'Authenticating with your bank...',
  RJ: 'Connection rejected. Please check your credentials and try again.',
  SA: 'Selecting accounts...',
  GA: 'Granting access to your account information...',
  LN: 'Account successfully linked',
  EX: 'Access to accounts has expired. Please reconnect your account.'
} as const;

export default function GoCardlessCallback() {
  const router = useRouter();
  const searchParams = new URLSearchParams(window.location.search);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<GoCardlessCredentials | null>(null);
  const [processingStep, setProcessingStep] = useState<string>('Initializing...');
  const [accounts, setAccounts] = useState<GoCardlessAccount[]>([]);
  const [accountDetails, setAccountDetails] = useState<Record<string, GoCardlessAccountDetail>>({});
  const [accountBalances, setAccountBalances] = useState<Record<string, GoCardlessAccountBalance>>({});
  const [accountTransactions, setAccountTransactions] = useState<Record<string, GoCardlessAccountTransactions>>({});
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);

  useEffect(() => {
    async function processCallback() {
      try {
        setLoading(true);
        setProcessingStep('Initializing...');

        // Check if we have a requisition ID or reference in the URL
        const requisitionId = searchParams.get('requisition_id');
        const reference = searchParams.get('ref');

        if (!requisitionId && !reference) {
          throw new Error('Missing requisition ID or reference in the callback URL');
        }

        // Step 1: Check requisition status - use appropriate method based on available parameter
        setProcessingStep('Checking connection status...');
        let requisition;

        if (requisitionId) {
          requisition = await getRequisitionStatus(requisitionId);
        } else if (reference) {
          requisition = await getRequisitionByReference(reference);
        } else {
          throw new Error('Missing requisition ID or reference');
        }

        console.log('Requisition status:', requisition);
        setCurrentStatus(requisition.status);

        // Handle different statuses
        switch (requisition.status) {
          case 'CR':
            setProcessingStep(REQUISITION_STATUS_MESSAGES.CR);
            break;
          case 'GC':
            setProcessingStep(REQUISITION_STATUS_MESSAGES.GC);
            break;
          case 'UA':
            setProcessingStep(REQUISITION_STATUS_MESSAGES.UA);
            break;
          case 'RJ':
            throw new Error(REQUISITION_STATUS_MESSAGES.RJ);
          case 'SA':
            setProcessingStep(REQUISITION_STATUS_MESSAGES.SA);
            break;
          case 'GA':
            setProcessingStep(REQUISITION_STATUS_MESSAGES.GA);
            break;
          case 'EX':
            throw new Error(REQUISITION_STATUS_MESSAGES.EX);
          case 'LN':
            setProcessingStep(REQUISITION_STATUS_MESSAGES.LN);
            break;
          default:
            throw new Error(`Unknown status: ${requisition.status}`);
        }

        // Only proceed with fetching account data if status is LN
        if (requisition.status === 'LN') {
          // Step 2: Get accounts linked to this requisition
          setProcessingStep('Retrieving account information...');

          // Fetch full account details for each account ID
          const accountPromises = requisition.accounts.map(accountId => getAccount(accountId));
          const accountsData = await Promise.all(accountPromises);
          setAccounts(accountsData);
          console.log('Accounts:', accountsData);

          // Step 3: Fetch additional account information (details, balances, transactions)
          setProcessingStep('Fetching account details and transactions...');

          const detailsPromises = accountsData.map(account =>
            getAccountDetails(account.id).then(details => [account.id, details])
          );
          const balancesPromises = accountsData.map(account =>
            getAccountBalances(account.id).then(balances => [account.id, balances])
          );
          const transactionsPromises = accountsData.map(account =>
            getAccountTransactions(account.id).then(transactions => [account.id, transactions])
          );

          const [detailsResults, balancesResults, transactionsResults] = await Promise.all([
            Promise.all(detailsPromises),
            Promise.all(balancesPromises),
            Promise.all(transactionsPromises)
          ]);

          // Convert results to objects for easier access
          const detailsMap = Object.fromEntries(detailsResults);
          const balancesMap = Object.fromEntries(balancesResults);
          const transactionsMap = Object.fromEntries(transactionsResults);

          setAccountDetails(detailsMap);
          setAccountBalances(balancesMap);
          setAccountTransactions(transactionsMap);

          const code = searchParams.get('code');

          if (!code) {
            throw new Error('Missing authorization code in the callback URL');
          }

          console.log('Processing callback with:', { requisitionId: requisition.id, code });

          const result = await handleGoCardlessCallback(requisition.id, code);
          console.log('Callback result:', result);
          setCredentials(result);
        }
      } catch (err: any) {
        console.error('Error processing callback:', err);
        setError(err.message || 'An error occurred while processing the callback');
      } finally {
        setLoading(false);
      }
    }

    processCallback();
  }, [searchParams]);

  const handleBackToAccounts = () => {
    router.navigate({ to: '/accounts/all' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Processing Bank Connection</h1>
        <p className="text-muted-foreground text-center">
          {processingStep}
        </p>
        {currentStatus && (
          <p className="text-sm text-muted-foreground mt-2">
            Status: {currentStatus}
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-md p-4 mt-8">
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Connection Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={handleBackToAccounts} className="w-full">
          Back to Accounts
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-md p-4 mt-8">
      <Card>
        <CardHeader>
          <CardTitle>Bank Connection Successful</CardTitle>
          <CardDescription>
            Your bank account has been successfully connected to your Wealth profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length > 0 && (
            <div className="space-y-4 mb-4">
              <h3 className="font-semibold">Connected Accounts:</h3>
              {accounts.map((account) => (
                <div key={account.id} className="p-3 bg-muted rounded-md">
                  <p className="font-medium">{account.owner_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {account.iban || 'No IBAN available'}
                  </p>
                  {accountBalances[account.id] && (
                    <p className="text-sm mt-2">
                      <span className="font-semibold">Balance:</span>{' '}
                      {accountBalances[account.id].balances[0]?.balanceAmount.amount} {accountBalances[account.id].balances[0]?.balanceAmount.currency}
                    </p>
                  )}
                  {accountTransactions[account.id] && (
                    <p className="text-sm mt-1">
                      <span className="font-semibold">Transactions:</span>{' '}
                      {accountTransactions[account.id].transactions.booked.length} transactions available
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          {credentials && (
            <div className="space-y-2 p-4 bg-muted rounded-md">
              <p className="text-sm font-medium">GoCardless Credentials:</p>
              <p className="text-xs break-all">
                <span className="font-semibold">Secret ID:</span> {credentials.secret_id}
              </p>
              <p className="text-xs break-all">
                <span className="font-semibold">Secret Key:</span> {credentials.secret_key}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleBackToAccounts} className="w-full">
            Go to Accounts
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
