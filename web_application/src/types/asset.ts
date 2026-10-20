import type { Asset as EdenAsset } from "@/api/edenDerivedTypes";

/** API asset row plus optional UI enrichment fields. */
export type Asset = EdenAsset & {
  type?: string;
  current_price?: number;
};

export interface AssetQueryParams {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  search?: string;
  search_fields?: string[];
  symbol?: string | string[];
}
