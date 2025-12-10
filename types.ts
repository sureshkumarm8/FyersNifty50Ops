export interface FyersConfig {
  appId: string;
  accessToken: string;
  isDemoMode: boolean;
}

// Fyers Quote API Response Structure (simplified)
export interface FyersQuoteData {
  n: string; // Symbol name e.g., NSE:SBIN-EQ
  v: {
    ch: number; // Change
    chp: number; // Change percentage
    lp: number; // Last Traded Price
    o: number; // Open
    h: number; // High
    l: number; // Low
    v: number; // Volume
    ask: number; // Ask
    bid: number; // Bid
  };
}

export interface FyersResponse {
  s: string; // Status 'ok' or 'error'
  d: FyersQuoteData[]; // Data array
  code?: number;
  message?: string;
}

export interface Stock {
  symbol: string;
  name: string; // Friendly name
  ltp: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  lastUpdated: number;
}
