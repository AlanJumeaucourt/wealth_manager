import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRightLeft, BarChart4, PlusCircle, Receipt } from "lucide-react"

interface QuickActionsProps {
  navigate: (to: string) => void
}

export function QuickActions({ navigate }: QuickActionsProps) {
  const actions = [
    {
      name: "Add Account",
      icon: <PlusCircle className="h-5 w-5 mr-2" />,
      onClick: () => navigate("/accounts/all?openAddDialog=true"),
      variant: "default" as const
    },
    {
      name: "Transfer",
      icon: <ArrowRightLeft className="h-5 w-5 mr-2" />,
      onClick: () => navigate("/transactions/all"),
      variant: "outline" as const
    },
    {
      name: "Add Transaction",
      icon: <Receipt className="h-5 w-5 mr-2" />,
      onClick: () => navigate("/transactions/all?openAddDialog=true"),
      variant: "outline" as const
    },
    {
      name: "Investments",
      icon: <BarChart4 className="h-5 w-5 mr-2" />,
      onClick: () => navigate("/investments"),
      variant: "outline" as const
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <Button
            key={action.name}
            variant={action.variant}
            onClick={action.onClick}
            className="h-auto py-3 justify-start"
          >
            {action.icon}
            {action.name}
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}
