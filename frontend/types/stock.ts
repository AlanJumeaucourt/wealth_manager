/** Response shape from GET /stocks/:symbol/details (Yahoo-style payload). */
export interface StockInfo {
  info?: {
    currency?: string;
    longName?: string;
    dayHigh?: number;
    dayLow?: number;
    fiftyDayAverage?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    regularMarketVolume?: number;
    totalAssets?: number;
    ytdReturn?: number;
    beta3Year?: number;
  };
  fund_sector_weightings?: Record<string, number>;
}

export type StockHistoryPoint = { date: string; close?: number; [key: string]: unknown };
