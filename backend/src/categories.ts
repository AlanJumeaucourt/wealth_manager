/**
 * Category definitions matching legacy backend structure.
 * Full objects (name.fr, name.en, color, etc.) for API parity with Python backend.
 */
import categoriesData from "./categories-data.json";

export interface SubCategory {
  name: { fr: string; en: string };
  iconName: string;
  iconSet: string;
}

export interface Category {
  name: { fr: string; en: string };
  color: string;
  iconName: string;
  iconSet: string;
  subCategories: SubCategory[] | null;
}

const expense = categoriesData.expense as Category[];
const income = categoriesData.income as Category[];
const transfer = categoriesData.transfer as Category[];

/** Full category objects by type (for GET /budgets/categories and /budgets/categories/:type) */
export const categoriesByType: Record<string, Category[]> = {
  expense,
  income,
  transfer,
};

/** English names only (for backward compatibility / by_category keys) */
export const expenseCategories: string[] = expense.map((c) => c.name.en);
export const incomeCategories: string[] = income.map((c) => c.name.en);
export const transferCategories: string[] = transfer.map((c) => c.name.en);
