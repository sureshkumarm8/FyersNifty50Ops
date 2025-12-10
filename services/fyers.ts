
import { FyersConfig, FyersResponse, Stock } from '../types';
import { NIFTY_50_SYMBOLS } from '../constants';
import { generateAppIdHash } from '../utils/crypto';

// Fyers V3 Data API Endpoint
const QUOTES_URL = 'https://api.fyers.in/data-rest/v3/quotes';
const VALIDATE_AUTH_URL = 'https://api.fyers.in/api/v3/validate-authcode';

// List of CORS Proxies to try in order of preference
// 'needsEncoding': true if the target URL must be encoded component
const PROXY_LIST = [
  { base: 'https://corsproxy.io/?', needsEncoding: true },
  { base: 'https://thingproxy.freeboard.io/fetch/', needsEncoding: false },
  { base: 'https://api.codetabs.com/v1/proxy?quest=', needsEncoding: true }
];

/**
 * Helper to fetch data using a failover strategy for proxies.
 * Tries proxies sequentially until one works or all fail.
 */
async function fetchWithFailover(targetUrl: string, options: RequestInit): Promise<Response> {
  let lastError: any;

  for (const proxy of PROXY_LIST) {
    try {
      // Construct URL based on proxy requirements
      const url = proxy.needsEncoding 
        ? `${proxy.base}${encodeURIComponent(targetUrl)}` 
        : `${proxy.base}${targetUrl}`;

      const response = await fetch(url, options);

      // If we get a response (even 4xx/5xx), the proxy worked and we reached the server.
      // However, if the proxy itself returns a 500/503 (HTML error page), we might want to try the next one.
      // For simplicity, we assume if fetch doesn't throw, the connection is successful.
      return response;

    } catch (error: any) {
      console.warn(`Proxy ${proxy.base} failed:`, error.message);
      lastError = error;
      // Continue to next proxy in the list
    }
  }

  // If all proxies fail
  throw lastError || new Error("Unable to connect to any CORS proxy.");
}

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
    const targetUrl = `${QUOTES_URL}?symbols=${symbolsParam}`;

    const response = await fetchWithFailover(targetUrl, {
      method: 'GET',
      headers: {
        // V3 Auth format: "AppID:AccessToken"
        'Authorization': `${config.appId}:${config.accessToken}`,
        // Note: Content-Type is often not needed for GET and can trigger stricter CORS preflight
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("Invalid Credentials or Token Expired");
      if (response.status === 403) throw new Error("Access Forbidden (Check Permissions)");
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
    if (error.message === 'Failed to fetch') {
      throw new Error("Network Error: Could not connect to Fyers via Proxy. Please check your internet.");
    }
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

    const response = await fetchWithFailover(VALIDATE_AUTH_URL, {
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
    if (error.message === 'Failed to fetch') {
      throw new Error("Network Error during Auth. Please check your connection.");
    }
    throw new Error(error.message || "Failed to exchange auth code");
  }
};
