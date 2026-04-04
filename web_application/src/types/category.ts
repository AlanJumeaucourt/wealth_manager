import type { Transaction, TransactionType } from "./transaction";

export type CategoryType = TransactionType;

export interface CategoryMetadata {
  id: string;
  name: {
    fr: string;
    en: string;
  };
  subcategories?: string[];
  icon?: string;
  color?: string;
  iconName?: string;
  iconSet?: string;
  subCategories?: Array<{
    iconName: string;
    iconSet: string;
    name: {
      en: string;
      fr: string;
    };
  }> | null;
}

export interface CategorySummary {
  count: number;
  net_amount: number;
  original_amount: number;
  transactions: Transaction[];
}

export interface CategorySummaryResponse {
  income: {
    total: {
      net: number;
      original: number;
    };
    by_category: Record<string, CategorySummary>;
  };
  expense: {
    total: {
      net: number;
      original: number;
    };
    by_category: Record<string, CategorySummary>;
  };
  transfer: {
    total: {
      net: number;
      original: number;
    };
    by_category: Record<string, CategorySummary>;
  };
}
