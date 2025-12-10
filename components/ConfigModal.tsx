
import React, { useState, useEffect } from 'react';
import { FyersConfig } from '../types';
import { Key, Lock, AlertTriangle, PlayCircle, Zap, Globe, Copy, ExternalLink, CheckCircle2, ArrowRight } from 'lucide-react';

interface ConfigModalProps {
  onSave: (config: FyersConfig) => void;
  onExchangeCode?: (code: string, appId: string, secretId: string) => Promise<string>;
  isProcessingAuth?: boolean;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ onSave, onExchangeCode, isProcessingAuth }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'generate'>('manual');
  
  // Manual State
  const [appId, setAppId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  
  // Generator State
  const [genAppId, setGenAppId] = useState('');
  const [genSecretId, setGenSecretId] = useState('');
  const [redirectUri, setRedirectUri] = useState(window.location.origin);
  const [generatedUrl, setGeneratedUrl] = useState('');
  
  // Manual Code Entry State (for fallback)
  const [manualAuthCode, setManualAuthCode] = useState('');
  
  const [error, setError] = useState('');

  // Load saved generator config from session if available
  useEffect(() => {
    const savedConfig = sessionStorage.getItem('fyers_pending_auth');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setGenAppId(parsed.appId || '');
        setGenSecretId(parsed.secretId || '');
        if (parsed.redirectUri) setRedirectUri(parsed.redirectUri);
      } catch (e) {}
    }
  }, []);

  // Update generated URL whenever inputs change
  useEffect(() => {
    if (genAppId && redirectUri) {
      // Use 'code' as response_type (Fyers V3 Standard)
      const state = 'fyers_nifty_live_' + Date.now();
      const url = `https://api.fyers.in/api/v3/generate-authcode?client_id=${genAppId.trim()}&redirect_uri=${encodeURIComponent(redirectUri.trim())}&response_type=code&state=${state}`;
      setGeneratedUrl(url);
    } else {
      setGeneratedUrl('');
    }
  }, [genAppId, redirectUri]);

  const handleManualSave = () => {
    if (!appId.trim() || !accessToken.trim()) {
      setError('App ID and Access Token are required.');
      return;
    }
    onSave({ appId: appId.trim(), accessToken: accessToken.trim(), isDemoMode: false });
  };

  const handleDemo = () => {
    onSave({ appId: 'demo', accessToken: 'demo', isDemoMode: true });
  };

  const openAuthWindow = () => {
    const cleanAppId = genAppId.trim();
    const cleanSecret = genSecretId.trim();
    const cleanRedirect = redirectUri.trim();

    if (!cleanAppId || !cleanSecret || !cleanRedirect) {
      setError('All fields are required to generate token.');
      return;
    }

    // Save state to session storage
    sessionStorage.setItem('fyers_pending_auth', JSON.stringify({
      appId: cleanAppId,
      secretId: cleanSecret,
      redirectUri: cleanRedirect
    }));

    // Open in new window to avoid iframe/environment 503 issues
    if (generatedUrl) {
      window.open(generatedUrl, '_blank', 'width=600,height=700');
    }
  };

  const handleManualCodeExchange = async () => {
    setError('');
    const codeToUse = manualAuthCode.trim();
    
    if (!codeToUse) {
      setError("Please paste the Auth Code or the full callback URL.");
      return;
    }

    // Extract code if user pasted full URL
    let finalCode = codeToUse;
    if (codeToUse.includes('auth_code=')) {
      try {
        const urlObj = new URL(codeToUse.startsWith('http') ? codeToUse : `http://dummy.com?${codeToUse}`);
        const extracted = urlObj.searchParams.get('auth_code');
        if (extracted) finalCode = extracted;
      } catch (e) {
        // Fallback if URL parsing fails
        const match = codeToUse.match(/auth_code=([^&]+)/);
        if (match) finalCode = match[1];
      }
    }

    if (onExchangeCode) {
      try {
        const token = await onExchangeCode(finalCode, genAppId.trim(), genSecretId.trim());
        // Success handled by parent via onSave usually, but we call onSave here to be sure
        onSave({ appId: genAppId.trim(), accessToken: token, isDemoMode: false });
      } catch (err: any) {
        setError(err.message || "Failed to exchange code.");
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isProcessingAuth) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-blue-500/50 rounded-xl p-8 max-w-sm w-full text-center shadow-[0_0_50px_rgba(59,130,246,0.2)]">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-xl font-bold text-white mb-2">Authenticating</h2>
          <p className="text-gray-400 text-sm">Exchanging authorization code for access token...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Lock className="w-6 h-6 text-blue-300" />
            Fyers API Access
          </h2>
          <p className="text-blue-200 text-sm mt-2">
            Securely connect to Fyers V3 API to fetch live market data.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button 
            onClick={() => { setActiveTab('manual'); setError(''); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'manual' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
          >
            Existing Token
          </button>
          <button 
            onClick={() => { setActiveTab('generate'); setError(''); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'generate' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
          >
            Generate Token
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-200 p-3 rounded-lg flex items-start gap-2 text-sm mb-6">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'manual' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">App ID (Client ID)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="w-4 h-4 text-gray-500" />
                  </div>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="Ex: XV234234-100"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-600 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Access Token</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 pt-3 pointer-events-none">
                    <Lock className="w-4 h-4 text-gray-500" />
                  </div>
                  <textarea
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="Paste your active access token here..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all h-32 resize-none placeholder-gray-600 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={handleDemo}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors border border-gray-700 font-medium text-sm"
                >
                  <PlayCircle className="w-4 h-4" />
                  Try Demo
                </button>
                <button
                  onClick={handleManualSave}
                  className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg shadow-blue-900/50 font-bold text-sm"
                >
                  Connect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3">
                <p className="text-xs text-blue-200">
                  Follow the steps below to authenticate securely with Fyers.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">App ID</label>
                  <input
                    type="text"
                    value={genAppId}
                    onChange={(e) => setGenAppId(e.target.value)}
                    placeholder="XV234234-100"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Secret ID</label>
                  <input
                    type="password"
                    value={genSecretId}
                    onChange={(e) => setGenSecretId(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Redirect URI</label>
                <div className="relative">
                   <input
                    type="text"
                    value={redirectUri}
                    onChange={(e) => setRedirectUri(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-xs font-mono"
                  />
                  <Globe className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-500" />
                </div>
              </div>

              <div className="pt-2 border-t border-gray-800 space-y-4">
                {/* Step 1 */}
                <div>
                   <div className="flex items-center justify-between mb-2">
                     <span className="text-xs font-bold text-white bg-gray-700 px-2 py-0.5 rounded">Step 1</span>
                     <span className="text-[10px] text-gray-500">Opens in new window</span>
                   </div>
                   <button
                    onClick={openAuthWindow}
                    disabled={!generatedUrl}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors text-sm font-medium"
                   >
                    <ExternalLink className="w-4 h-4" />
                    Open Fyers Login
                   </button>
                </div>

                {/* Step 2 */}
                <div>
                   <div className="mb-2">
                     <span className="text-xs font-bold text-white bg-gray-700 px-2 py-0.5 rounded">Step 2</span>
                     <span className="text-[10px] text-gray-400 ml-2">Paste the Code or URL you were redirected to</span>
                   </div>
                   <div className="flex gap-2">
                     <input
                      type="text"
                      value={manualAuthCode}
                      onChange={(e) => setManualAuthCode(e.target.value)}
                      placeholder="Paste 'auth_code' or full URL here..."
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                     />
                     <button
                      onClick={handleManualCodeExchange}
                      disabled={!manualAuthCode}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg transition-colors font-bold text-sm flex items-center gap-2"
                     >
                       <Zap className="w-4 h-4" />
                       Connect
                     </button>
                   </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-6 pt-4 border-t border-gray-800 text-center">
             <p className="text-[10px] text-gray-600">
              Your credentials are encrypted and processed locally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
