import { DeleteAccountDialog } from "@/components/accounts/DeleteAccountDialog"
import { EditAccountDialog } from "@/components/accounts/EditAccountDialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useNavigate } from "@tanstack/react-router"
import { ExternalLink } from 'lucide-react'
import { useState } from "react"
import { Account, Bank } from "../../types"

const ACCOUNT_TYPE_ICONS: Record<Account['type'], string> = {
  checking: '💳',
  expense: '📤',
  income: '📥',
  investment: '📈',
  savings: '🏦'
}

const ACCOUNT_TYPE_LABELS: Record<Account['type'], string> = {
  checking: 'Checking',
  expense: 'Expenses',
  income: 'Income',
  investment: 'Investments',
  savings: 'Savings'
}

interface Props {
  accounts: Account[]
  banks: Bank[]
}

export function AccountSummary({ accounts, banks }: Props) {
  const navigate = useNavigate()
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)

  useKeyboardShortcuts({
    onEdit: () => {
      if (selectedAccountId) {
        const account = accounts.find(a => a.id === selectedAccountId)
        if (account) {
          setEditingAccount(account)
        }
      }
    },
    onDelete: () => {
      if (selectedAccountId) {
        const account = accounts.find(a => a.id === selectedAccountId)
        if (account) {
          setDeletingAccount(account)
        }
      }
    },
    onNew: () => {
      navigate({ to: "/accounts/new" })
    },
  })

  if (!accounts.length) {
    return (
      <div className="bg-card rounded-xl border p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Account Summary</h2>
        <p className="text-muted-foreground">No accounts found</p>
      </div>
    )
  }

  // Group accounts by bankId
  const accountsByBank = accounts.reduce((grouped, account) => {
    const banksArray = Array.isArray(banks) ? banks : []
    const bank = banksArray.find(b => b.id === account.bank_id)
    const bankName = bank?.name || 'Other'
    return {
      ...grouped,
      [bankName]: [...(grouped[bankName] || []), account]
    }
  }, {} as Record<string, Account[]>)

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0)

  // Calculate balances by account type
  const balancesByType = accounts.reduce((acc, account) => {
    acc[account.type] = (acc[account.type] || 0) + account.balance;
    return acc;
  }, {} as Record<Account['type'], number>);

  // Sort bank names and put "Other" at the end
  const sortedBankNames = Object.keys(accountsByBank).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });

  // Define the sort order for account types
  const accountTypeOrder: Account['type'][] = ['checking', 'savings', 'investment'];

  return (
    <div className="bg-card rounded-xl border p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Account Summary</h2>
        <button
          onClick={() => navigate({ to: "/accounts/all" })}
          className="text-sm text-primary hover:underline"
        >
          Show All
        </button>
      </div>
      <div className="mb-4 pb-4 border-b border-border">
        <span className="text-sm text-muted-foreground">Total Net Worth</span>
        <h3 className="text-4xl text-primary font-semibold mt-2">
          {new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: 'EUR'
          }).format(Math.abs(totalBalance))}
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <div className="p-4 rounded-lg bg-card border border-border shadow-sm transition-shadow overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 text-2xl bg-muted p-2 rounded-md">{ACCOUNT_TYPE_ICONS.checking}</span>
            <span className="font-medium text-foreground truncate">Checking</span>
          </div>
          <p className="text-lg sm:text-xl font-semibold mt-2 text-foreground break-words">
            {new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: 'EUR'
            }).format(Math.abs(balancesByType.checking || 0))}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border shadow-sm transition-shadow overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 text-2xl bg-muted p-2 rounded-md">{ACCOUNT_TYPE_ICONS.savings}</span>
            <span className="font-medium text-foreground truncate">Savings</span>
          </div>
          <p className="text-lg sm:text-xl font-semibold mt-2 text-foreground break-words">
            {new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: 'EUR'
            }).format(Math.abs(balancesByType.savings || 0))}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border shadow-sm transition-shadow overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 text-2xl bg-muted p-2 rounded-md">{ACCOUNT_TYPE_ICONS.investment}</span>
            <span className="font-medium text-foreground truncate">Investments</span>
          </div>
          <p className="text-lg sm:text-xl font-semibold mt-2 text-foreground break-words">
            {new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: 'EUR'
            }).format(Math.abs(balancesByType.investment || 0))}
          </p>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="checking">Checking</TabsTrigger>
          <TabsTrigger value="savings">Savings</TabsTrigger>
          <TabsTrigger value="investment">Investment</TabsTrigger>
        </TabsList>

        {(['all', 'checking', 'savings', 'investment'] as const).map((tabValue) => (
          <TabsContent key={tabValue} value={tabValue}>
            <div className="accounts-list">
              {sortedBankNames.map(bankName => {
                const bankAccounts = accountsByBank[bankName];
                const filteredAccounts = tabValue === 'all'
                  ? bankAccounts
                  : bankAccounts.filter(account => account.type === tabValue)

                if (filteredAccounts.length === 0) return null;

                const sortedAccounts = [...filteredAccounts].sort((a, b) => {
                  const aIndex = accountTypeOrder.indexOf(a.type);
                  const bIndex = accountTypeOrder.indexOf(b.type);
                  if (aIndex === -1) return 1;
                  if (bIndex === -1) return -1;
                  return aIndex - bIndex;
                });

                return (
                  <div key={bankName} className="space-y-3">
                    <h3 className="text-lg font-medium text-muted-foreground border-b pb-2 flex items-center gap-2">
                      {bankName !== 'Other' && (
                        <>
                          {banks.find(b => b.name === bankName)?.website ? (
                            <a
                              href={banks.find(b => b.name === bankName)?.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 hover:text-primary transition-colors"
                            >
                              {bankName}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : bankName}
                        </>
                      )}
                      {bankName === 'Other' && bankName}
                    </h3>
                    {sortedAccounts.map(account => (
                      <div
                        key={account.id}
                        className={`flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${
                          selectedAccountId === account.id ? 'bg-muted' : ''
                        }`}
                        onClick={() => navigate({
                          to: "/accounts/$accountId",
                          params: { accountId: account.id.toString() }
                        })}
                        onMouseEnter={() => setSelectedAccountId(account.id)}
                        onMouseLeave={() => setSelectedAccountId(null)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            navigate({
                              to: "/accounts/$accountId",
                              params: { accountId: account.id.toString() }
                            })
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex-shrink-0 text-2xl bg-muted p-2 rounded-md">{ACCOUNT_TYPE_ICONS[account.type]}</span>
                          <div className="flex flex-col">
                            <span className="font-medium">{account.name}</span>
                            <span className="text-sm text-muted-foreground">{ACCOUNT_TYPE_LABELS[account.type]}</span>
                          </div>
                        </div>
                        <span className={`font-semibold ${account.balance < 0 ? 'text-destructive' : 'text-success'}`}>
                          {new Intl.NumberFormat(undefined, {
                            style: 'currency',
                            currency: 'EUR'
                          }).format(Math.abs(account.balance))}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit Dialog */}
      {editingAccount && (
        <EditAccountDialog
          account={editingAccount}
          open={true}
          onOpenChange={(open) => !open && setEditingAccount(null)}
        />
      )}

      {/* Delete Dialog */}
      <DeleteAccountDialog
        account={deletingAccount}
        open={!!deletingAccount}
        onOpenChange={(open) => !open && setDeletingAccount(null)}
        redirectTo="/dashboard"
      />
    </div>
  )
}
