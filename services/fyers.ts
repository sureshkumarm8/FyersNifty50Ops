
import { FyersConfig, FyersResponse, Stock } from '../types';
import { NIFTY_50_SYMBOLS } from '../constants';
import { generateAppIdHash } from '../utils/crypto';

// Fyers V3 Data API Endpoint
const QUOTES_URL = 'https://api.fyers.in/data-rest/v3/quotes';
const VALIDATE_AUTH_URL = 'https://api.fyers.in/api/v3/validate-authcode';

// Helper to generate random demo data if user doesn't have API key handy
const generateDemoData = (): Stock[] => {
  return NIFTY_50_SYMBOLS.map(item => {
    const basePrice = Math.random() * 3000 + 100;
    const change = (Math.random() - 0.5) * 50;
    const changePercent = (change / basePrice) * 100;
    return {
      symbol: item.symbol,
      name: item.name,
      ltp: parseFloat((basePrice + change).toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      open: parseFloat(basePrice.toFixed(2)),
      high: parseFloat((basePrice + Math.abs(change) + 10).toFixed(2)),
      low: parseFloat((basePrice - Math.abs(change) - 10).toFixed(2)),
      volume: Math.floor(Math.random() * 1000000),
      lastUpdated: Date.now()
    };
  });
};

export const fetchQuotes = async (config: FyersConfig): Promise<Stock[]> => {
  // Demo Mode Flow
  if (config.isDemoMode) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(generateDemoData()), 300); // Simulate network latency
    });
  }

  // Real API Flow
  try {
    const symbolsParam = NIFTY_50_SYMBOLS.map(s => s.symbol).join(',');
    
    // Using Fyers V3 Data Quote API
    const response = await fetch(`${QUOTES_URL}?symbols=${symbolsParam}`, {
      method: 'GET',
      headers: {
        // V3 Auth format: "AppID:AccessToken"
        'Authorization': `${config.appId}:${config.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("Invalid Credentials or Token Expired");
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: FyersResponse = await response.json();

    if (data.s !== 'ok' || !data.d) {
      throw new Error(data.message || 'Failed to fetch quotes');
    }

    // Map Fyers response to our App Stock type
    return data.d.map(quote => {
      const friendlyName = NIFTY_50_SYMBOLS.find(s => s.symbol === quote.n)?.name || quote.n;
      // Fyers V3 structure: quote.v contains values
      return {
        symbol: quote.n,
        name: friendlyName,
        ltp: quote.v.lp || 0,
        change: quote.v.ch || 0,
        changePercent: quote.v.chp || 0,
        open: quote.v.o || 0,
        high: quote.v.h || 0,
        low: quote.v.l || 0,
        volume: quote.v.v || 0,
        lastUpdated: Date.now()
      };
    });

  } catch (error: any) {
    console.error("Fetch Quotes Error:", error);
    throw new Error(error.message || "Failed to connect to Fyers API");
  }
};

export const exchangeAuthCode = async (authCode: string, appId: string, secretId: string): Promise<string> => {
  try {
    const appIdHash = await generateAppIdHash(appId, secretId);
    
    const payload = {
      grant_type: "authorization_code",
      appIdHash: appIdHash,
      code: authCode,
      client_id: appId // Explicitly including client_id for V3 robustness
    };

    const response = await fetch(VALIDATE_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.s !== 'ok') {
      throw new Error(data.message || 'Failed to validate auth code');
    }

    return data.access_token;
  } catch (error: any) {
    console.error("Auth Exchange Error:", error);
    throw new Error(error.message || "Failed to exchange auth code");
  }
};
