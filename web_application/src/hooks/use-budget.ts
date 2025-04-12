"use client"

import { create } from "zustand"

interface BudgetStore {
  viewType: "chart" | "table"
  stats: {
    totalBudgeted: number
    totalActual: number
    totalRemaining: number
    usedPercentage: number
    biggestCategory: {
      name: string
      budgeted: number
      actual: number
      percentage: number
    }
    mostOverCategory: {
      name: string
      budgeted: number
      actual: number
      over: number
      percentage: number
    }
    overBudgetCount: number
  }
  setViewType: (viewType: "chart" | "table") => void
  setStats: (stats: BudgetStore["stats"]) => void
}

export const useBudget = create<BudgetStore>(set => ({
  viewType: "chart",
  stats: {
    totalBudgeted: 0,
    totalActual: 0,
    totalRemaining: 0,
    usedPercentage: 0,
    biggestCategory: {
      name: "",
      budgeted: 0,
      actual: 0,
      percentage: 0
    },
    mostOverCategory: {
      name: "",
      budgeted: 0,
      actual: 0,
      over: 0,
      percentage: 0
    },
    overBudgetCount: 0
  },
  setViewType: viewType => set({ viewType }),
  setStats: stats => set({ stats }),
}))
