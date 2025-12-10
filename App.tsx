
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FyersConfig, Stock } from './types';
import { fetchQuotes, exchangeAuthCode } from './services/fyers';
import { ConfigModal } from './components/ConfigModal';
import { StockTable } from './components/StockTable';
import { Activity, RefreshCw, Zap, WifiOff, Wifi, TrendingUp, TrendingDown, LogOut, BarChart3, ArrowUp as ArrowUpIcon, ArrowDown as ArrowDownIcon, Settings } from 'lucide-react';

const POLLING_INTERVAL = 2000; // 2 Seconds for live feel

function App() {
  const [config, setConfig] = useState<FyersConfig | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [marketStatus, setMarketStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  
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

  // Handle OAuth Redirect on Mount
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
          setError("Session expired or invalid. Please try generating the token again.");
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
    setIsConfigModalOpen(false);
    startPolling(newConfig);
  };

  const handleDisconnect = () => {
    if (pollingRef.current) window.clearInterval(pollingRef.current);
    setConfig(null);
    setStocks([]);
    setMarketStatus('disconnected');
    setError(null);
  };

  // Dashboard is always rendered now
  return (
    <div className="h-screen bg-gray-950 text-gray-100 flex flex-col font-sans overflow-hidden">
      {/* Navbar */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-30 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 p-2 rounded-lg">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">Nifty 50 <span className="text-gray-500 font-medium">Live</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Status Pill */}
             <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
               marketStatus === 'connected' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
               marketStatus === 'connecting' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
               'bg-red-500/10 border-red-500/20 text-red-400'
             }`}>
               {marketStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
               <span className="uppercase tracking-wider">{marketStatus}</span>
             </div>

             {/* Actions */}
             <div className="flex items-center border-l border-gray-800 pl-4 gap-2">
               <button 
                 onClick={() => setIsConfigModalOpen(true)}
                 className={`p-2 rounded-lg transition-colors ${!config ? 'bg-blue-600 text-white hover:bg-blue-500 animate-pulse' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                 title="Settings & API Key"
               >
                 <Settings className="w-5 h-5" />
               </button>

               {config && (
                 <button 
                   onClick={handleDisconnect}
                   className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                   title="Disconnect API"
                 >
                   <LogOut className="w-5 h-5" />
                 </button>
               )}
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6 overflow-hidden">
        
        {/* Error Banner */}
        {error && (
           <div className="bg-red-900/20 border border-red-800 text-red-200 p-4 rounded-xl flex items-center justify-between shrink-0">
             <div className="flex items-center gap-3">
               <WifiOff className="w-5 h-5 text-red-400" />
               <span>{error}</span>
             </div>
             {config && (
               <button onClick={() => startPolling(config)} className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-sm transition-colors">Retry</button>
             )}
           </div>
        )}

        {/* Market Stats Grid - Only show if we have some data or connected */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
           <StatCard 
             label="Market Sentiment" 
             value={stocks.length ? `${marketOverview.sentiment > 0 ? '+' : ''}${marketOverview.sentiment.toFixed(2)}%` : '--'}
             subValue="Avg Change"
             icon={marketOverview.sentiment >= 0 ? <TrendingUp className="text-green-400" /> : <TrendingDown className="text-red-400" />}
             trend={marketOverview.sentiment >= 0 ? 'up' : 'down'}
           />
           <StatCard 
             label="Advances" 
             value={stocks.length ? marketOverview.advances.toString() : '--'}
             subValue="Stocks Up"
             icon={<ArrowUpIcon className="text-green-400" />}
             trend="up"
           />
           <StatCard 
             label="Declines" 
             value={stocks.length ? marketOverview.declines.toString() : '--'}
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
        <div className="flex-1 overflow-hidden relative">
           <StockTable data={stocks} isLoading={isLoading && stocks.length === 0} />
           
           {/* Overlay for disconnected state */}
           {!config && !isLoading && (
             <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4 text-center">
               <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-2xl max-w-md">
                 <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Settings className="w-8 h-8 text-blue-400" />
                 </div>
                 <h3 className="text-xl font-bold text-white mb-2">Setup API Connection</h3>
                 <p className="text-gray-400 mb-6 text-sm">
                   Connect your Fyers account to see live market data for Nifty 50 stocks.
                 </p>
                 <button 
                   onClick={() => setIsConfigModalOpen(true)}
                   className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors w-full"
                 >
                   Open Settings
                 </button>
               </div>
             </div>
           )}
        </div>
      </main>

      {/* Modal */}
      {(isConfigModalOpen || isProcessingAuth) && (
        <ConfigModal 
          onSave={handleConfigSave} 
          onClose={() => setIsConfigModalOpen(false)}
          isProcessingAuth={isProcessingAuth} 
        />
      )}
    </div>
  );
}

// Helpers
const StatCard = ({ label, value, subValue, icon, trend }: any) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between group hover:border-gray-700 transition-colors">
    <div className="min-w-0">
      <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider mb-1 truncate">{label}</p>
      <div className={`text-xl font-bold font-mono truncate ${
        trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-white'
      }`}>
        {value}
      </div>
      <p className="text-gray-600 text-[10px] mt-1 truncate">{subValue}</p>
    </div>
    <div className={`p-2.5 rounded-xl bg-gray-800/50 shrink-0 ${trend === 'up' ? 'bg-green-900/10' : trend === 'down' ? 'bg-red-900/10' : ''}`}>
      {React.cloneElement(icon, { className: `w-5 h-5 ${icon.props.className}` })}
    </div>
  </div>
);

export default App;
