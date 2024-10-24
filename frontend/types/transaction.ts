export interface Transaction {
  id: number;
  date: string;
  date_accountability: string;
  description: string;
  amount: number;
  type: string;
  from_account_id: number;
  to_account_id: number;
  category: string;
  subcategory: string | null;
}
