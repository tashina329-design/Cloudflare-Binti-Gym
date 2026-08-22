import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X, CheckCircle, Smartphone } from 'lucide-react';
import { subscribePWAInstall, promptInstallPWA, isStandaloneMode, isIOS } from '../lib/pwa';

export const InstallPrompt: React.FC = () => {
  const [canInstall, setCanInstall] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    return sessionStorage.getItem('pwa_prompt_dismissed') === 'true';
  });
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandaloneMode()) {
      setInstalled(true);
      return;
    }

    const unsubscribe = subscribePWAInstall((available) => {
      setCanInstall(available);
    });

    return () => unsubscribe();
  }, []);

  if (installed || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (canInstall) {
      const accepted = await promptInstallPWA();
      if (accepted) {
        setInstalled(true);
      }
    } else if (isIOS()) {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  // Only show if browser supports native prompt or on mobile iOS
  if (!canInstall && !isIOS()) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[9999] bg-slate-900/95 border-2 border-emerald-500/40 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-300">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              Install BINTI Gym App
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-semibold">PWA</span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Launch directly from your home screen with fast standalone performance.
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {isIOS() ? 'How to Install' : 'Install App'}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs transition cursor-pointer"
              >
                Not Now
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-lg transition cursor-pointer"
            title="Dismiss prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Safari Installation Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-100">Install on iPhone / iPad</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 font-bold shrink-0">1</div>
                <div>
                  <p className="font-semibold text-slate-200">Tap the Share icon in Safari</p>
                  <p className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-1">
                    Located at the bottom of your Safari screen <Share className="w-3.5 h-3.5 inline text-sky-400" />
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold shrink-0">2</div>
                <div>
                  <p className="font-semibold text-slate-200">Select "Add to Home Screen"</p>
                  <p className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-1">
                    Scroll down and tap <PlusSquare className="w-3.5 h-3.5 inline text-emerald-400" /> <strong>Add to Home Screen</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 font-bold shrink-0">3</div>
                <div>
                  <p className="font-semibold text-slate-200">Tap "Add" in top-right</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    The BINTI Gym icon will appear on your Home Screen as a standalone app!
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition active:scale-95"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
