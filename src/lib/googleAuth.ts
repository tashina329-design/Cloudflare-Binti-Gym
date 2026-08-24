import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from './firebase';
import appletConfig from '../../firebase-applet-config.json';

export interface GoogleAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export type AuthUser = GoogleAuthUser | FirebaseUser;

const OAUTH_CLIENT_ID =
  (appletConfig as any)?.oAuthClientId ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID) ||
  '368231596957-lv5datf9rdnjmvib7ic2qktu5v0r3tk0.apps.googleusercontent.com';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
].join(' ');

const firebaseProvider = new GoogleAuthProvider();
firebaseProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
firebaseProvider.addScope('https://www.googleapis.com/auth/drive.file');
firebaseProvider.setCustomParameters({
  prompt: 'select_account',
});

const STORAGE_KEY_TOKEN = 'gym_google_workspace_token';
const STORAGE_KEY_USER = 'gym_google_workspace_user';

let isSigningIn = false;
let cachedAccessToken: string | null = (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_TOKEN) : null);
let cachedUser: AuthUser | null = null;

try {
  if (typeof localStorage !== 'undefined') {
    const savedUserStr = localStorage.getItem(STORAGE_KEY_USER);
    if (savedUserStr) {
      cachedUser = JSON.parse(savedUserStr);
    }
  }
} catch (e) {
  // ignore storage parse error
}

const authListeners: Array<{
  onSuccess?: (user: AuthUser, token: string) => void;
  onFailure?: () => void;
}> = [];

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isTouchMac = /Macintosh/i.test(ua) && (navigator.maxTouchPoints > 1 || (navigator as any).msMaxTouchPoints > 1);
  return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) || isTouchMac;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isTouchMac = /Macintosh/i.test(ua) && (navigator.maxTouchPoints > 1 || (navigator as any).msMaxTouchPoints > 1);
  return /iPhone|iPad|iPod/i.test(ua) || isTouchMac;
}

// Helper to ensure GIS script is loaded
let gisLoadedPromise: Promise<void> | null = null;
let gisTokenClient: any = null;
let pendingGisPromise: { resolve: (val: { user: GoogleAuthUser; accessToken: string }) => void; reject: (err: any) => void } | null = null;

export function initGisClient(): void {
  if (typeof window === 'undefined') return;
  const google = (window as any).google;
  if (!google?.accounts?.oauth2 || !OAUTH_CLIENT_ID) return;

  try {
    gisTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: OAUTH_CLIENT_ID,
      scope: SCOPES,
      callback: async (tokenResponse: any) => {
        if (!pendingGisPromise) return;
        const { resolve, reject } = pendingGisPromise;
        pendingGisPromise = null;

        if (tokenResponse.error) {
          console.error('GIS token error:', tokenResponse);
          reject(new Error(tokenResponse.error_description || tokenResponse.error || 'Google sign-in authorization failed.'));
          return;
        }

        if (!tokenResponse.access_token) {
          reject(new Error('No access token returned from Google.'));
          return;
        }

        try {
          const accessToken = tokenResponse.access_token;
          const user = await fetchGoogleUserProfile(accessToken);
          notifyAuthSuccess(user, accessToken);
          resolve({ user, accessToken });
        } catch (e: any) {
          reject(e);
        }
      },
      error_callback: (err: any) => {
        if (!pendingGisPromise) return;
        const { reject } = pendingGisPromise;
        pendingGisPromise = null;
        console.error('GIS Error Callback:', err);
        reject(new Error(err.message || 'Google Sign-In popup was closed or blocked. On iPad, check Safari popup settings or use the Direct Sheet Link option.'));
      },
    });
  } catch (e) {
    console.warn('Failed to init GIS token client:', e);
  }
}

function ensureGisLoaded(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.accounts?.oauth2) {
    initGisClient();
    return Promise.resolve();
  }
  if (gisLoadedPromise) return gisLoadedPromise;

  gisLoadedPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById('google-identity-services-script');
    if (existingScript) {
      if ((window as any).google?.accounts?.oauth2) {
        initGisClient();
        resolve();
      } else {
        existingScript.addEventListener('load', () => {
          initGisClient();
          resolve();
        });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')));
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-identity-services-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      initGisClient();
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });

  return gisLoadedPromise;
}

// Auto-initialize GIS on load
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    ensureGisLoaded().catch(() => {});
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      ensureGisLoaded().catch(() => {});
    });
  }
}

// Fetch Google User Profile using OAuth access token
export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleAuthUser> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        uid: data.sub || data.email || 'google-user',
        email: data.email || null,
        displayName: data.name || data.email || 'Google User',
        photoURL: data.picture || null,
      };
    }
  } catch (err) {
    console.warn('Could not fetch userinfo profile:', err);
  }

  return {
    uid: 'google-workspace-user',
    email: 'connected-account@google.com',
    displayName: 'Google Workspace Account',
    photoURL: null,
  };
}

// Synchronous / Direct gesture token request for iPad / Safari
export function requestGisTokenDirect(): Promise<{ user: GoogleAuthUser; accessToken: string }> {
  return new Promise((resolve, reject) => {
    try {
      const google = (window as any).google;
      if (!gisTokenClient && google?.accounts?.oauth2) {
        initGisClient();
      }

      if (gisTokenClient) {
        pendingGisPromise = { resolve, reject };
        // Trigger synchronously so Safari / iPadOS recognizes the user touch event
        gisTokenClient.requestAccessToken({ prompt: 'select_account' });
      } else {
        ensureGisLoaded()
          .then(() => {
            initGisClient();
            if (gisTokenClient) {
              pendingGisPromise = { resolve, reject };
              gisTokenClient.requestAccessToken({ prompt: 'select_account' });
            } else {
              reject(new Error('Google authorization client is still initializing. Please tap again in a moment.'));
            }
          })
          .catch(reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}

// Request Token using Google Identity Services (GIS) Token Client
export function requestGisToken(clientId: string): Promise<{ user: GoogleAuthUser; accessToken: string }> {
  return requestGisTokenDirect();
}

function notifyAuthSuccess(user: AuthUser, token: string) {
  cachedUser = user;
  cachedAccessToken = token;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    }
  } catch (e) {}

  for (const listener of authListeners) {
    listener.onSuccess?.(user, token);
  }
}

function notifyAuthFailure() {
  cachedUser = null;
  cachedAccessToken = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  } catch (e) {}

  for (const listener of authListeners) {
    listener.onFailure?.();
  }
}

export const initAuth = (
  onAuthSuccess?: (user: AuthUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  const listener = { onSuccess: onAuthSuccess, onFailure: onAuthFailure };
  authListeners.push(listener);

  // If already authenticated in this session or localStorage, trigger immediately
  if (cachedUser && cachedAccessToken) {
    onAuthSuccess?.(cachedUser, cachedAccessToken);
  }

  // Check redirect result for mobile devices (iOS / Android)
  getRedirectResult(auth)
    .then(async (result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;
        if (token) {
          notifyAuthSuccess(result.user, token);
        } else if (result.user) {
          // If token wasn't in credential, try fetching with cached or GIS
          const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
          if (savedToken) {
            notifyAuthSuccess(result.user, savedToken);
          }
        }
      }
    })
    .catch((err) => {
      console.warn('Firebase getRedirectResult error:', err);
    });

  const unsubscribeFirebase = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
    if (fbUser) {
      if (cachedAccessToken) {
        cachedUser = fbUser;
        onAuthSuccess?.(fbUser, cachedAccessToken);
      }
    }
  });

  return () => {
    const idx = authListeners.indexOf(listener);
    if (idx !== -1) authListeners.splice(idx, 1);
    unsubscribeFirebase();
  };
};

export const setManualAccessToken = async (token: string, email = 'user@google.com'): Promise<{ user: AuthUser; accessToken: string }> => {
  const user = await fetchGoogleUserProfile(token);
  if (!user.email || user.email === 'connected-account@google.com') {
    user.email = email;
    user.displayName = email.split('@')[0];
  }
  notifyAuthSuccess(user, token);
  return { user, accessToken: token };
};

/**
 * Mobile-friendly Google Sign-In with Redirect mode for iOS & Android
 */
export const googleSignInRedirect = async (): Promise<void> => {
  isSigningIn = true;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('gym_active_tab', 'sheets');
      localStorage.setItem('gym_pending_google_redirect', 'true');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('gym_active_tab', 'sheets');
    }
    await signInWithRedirect(auth, firebaseProvider);
  } catch (err: any) {
    console.error('Firebase signInWithRedirect failed:', err);
    throw err;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Standard Google Sign-In with robust fallbacks for Desktop, iPad, iOS and Android
 */
export const googleSignIn = async (): Promise<{ user: AuthUser; accessToken: string } | null> => {
  if (isSigningIn) {
    isSigningIn = false; // Reset if stuck
  }
  isSigningIn = true;

  try {
    // 1. On iPad / iOS / Safari or when GIS client is available, use direct GIS token client first
    // This completely prevents Safari ITP cross-origin cookie / popup-closed-by-user crashes
    const google = typeof window !== 'undefined' ? (window as any).google : null;
    const isAppleOrMobile = isIOS() || isMobileDevice();

    if (isAppleOrMobile || google?.accounts?.oauth2) {
      try {
        console.log('Initiating direct GIS Google authorization...');
        const gisResult = await requestGisTokenDirect();
        if (gisResult?.accessToken) {
          notifyAuthSuccess(gisResult.user, gisResult.accessToken);
          return gisResult;
        }
      } catch (gisErr: any) {
        console.warn('Direct GIS sign-in notice:', gisErr);
        // If user cancelled, rethrow
        if (gisErr?.message?.includes('closed') || gisErr?.message?.includes('blocked')) {
          // If on mobile/iPad, inform clearly
          if (isAppleOrMobile) {
            throw new Error(gisErr.message || 'Google authorization window was closed. On iPad/iPhone, you can also use Option 2: Direct Sheet Link to sync without login.');
          }
        }
      }
    }

    // 2. Secondary attempt: Firebase signInWithPopup (for desktop Chrome/Firefox/Edge)
    try {
      const result = await signInWithPopup(auth, firebaseProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Google signed in, but access token for Sheets/Drive was not returned. Please ensure spreadsheet permissions are granted.');
      }

      const token = credential.accessToken;
      notifyAuthSuccess(result.user, token);
      return { user: result.user, accessToken: token };
    } catch (fbErr: any) {
      const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'your domain';
      const errorCode = fbErr?.code || '';
      const errorMsg = fbErr?.message || '';

      console.warn('Firebase signInWithPopup returned:', errorCode, errorMsg);

      // Try GIS if Firebase popup failed
      try {
        const gisResult = await requestGisTokenDirect();
        notifyAuthSuccess(gisResult.user, gisResult.accessToken);
        return gisResult;
      } catch (gisFallbackErr: any) {
        console.warn('GIS final fallback error:', gisFallbackErr);
      }

      if (errorCode === 'auth/popup-blocked') {
        throw new Error('Popup was blocked by your browser. On iPhone/iPad, go to Settings -> Safari -> turn off "Block Pop-ups", or use Option 2: Direct Sheet Link below.');
      }

      if (errorCode === 'auth/unauthorized-domain') {
        const customErr = new Error(
          `Domain "${currentHostname}" is not in Firebase authorized domains. You can connect your Google Sheet directly using Option 2: Direct Sheet Link without requiring Google login.`
        );
        (customErr as any).code = 'auth/unauthorized-domain';
        (customErr as any).hostname = currentHostname;
        throw customErr;
      }

      throw fbErr;
    }
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY_TOKEN);
  }
  return null;
};

export const getCurrentAuthUser = (): AuthUser | null => {
  return cachedUser;
};

export const googleSignOut = async (): Promise<void> => {
  try {
    if (cachedAccessToken && (window as any).google?.accounts?.oauth2?.revoke) {
      (window as any).google.accounts.oauth2.revoke(cachedAccessToken, () => {
        console.log('Revoked Google access token');
      });
    }
  } catch (e) {
    // Ignore revoke errors
  }

  try {
    await firebaseSignOut(auth);
  } catch (e) {
    // Ignore signOut errors
  }

  notifyAuthFailure();
};


