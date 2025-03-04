export interface CategoryMetadata {
  color: string;
  iconName: string;
  iconSet: string;
  name: {
    en: string;
    fr: string;
  };
  subCategories: Array<{
    iconName: string;
    iconSet: string;
    name: {
      en: string;
      fr: string;
    };
  }> | null;
}

export interface CategorySummary {
  amount: number;
  count: number;
  transactions: Transaction[];
  category: CategoryMetadata;
}

export interface CategorySummarySection {
  total: number;
  by_category: Record<string, CategorySummary>;
}

export interface CategorySummaryResponse {
  income: CategorySummarySection;
  expense: CategorySummarySection;
  transfer: CategorySummarySection;
}
