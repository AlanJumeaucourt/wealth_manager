"use client"

import { useAllCategories, useCategorySummary } from "@/api/queries"
import { Skeleton } from "@/components/ui/skeleton"
import { useDateRange } from "@/contexts/date-range-context"
import { formatCurrency } from "@/lib/utils"
import { ResponsiveSankey } from "@nivo/sankey"
import { formatDate } from "date-fns"
interface SankeyNode {
  id: string
  color?: string
}

interface SankeyLink {
  source: string
  target: string
  value: number
}

interface SankeyData {
  nodes: SankeyNode[]
  links: SankeyLink[]
}

export function CategorySankey() {
  const { dateRange } = useDateRange()
  const startDate = formatDate(dateRange.startDate, "yyyy-MM-dd")
  const endDate = formatDate(dateRange.endDate, "yyyy-MM-dd")

  const { data: allCategories, isLoading: isLoadingCategories } =
    useAllCategories()
  const { data: summaryData, isLoading: isLoadingSummary } = useCategorySummary(
    startDate,
    endDate
  )

  const isLoading = isLoadingCategories || isLoadingSummary

  if (isLoading) {
    return (
      <div className="h-[400px] w-full">
        <Skeleton className="h-full w-full" />
      </div>
    )
  }

  if (!allCategories || !summaryData) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
        No data available
      </div>
    )
  }

  // Transform data for Sankey diagram
  const sankeyData: SankeyData = {
    nodes: [],
    links: [],
  }

  // Add income categories as source nodes
  const incomeCategories = allCategories.income || []
  incomeCategories.forEach((category: any) => {
    const categoryName = category.name.fr
    const categoryData = summaryData.income?.by_category[categoryName]
    if (categoryData && categoryData.net_amount !== 0) {
      sankeyData.nodes.push({
        id: categoryName,
        color: category.color,
      })
      sankeyData.links.push({
        source: categoryName,
        target: "Available Funds",
        value: Math.abs(categoryData.net_amount),
      })
    }
  })

  // Add central node
  sankeyData.nodes.push({ id: "Available Funds", color: "hsl(var(--primary))" })

  // Add expense categories as target nodes
  const expenseCategories = allCategories.expense || []
  expenseCategories.forEach((category: any) => {
    const categoryName = category.name.fr
    const categoryData = summaryData.expense?.by_category[categoryName]
    if (categoryData && categoryData.net_amount !== 0) {
      sankeyData.nodes.push({
        id: categoryName,
        color: category.color,
      })
      sankeyData.links.push({
        source: "Available Funds",
        target: categoryName,
        value: Math.abs(categoryData.net_amount),
      })
    }
  })

  return (
    <div className="h-[400px] w-full">
      <ResponsiveSankey
        data={sankeyData}
        margin={{ top: 40, right: 160, bottom: 40, left: 160 }}
        align="justify"
        colors={node => node.color || "hsl(var(--primary))"}
        nodeOpacity={1}
        nodeHoverOthersOpacity={0.35}
        nodeThickness={18}
        nodeSpacing={24}
        nodeBorderWidth={0}
        nodeBorderRadius={3}
        linkOpacity={0.5}
        linkHoverOthersOpacity={0.1}
        linkBlendMode="multiply"
        enableLinkGradient={true}
        labelPosition="outside"
        labelOrientation="horizontal"
        labelPadding={16}
        labelTextColor={{
          from: "color",
          modifiers: [["darker", 1.4]],
        }}
        animate={true}
        motionConfig="gentle"
        tooltip={({ node }) => {
          const value = sankeyData.links
            .filter(link => link.source === node.id || link.target === node.id)
            .reduce((sum, link) => sum + link.value, 0)

          const categoryData =
            summaryData[node.id === "Available Funds" ? "transfer" : "expense"]
              ?.by_category[node.id]
          const originalValue = categoryData?.original_amount || value
          const hasRefund = originalValue !== value

          return (
            <div className="bg-background border rounded-lg shadow-lg p-2">
              <strong>{node.id}</strong>
              <div>
                {hasRefund ? (
                  <>
                    <span className="line-through text-muted-foreground">
                      {formatCurrency(originalValue)}
                    </span>
                    <span className="ml-2">{formatCurrency(value)}</span>
                  </>
                ) : (
                  formatCurrency(value)
                )}
              </div>
            </div>
          )
        }}
      />
    </div>
  )
}
