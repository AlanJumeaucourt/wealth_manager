"use client"

import { create } from "zustand"

interface CategoriesStore {
  type: "income" | "expense" | "transfer"
  stats: {
    monthlyBudget: number
    remaining: number
    remainingPercentage: number
    usedPercentage: number
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
  }
  setType: (type: "income" | "expense" | "transfer") => void
}

export const useCategories = create<CategoriesStore>((set) => ({
  type: "expense",
  stats: {
    monthlyBudget: 3200,
    remaining: 850,
    remainingPercentage: 26.5,
    usedPercentage: 73.5,
    biggestCategory: {
      name: "",
      amount: 1500,
      difference: 50,
      percentage: 46.8
    },
    dailyAverage: {
      amount: 78.33,
      difference: -12,
      percentage: 85
    }
  },
  setType: (type) => set({ type })
}))
