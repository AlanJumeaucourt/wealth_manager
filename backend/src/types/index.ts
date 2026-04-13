/** Public user shape (no password). */
export interface User {
  id: number;
  name: string;
  email: string;
  last_login: string | null;
  preferred_currency: string;
}

export interface ListParams {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  search?: string;
  search_fields?: string[];
  fields?: string[];
  filters?: Record<string, unknown>;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface BatchResult<T> {
  successful: T[];
  failed: Array<{ id?: number; error: string; data?: unknown }>;
  total_successful: number;
  total_failed: number;
}
