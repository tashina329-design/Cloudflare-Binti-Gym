/**
 * BINTI Gym PWA Helper & Service Worker Registration
 */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: InstallPromptEvent | null = null;
const installListeners = new Set<(canInstall: boolean) => void>();

// Register Service Worker in browser
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    // Only register on http/https
    if (window.location.protocol.startsWith('http')) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[PWA] Service Worker registered with scope:', registration.scope);

          // Check for service worker updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] New content is available; please refresh.');
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn('[PWA] Service Worker registration failed:', error);
        });
    }
  });

  // Capture beforeinstallprompt for Android Chrome / Desktop PWA installation
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    notifyInstallListeners(true);
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] BINTI Gym was successfully installed!');
    deferredPrompt = null;
    notifyInstallListeners(false);
  });
}

function notifyInstallListeners(canInstall: boolean) {
  installListeners.forEach((listener) => listener(canInstall));
}

export function subscribePWAInstall(callback: (canInstall: boolean) => void): () => void {
  installListeners.add(callback);
  callback(!!deferredPrompt);
  return () => {
    installListeners.delete(callback);
  };
}

export async function promptInstallPWA(): Promise<boolean> {
  if (!deferredPrompt) {
    return false;
  }
  try {
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    deferredPrompt = null;
    notifyInstallListeners(false);
    return choiceResult.outcome === 'accepted';
  } catch (err) {
    console.warn('[PWA] Error during install prompt:', err);
    return false;
  }
}

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
}
