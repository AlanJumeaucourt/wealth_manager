export interface StockPrice {
  close: number;
  date: string;
  high: number;
  low: number;
  open: number;
  value: number;
  volume: number;
}

export interface CustomPriceData {
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface AddCustomPriceResponse {
  message: string;
  price?: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
}

export interface DeleteCustomPriceResponse {
  message: string;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
}
