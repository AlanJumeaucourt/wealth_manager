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
  preferred_currency?: string;
  count: number;
  net_amount: number;
  original_amount: number;
  by_currency?: Record<
    string,
    {
      net_amount: number;
      original_amount: number;
    }
  >;
  transactions: Transaction[];
}

export interface CategorySummaryResponse {
  income: {
    total: {
      preferred_currency?: string;
      net: number;
      original: number;
      by_currency?: Record<
        string,
        {
          net: number;
          original: number;
        }
      >;
    };
    by_category: Record<string, CategorySummary>;
  };
  expense: {
    total: {
      preferred_currency?: string;
      net: number;
      original: number;
      by_currency?: Record<
        string,
        {
          net: number;
          original: number;
        }
      >;
    };
    by_category: Record<string, CategorySummary>;
  };
  transfer: {
    total: {
      preferred_currency?: string;
      net: number;
      original: number;
      by_currency?: Record<
        string,
        {
          net: number;
          original: number;
        }
      >;
    };
    by_category: Record<string, CategorySummary>;
  };
}
