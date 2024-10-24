import { Category } from '@/types/category';
import { expenseCategories, incomeCategories } from '@/constants/categories';

export function findCategoryByName(categoryName: string): Category | null {
  const lowerCaseName = categoryName.toLowerCase();

  // Search in expense categories
  let category = expenseCategories.find(cat => cat.name.toLowerCase() === lowerCaseName);
  if (category) {
    return category;
  }

  // Search in income categories
  category = incomeCategories.find(cat => cat.name.toLowerCase() === lowerCaseName);
  if (category) {
    return category;
  }

  // Return null if not found
  return null;
}
