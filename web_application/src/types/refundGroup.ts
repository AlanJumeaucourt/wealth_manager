export interface RefundGroup {
  id?: number;
  name: string;
  description?: string | null;
}

export interface RefundGroupFilters {
  id?: number | number[];
  name?: string | string[];
  description?: string | string[];
}

export interface RefundGroupQueryParams extends RefundGroupFilters {
  page?: number;
  per_page?: number;
  sort_by?: keyof RefundGroup;
  sort_order?: "asc" | "desc";
  search?: string;
  search_fields?: (keyof RefundGroup)[];
}
