export interface Account {
  id: number;
  name: string;
  type: 'checking' | 'savings' | 'investment' | 'expense' | 'income';
  balance: number;
  bank_id: number;
  currency: string;
}