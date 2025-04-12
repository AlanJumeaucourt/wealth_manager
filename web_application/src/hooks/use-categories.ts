"use client"

import { create } from "zustand"

interface BudgetSegment {
  name: string
  amount: number
  percentage: number
  color: string
}

interface CategoriesStore {
  type: "income" | "expense" | "transfer"
  stats: {
    monthlyBudget: number
    remaining: number
    remainingPercentage: number
    usedPercentage: number
    totalBudgeted: number
    totalActual: number
    overBudgetCount: number
    expenseBudgetSegments: BudgetSegment[]
    incomeBudgetSegments: BudgetSegment[]
    biggestCategory: {
      name: string
      amount: number
      difference: number
      percentage: number
    }
    dailyAverage: {
      amount: number
      difference: number
      percentage: number
    }
    mostOverCategory: {
      name: string
      budgeted: number
      actual: number
      over: number
      percentage: number
    }
  }
  setType: (type: "income" | "expense" | "transfer") => void
  setStats: (stats: Partial<CategoriesStore["stats"]>) => void
  setBudgetSegments: (type: "income" | "expense", segments: BudgetSegment[]) => void
}

export const useCategories = create<CategoriesStore>(set => ({
  type: "expense",
  stats: {
    monthlyBudget: 3200,
    remaining: 850,
    remainingPercentage: 26.5,
    usedPercentage: 73.5,
    totalBudgeted: 3200,
    totalActual: 2350,
    overBudgetCount: 0,
    expenseBudgetSegments: [],
    incomeBudgetSegments: [],
    biggestCategory: {
      name: "",
      amount: 1500,
      difference: 50,
      percentage: 46.8,
    },
    dailyAverage: {
      amount: 78.33,
      difference: -12,
      percentage: 85,
    },
    mostOverCategory: {
      name: "",
      budgeted: 0,
      actual: 0,
      over: 0,
      percentage: 0
    }
  },
  setType: type => set({ type }),
  setStats: newStats => set(state => ({
    stats: { ...state.stats, ...newStats }
  })),
  setBudgetSegments: (type, segments) => set(state => ({
    stats: {
      ...state.stats,
      ...(type === "expense"
        ? { expenseBudgetSegments: segments }
        : { incomeBudgetSegments: segments })
    }
  })),
}))
