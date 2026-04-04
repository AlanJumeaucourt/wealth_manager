export interface Account {
  id: number;
  name: string;
  type: "checking" | "savings" | "investment" | "expense" | "income";
  balance: number;
  balance_preferred?: number;
  bank_id: number;
  currency: string;
  market_value?: number | null;
}
