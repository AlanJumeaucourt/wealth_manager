export interface Asset {
  id: number;
  name: string;
  symbol: string;
  type: string;
  current_price?: number;
}

export interface AssetQueryParams {
  page?: number;
  per_page?: number;
  sort_by?: keyof Asset;
  sort_order?: "asc" | "desc";
  search?: string;
  search_fields?: (keyof Asset)[];
  type?: string | string[];
  symbol?: string | string[];
}
