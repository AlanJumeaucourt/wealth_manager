"use client";

import { create } from "zustand";

interface BudgetSegment {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

interface CategoriesStore {
  type: "income" | "expense" | "transfer";
  stats: {
    monthlyBudget: number;
    remaining: number;
    remainingPercentage: number;
    usedPercentage: number;
    totalBudgeted: number;
    totalActual: number;
    overBudgetCount: number;
    expenseBudgetSegments: BudgetSegment[];
    incomeBudgetSegments: BudgetSegment[];
    biggestCategory: {
      name: string;
      amount: number;
      difference: number;
      percentage: number;
    };
    dailyAverage: {
      amount: number;
      difference: number;
      percentage: number;
    };
    mostOverCategory: {
      name: string;
      budgeted: number;
      actual: number;
      over: number;
      percentage: number;
    };
  };
  setType: (type: "income" | "expense" | "transfer") => void;
  setStats: (stats: Partial<CategoriesStore["stats"]>) => void;
  setBudgetSegments: (type: "income" | "expense", segments: BudgetSegment[]) => void;
}

const emptyBiggest = {
  name: "",
  amount: 0,
  difference: 0,
  percentage: 0,
};

export const useCategories = create<CategoriesStore>((set) => ({
  type: "expense",
  stats: {
    monthlyBudget: 0,
    remaining: 0,
    remainingPercentage: 0,
    usedPercentage: 0,
    totalBudgeted: 0,
    totalActual: 0,
    overBudgetCount: 0,
    expenseBudgetSegments: [],
    incomeBudgetSegments: [],
    biggestCategory: { ...emptyBiggest },
    dailyAverage: { amount: 0, difference: 0, percentage: 0 },
    mostOverCategory: {
      name: "",
      budgeted: 0,
      actual: 0,
      over: 0,
      percentage: 0,
    },
  },
  setType: (type) => set({ type }),
  setStats: (newStats) =>
    set((state) => {
      let changed = false;
      for (const [key, value] of Object.entries(newStats) as Array<
        [keyof CategoriesStore["stats"], CategoriesStore["stats"][keyof CategoriesStore["stats"]]]
      >) {
        if (state.stats[key] !== value) {
          changed = true;
          break;
        }
      }
      if (!changed) return state;
      return { stats: { ...state.stats, ...newStats } };
    }),
  setBudgetSegments: (type, segments) =>
    set((state) => {
      const key = type === "expense" ? "expenseBudgetSegments" : "incomeBudgetSegments";
      const prev = state.stats[key];
      if (
        prev.length === segments.length &&
        prev.every(
          (seg, i) =>
            seg.name === segments[i]?.name &&
            seg.amount === segments[i]?.amount &&
            seg.percentage === segments[i]?.percentage &&
            seg.color === segments[i]?.color,
        )
      ) {
        return state;
      }
      return {
        stats: {
          ...state.stats,
          [key]: segments,
        },
      };
    }),
}));
