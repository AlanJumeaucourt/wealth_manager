import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Account } from "@/types"
import { Home, Plane, Target, Umbrella } from "lucide-react"
import { useMemo } from "react"

interface GoalType {
  name: string
  target: number
  current: number
  icon: React.ReactNode
  color: string
  accountType: string
}

interface FinancialGoalsProps {
  accounts: Account[]
  onAccountClick?: (accountId: number) => void
  isLoading?: boolean
}

export function FinancialGoals({ accounts, onAccountClick, isLoading }: FinancialGoalsProps) {
  // Calculate savings amount
  const savingsTotal = useMemo(() => {
    return accounts
      .filter(account => account.type === "savings")
      .reduce((sum, account) => sum + account.balance, 0)
  }, [accounts])

  // Example goals (in a real app, these would come from a database)
  const goals: GoalType[] = [
    {
      name: "Emergency Fund",
      target: 10000,
      current: Math.min(savingsTotal * 0.5, 10000), // 50% of savings up to target
      icon: <Umbrella className="h-4 w-4" />,
      color: "bg-blue-500",
      accountType: "savings"
    },
    {
      name: "Vacation",
      target: 3000,
      current: Math.min(savingsTotal * 0.2, 3000), // 20% of savings up to target
      icon: <Plane className="h-4 w-4" />,
      color: "bg-green-500",
      accountType: "savings"
    },
    {
      name: "Home Down Payment",
      target: 50000,
      current: Math.min(savingsTotal * 0.3, 50000), // 30% of savings up to target
      icon: <Home className="h-4 w-4" />,
      color: "bg-purple-500",
      accountType: "savings"
    }
  ]

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(amount)
  }

  // Get first account by type for navigation
  const getFirstAccountByType = (type: string) => {
    const account = accounts.find(a => a.type === type)
    return account ? account.id : null
  }

  // Handler for goal click
  const handleGoalClick = (accountType: string) => {
    if (!onAccountClick) return

    const accountId = getFirstAccountByType(accountType)
    if (accountId) {
      onAccountClick(accountId)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2 flex-1" />
                  <Skeleton className="h-4 w-10" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Target className="h-5 w-5" />
          Financial Goals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {goals.map((goal) => {
            const progressPercent = Math.min(Math.round((goal.current / goal.target) * 100), 100)

            return (
              <div
                key={goal.name}
                className="space-y-2 hover:bg-muted/50 p-2 rounded-lg cursor-pointer transition-colors"
                onClick={() => handleGoalClick(goal.accountType)}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-full ${goal.color.replace('bg-', 'bg-opacity-20 ')}`}>
                      {goal.icon}
                    </div>
                    <span>{goal.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(goal.current)} / {formatCurrency(goal.target)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={progressPercent} className="h-2" />
                  <span className="text-xs font-medium min-w-10 text-right">
                    {progressPercent}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
