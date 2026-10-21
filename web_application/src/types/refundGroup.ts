export type { RefundGroup } from "@/api/edenDerivedTypes";

export interface RefundGroupFilters {
  id?: number | number[];
  name?: string | string[];
  description?: string | string[];
}

export interface RefundGroupQueryParams extends RefundGroupFilters {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  search?: string;
  search_fields?: string[];
}
