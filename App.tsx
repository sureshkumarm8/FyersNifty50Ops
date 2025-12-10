
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FyersConfig, Stock } from './types';
import { fetchQuotes, exchangeAuthCode } from './services/fyers';
import { ConfigModal } from './components/ConfigModal';
import { StockTable } from './components/StockTable';
import { Activity, RefreshCw, Zap, WifiOff, Wifi, TrendingUp, TrendingDown, LogOut, BarChart3, ArrowUp as ArrowUpIcon, ArrowDown as ArrowDownIcon } from 'lucide-react';

const POLLING_INTERVAL = 2000; // 2 Seconds for live feel

function App() {
  const [config, setConfig] = useState<FyersConfig | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [marketStatus, setMarketStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);
  
  // Stats
  const marketOverview = useMemo(() => {
    if (stocks.length === 0) return { advances: 0, declines: 0, sentiment: 0, vol: 0 };
    const advances = stocks.filter(s => s.change >= 0).length;
    const declines = stocks.length - advances;
    const sentiment = stocks.reduce((acc, s) => acc + s.changePercent, 0) / stocks.length;
    const totalVolume = stocks.reduce((acc, s) => acc + s.volume, 0);
    return { advances, declines, sentiment, vol: totalVolume };
  }, [stocks]);

  const pollingRef = useRef<number | null>(null);

  // Handle OAuth Redirect on Mount (Auto-Exchange)
  useEffect(() => {
    const handleAuthRedirect = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const authCode = urlParams.get('auth_code'); // Fyers returns 'auth_code' in query
      const errorParam = urlParams.get('error');

      // Clean URL immediately to prevent loops or stale state
      if (authCode || errorParam) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      if (errorParam) {
        setError(`Authorization Failed: ${errorParam}`);
        return;
      }
      
      if (authCode) {
        setIsProcessingAuth(true);
        // Retrieve pending config
        const pendingAuth = sessionStorage.getItem('fyers_pending_auth');
        
        if (pendingAuth) {
          try {
            const { appId, secretId } = JSON.parse(pendingAuth);
            
            // Validate inputs again just in case
            if (!appId || !secretId) throw new Error("Missing pending authentication data.");

            // Exchange code for token
            const token = await exchangeAuthCode(authCode, appId, secretId);
            
            // Clear storage
            sessionStorage.removeItem('fyers_pending_auth');

            // Set Config and Start
            handleConfigSave({ appId, accessToken: token, isDemoMode: false });
          } catch (err: any) {
            console.error("Auth Error:", err);
            setError('Authentication Failed: ' + (err.message || 'Unknown Error'));
            setIsProcessingAuth(false);
          }
        } else {
          setIsProcessingAuth(false); 
          // User might have opened the link manually in a new tab without session storage.
          setError("Session context lost. Please try the 'Generate Token' flow again.");
        }
      }
    };

    handleAuthRedirect();
  }, []);

  const startPolling = (cfg: FyersConfig) => {
    setMarketStatus('connecting');
    setIsLoading(true);

    const fetchData = async () => {
      try {
        const data = await fetchQuotes(cfg);
        setStocks(data);
        setLastUpdated(new Date());
        setError(null);
        setMarketStatus('connected');
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to fetch data');
        setMarketStatus('disconnected');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // Clear existing interval before setting new one to avoid duplicates
    if (pollingRef.current) window.clearInterval(pollingRef.current);
    pollingRef.current = window.setInterval(fetchData, POLLING_INTERVAL);
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, []);

  const handleConfigSave = (newConfig: FyersConfig) => {
    setConfig(newConfig);
    setIsProcessingAuth(false);
    startPolling(newConfig);
  };

  // Wrapper for token exchange to pass to modal
  const handleExchangeToken = async (code: string, appId: string, secretId: string): Promise<string> => {
    setIsProcessingAuth(true);
    try {
      const token = await exchangeAuthCode(code, appId, secretId);
      setIsProcessingAuth(false);
      return token;
    } catch (e) {
      setIsProcessingAuth(false);
      throw e;
    }
  };

  const handleDisconnect = () => {
    if (pollingRef.current) window.clearInterval(pollingRef.current);
    setConfig(null);
    setStocks([]);
    setMarketStatus('disconnected');
    setError(null);
  };

  // Landing Page
  if (!config) {
    return (
      <div className="min-h-screen bg-gray-950 text-white relative overflow-hidden flex flex-col items-center justify-center p-4">
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
           <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]"></div>
           <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]"></div>
        </div>

        <div className="z-10 text-center mb-8 max-w-2xl">
          <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 rounded-2xl mb-6 border border-blue-500/20 backdrop-blur-sm">
             <Activity className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Nifty 50 Live Monitor
          </h1>
          <p className="text-xl text-gray-400 mb-8 leading-relaxed">
            Real-time institutional-grade market dashboard. Connect your Fyers API credentials to monitor the top 50 Indian stocks with sub-second latency.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-xl mx-auto mb-12">
            <FeatureCard icon={<Zap className="text-yellow-400" />} title="Real-time Data" desc="Live quotes via Fyers API" />
            <FeatureCard icon={<BarChart3 className="text-green-400" />} title="Market Breadth" desc="Instant advance/decline stats" />
            <FeatureCard icon={<Activity className="text-blue-400" />} title="Zero Latency" desc="Direct client-side connection" />
          </div>
        </div>

        <ConfigModal 
          onSave={handleConfigSave} 
          onExchangeCode={handleExchangeToken}
          isProcessingAuth={isProcessingAuth} 
        />
        
        {error && !isProcessingAuth && (
          <div className="z-20 mt-4 bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded-lg flex items-center gap-2 max-w-md text-sm">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-12 text-sm text-gray-600 z-10">
          Powered by Fyers API v3 • Secure Client-Side Only
        </div>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 p-2 rounded-lg">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">Nifty 50 <span className="text-gray-500 font-medium">Live</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Status Pill */}
             <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
               marketStatus === 'connected' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
               marketStatus === 'connecting' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
               'bg-red-500/10 border-red-500/20 text-red-400'
             }`}>
               {marketStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
               <span className="uppercase tracking-wider">{marketStatus}</span>
             </div>

             <button 
               onClick={handleDisconnect}
               className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
               title="Disconnect API"
             >
               <LogOut className="w-5 h-5" />
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        
        {/* Error Banner */}
        {error && (
           <div className="bg-red-900/20 border border-red-800 text-red-200 p-4 rounded-xl flex items-center justify-between animate-fade-in">
             <div className="flex items-center gap-3">
               <WifiOff className="w-5 h-5 text-red-400" />
               <span>{error}</span>
             </div>
             <button onClick={() => startPolling(config)} className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-sm transition-colors">Retry</button>
           </div>
        )}

        {/* Market Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           <StatCard 
             label="Market Sentiment" 
             value={`${marketOverview.sentiment > 0 ? '+' : ''}${marketOverview.sentiment.toFixed(2)}%`}
             subValue="Avg Change"
             icon={marketOverview.sentiment >= 0 ? <TrendingUp className="text-green-400" /> : <TrendingDown className="text-red-400" />}
             trend={marketOverview.sentiment >= 0 ? 'up' : 'down'}
           />
           <StatCard 
             label="Advances" 
             value={marketOverview.advances.toString()}
             subValue="Stocks Up"
             icon={<ArrowUpIcon className="text-green-400" />}
             trend="up"
           />
           <StatCard 
             label="Declines" 
             value={marketOverview.declines.toString()}
             subValue="Stocks Down"
             icon={<ArrowDownIcon className="text-red-400" />}
             trend="down"
           />
           <StatCard 
             label="Last Update" 
             value={lastUpdated ? lastUpdated.toLocaleTimeString() : '--:--:--'}
             subValue="Local Time"
             icon={<RefreshCw className={`text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />}
             trend="neutral"
           />
        </div>

        {/* Main Table */}
        <div className="flex-1 min-h-0">
           <StockTable data={stocks} isLoading={isLoading && stocks.length === 0} />
        </div>
      </main>
    </div>
  );
}

// Helpers
const FeatureCard = ({ icon, title, desc }: any) => (
  <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 flex items-start gap-3">
    <div className="p-2 bg-gray-800 rounded-lg">{icon}</div>
    <div>
      <h3 className="font-semibold text-gray-200 text-sm">{title}</h3>
      <p className="text-gray-500 text-xs">{desc}</p>
    </div>
  </div>
);

const StatCard = ({ label, value, subValue, icon, trend }: any) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between group hover:border-gray-700 transition-colors">
    <div>
      <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
      <div className={`text-2xl font-bold font-mono ${
        trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-white'
      }`}>
        {value}
      </div>
      <p className="text-gray-600 text-xs mt-1">{subValue}</p>
    </div>
    <div className={`p-3 rounded-xl bg-gray-800/50 ${trend === 'up' ? 'bg-green-900/10' : trend === 'down' ? 'bg-red-900/10' : ''}`}>
      {React.cloneElement(icon, { className: `w-6 h-6 ${icon.props.className}` })}
    </div>
  </div>
);

export default App;
