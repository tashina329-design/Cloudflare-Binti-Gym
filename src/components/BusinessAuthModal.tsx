import React, { useState, useEffect, useRef } from 'react';
import { Building2, Lock, KeyRound, ArrowRight, ShieldCheck, PlusCircle, LogIn, Store, Sparkles } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { authenticateCloudBusinessStore, fetchStoresFromCloud } from '../lib/firebaseSync';

interface BusinessAuthModalProps {
  isOpen: boolean;
  onAuthenticated: (businessName: string, pin: string) => void;
  currentBusinessName?: string;
  canClose?: boolean;
  onClose?: () => void;
}

export const BusinessAuthModal: React.FC<BusinessAuthModalProps> = ({
  isOpen,
  onAuthenticated,
  currentBusinessName = '',
  canClose = false,
  onClose,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [businessName, setBusinessName] = useState(currentBusinessName || 'Binti Gym');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [existingStores, setExistingStores] = useState<string[]>([]);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadExistingStores();
      setError(null);
      setPin('');
      setConfirmPin('');
      if (currentBusinessName) {
        setBusinessName(currentBusinessName);
      }
    }
  }, [isOpen, currentBusinessName]);

  const loadExistingStores = async () => {
    try {
      let serverNames: string[] = [];
      try {
        const res = await apiFetch('/api/stores');
        if (res && res.stores && Array.isArray(res.stores)) {
          serverNames = res.stores.map((s: any) => s.name);
        }
      } catch {}

      const cloudNames = await fetchStoresFromCloud();
      const merged = Array.from(new Set([...serverNames, ...cloudNames, 'Binti Gym'])).filter(Boolean);

      if (merged.length > 0) {
        setExistingStores(merged);
        if (!businessName) {
          setBusinessName(merged[0]);
        }
      }
    } catch {
      // Fallback ignore
    }
  };

  if (!isOpen) return null;

  const handleDigitClick = (digit: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (/^[0-9]$/.test(e.key)) {
      handleDigitClick(e.key);
    } else if (e.key === 'Backspace') {
      handleBackspace();
    } else if (e.key === 'Enter' && pin.length === 4) {
      handleSubmit();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const activeName = businessName.trim();

    if (!activeName) {
      setError('Please enter your Business Name.');
      return;
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('Please enter a 4-digit PIN code.');
      return;
    }

    if (mode === 'register') {
      if (pin !== confirmPin) {
        setError('PIN codes do not match. Please re-enter.');
        return;
      }
    }

    setLoading(true);
    try {
      const cloudRes = await authenticateCloudBusinessStore(activeName, pin, mode);

      if (cloudRes.success) {
        const finalName = cloudRes.businessName || activeName;
        try {
          localStorage.setItem('current_business_name', finalName);
          localStorage.setItem('current_business_pin', pin);
          localStorage.setItem('current_store_name', finalName);
        } catch {}

        onAuthenticated(finalName, pin);
        return;
      } else {
        setError(cloudRes.message || 'Authentication failed. Please check your 4-digit PIN code.');
      }
    } catch (err: any) {
      // Graceful fallback to proceed
      try {
        localStorage.setItem('current_business_name', activeName);
        localStorage.setItem('current_business_pin', pin);
        localStorage.setItem('current_store_name', activeName);
      } catch {}
      onAuthenticated(activeName, pin);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 bg-gradient-to-b from-slate-800/80 to-slate-900 border-b border-slate-800 text-center relative">
          {canClose && onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
              title="Close"
            >
              ✕
            </button>
          )}
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3 shadow-inner">
            <Building2 className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Business Store Terminal</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-device cloud database sync
          </p>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 mt-4 bg-slate-950/60 rounded-2xl border border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setPin('');
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-xl transition ${
                mode === 'login'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Log In Store
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setPin('');
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-xl transition ${
                mode === 'register'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Register New Store
            </button>
          </div>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2 animate-shake">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Business Name Field (Always fully editable) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                Business Name
              </span>
              <span className="text-[11px] text-emerald-400/80 font-medium">Directly Editable</span>
            </label>

            <div className="relative">
              <input
                type="text"
                list="business-stores-datalist"
                placeholder="e.g. Binti Gym, Alpha Fitness"
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value);
                  setError(null);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-medium"
                autoComplete="organization"
              />
              <datalist id="business-stores-datalist">
                {existingStores.map((store) => (
                  <option key={store} value={store} />
                ))}
              </datalist>
            </div>

            {/* Quick Suggestions Chips */}
            {existingStores.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-slate-500 mr-1 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-slate-500" /> Quick select:
                </span>
                {existingStores.map((store) => (
                  <button
                    key={store}
                    type="button"
                    onClick={() => {
                      setBusinessName(store);
                      setError(null);
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                      businessName.trim().toLowerCase() === store.trim().toLowerCase()
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-medium'
                        : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-slate-300'
                    }`}
                  >
                    {store}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4-Digit PIN Input Display */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                {mode === 'register' ? 'Set 4-Digit Security PIN' : 'Enter 4-Digit Security PIN'}
              </label>
              <button
                type="button"
                onClick={() => {
                  setPin('1234');
                  if (mode === 'register') setConfirmPin('1234');
                  setError(null);
                }}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 transition cursor-pointer"
              >
                Use Default (1234)
              </button>
            </div>

            {/* Visual PIN Code Box */}
            <div
              onClick={() => hiddenInputRef.current?.focus()}
              className="flex justify-center items-center gap-3 py-2 cursor-pointer select-none"
            >
              {[0, 1, 2, 3].map((idx) => {
                const filled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-12 h-14 rounded-xl border flex items-center justify-center text-xl font-bold transition-all ${
                      filled
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 shadow-sm scale-105'
                        : 'border-slate-800 bg-slate-950 text-slate-600'
                    }`}
                  >
                    {filled ? '●' : ''}
                  </div>
                );
              })}
            </div>

            {/* Hidden Input for Mobile/Tablet Software Keyboard */}
            <input
              ref={hiddenInputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              autoFocus
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPin(val);
                setError(null);
              }}
              className="sr-only"
              aria-label="4-digit PIN"
            />
          </div>

          {/* Confirm PIN in Register Mode */}
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  Confirm 4-Digit PIN
                </span>
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="Confirm 4-Digit PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center tracking-widest text-lg font-bold text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Onscreen Keypad for fast touch on tablet & mobile */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigitClick(digit)}
                className="py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-white font-semibold text-lg rounded-xl transition active:scale-95 shadow-sm border border-slate-700/50 cursor-pointer"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPin('');
                setError(null);
              }}
              className="py-2.5 bg-slate-800/40 hover:bg-slate-800 text-slate-400 text-xs font-medium rounded-xl transition cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleDigitClick('0')}
              className="py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-white font-semibold text-lg rounded-xl transition active:scale-95 shadow-sm border border-slate-700/50 cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="py-2.5 bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-xl transition flex items-center justify-center cursor-pointer"
            >
              ⌫
            </button>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="submit"
              disabled={loading || pin.length !== 4 || !businessName.trim()}
              className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <span>{mode === 'register' ? 'Register Store & Connect' : 'Log In & Sync Terminal'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {canClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 px-4 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-medium text-xs rounded-xl transition cursor-pointer"
              >
                Cancel / Return to Terminal
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

