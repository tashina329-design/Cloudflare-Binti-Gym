import React, { useState } from 'react';
import { RotateCcw, Database, Sparkles, Trash2, X, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ResetDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetToDemo: () => Promise<void>;
  onClearToZero: () => Promise<void>;
  currentStore: string;
}

export const ResetDatabaseModal: React.FC<ResetDatabaseModalProps> = ({
  isOpen,
  onClose,
  onResetToDemo,
  onClearToZero,
  currentStore,
}) => {
  const [loadingAction, setLoadingAction] = useState<'demo' | 'zero' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDemoClick = async () => {
    setError(null);
    setLoadingAction('demo');
    try {
      await onResetToDemo();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to populate demo seed data');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleZeroClick = async () => {
    setError(null);
    setLoadingAction('zero');
    try {
      await onClearToZero();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to clear database to zero');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-100 relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={loadingAction !== null}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Database Reset Options</h3>
            <p className="text-xs text-slate-400">
              Select how to reset data for <span className="text-emerald-400 font-semibold">{currentStore}</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Options Selection */}
        <div className="space-y-3.5 pt-1">
          {/* Option 1: Standard Demo Data */}
          <div className="bg-slate-950/70 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-4 transition-all space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-slate-100">Populate Standard Demo Data</h4>
                  <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 mt-0.5">
                    Recommended for Demo & Exploration
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Populates full demo transactions for today: active check-ins, sales (POS, Walk-In, PT, Classes, Membership Renewals), expenses, and active morning staff shift.
            </p>

            <button
              type="button"
              disabled={loadingAction !== null}
              onClick={handleDemoClick}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
            >
              {loadingAction === 'demo' ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  Seeding Demo Records...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Load Standard Demo Records
                </>
              )}
            </button>
          </div>

          {/* Option 2: Clear All to Zero */}
          <div className="bg-slate-950/70 border border-slate-800 hover:border-rose-500/40 rounded-xl p-4 transition-all space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-slate-100">Clear All to Zero (Fresh Start)</h4>
                  <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60 mt-0.5">
                    Clean Slate for Live Operations
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Wipes all today's transactions, attendances, and expenses so all revenue, cash, and attendance counters reset to zero ($0.00). Keeps registered members & staff intact.
            </p>

            <button
              type="button"
              disabled={loadingAction !== null}
              onClick={handleZeroClick}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600/80 hover:bg-rose-600 active:bg-rose-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40"
            >
              {loadingAction === 'zero' ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  Clearing to Zero...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Reset Everything to Zero ($0.00)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loadingAction !== null}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
