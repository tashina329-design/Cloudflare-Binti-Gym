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
function ensureGisLoaded(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadedPromise) return gisLoadedPromise;

  gisLoadedPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById('google-identity-services-script');
    if (existingScript) {
      if ((window as any).google?.accounts?.oauth2) {
        resolve();
      } else {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')));
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-identity-services-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });

  return gisLoadedPromise;
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

// Request Token using Google Identity Services (GIS) Token Client
export function requestGisToken(clientId: string): Promise<{ user: GoogleAuthUser; accessToken: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureGisLoaded();
      const google = (window as any).google;
      if (!google?.accounts?.oauth2) {
        throw new Error('Google Identity Services client library is not available');
      }

      let completed = false;

      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: async (tokenResponse: any) => {
          if (completed) return;
          completed = true;

          if (tokenResponse.error) {
            console.error('GIS token error:', tokenResponse);
            reject(new Error(tokenResponse.error_description || tokenResponse.error || 'Google sign-in authorization failed.'));
            return;
          }

          if (!tokenResponse.access_token) {
            reject(new Error('No access token returned from Google.'));
            return;
          }

          const accessToken = tokenResponse.access_token;
          const user = await fetchGoogleUserProfile(accessToken);
          resolve({ user, accessToken });
        },
        error_callback: (err: any) => {
          if (completed) return;
          completed = true;
          console.error('GIS Error Callback:', err);
          reject(new Error(err.message || 'Google Sign-In popup was closed or blocked. On mobile, try disabling popup blockers in Safari/Chrome settings.'));
        },
      });

      tokenClient.requestAccessToken({ prompt: '' });
    } catch (err) {
      reject(err);
    }
  });
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
 * Standard Google Sign-In with robust fallbacks for Desktop and Mobile
 */
export const googleSignIn = async (): Promise<{ user: AuthUser; accessToken: string } | null> => {
  if (isSigningIn) {
    isSigningIn = false; // Reset if stuck
  }
  isSigningIn = true;

  try {
    // 1. First attempt: Firebase signInWithPopup
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

      // On mobile (iOS / Android) or unauthorized domain, try GIS token client immediately
      if (
        errorCode === 'auth/popup-blocked' ||
        errorCode === 'auth/popup-closed-by-user' ||
        errorCode === 'auth/cancelled-popup-request' ||
        errorCode === 'auth/unauthorized-domain' ||
        errorMsg.toLowerCase().includes('unauthorized domain') ||
        errorMsg.toLowerCase().includes('requested action is invalid') ||
        isMobileDevice()
      ) {
        if (OAUTH_CLIENT_ID) {
          try {
            console.log('Attempting GIS Token Client fallback...');
            const gisResult = await requestGisToken(OAUTH_CLIENT_ID);
            notifyAuthSuccess(gisResult.user, gisResult.accessToken);
            return gisResult;
          } catch (gisErr: any) {
            console.warn('GIS Token client fallback failed:', gisErr);
          }
        }

        if (errorCode === 'auth/popup-blocked') {
          throw new Error('Popup was blocked by your browser. On iPhone/iPad, go to Settings -> Safari -> turn off "Block Pop-ups", or use the Direct Sheet Link / Redirect option.');
        }

        if (errorCode === 'auth/unauthorized-domain') {
          const customErr = new Error(
            `Domain "${currentHostname}" is not in Firebase authorized domains. You can connect your Google Sheet directly using the "Paste Sheet Link / ID" method below without requiring Google login.`
          );
          (customErr as any).code = 'auth/unauthorized-domain';
          (customErr as any).hostname = currentHostname;
          throw customErr;
        }
      }

      // Try GIS if Firebase had other errors
      if (OAUTH_CLIENT_ID) {
        try {
          const gisResult = await requestGisToken(OAUTH_CLIENT_ID);
          notifyAuthSuccess(gisResult.user, gisResult.accessToken);
          return gisResult;
        } catch (gisErr: any) {
          console.warn('GIS attempt failed:', gisErr);
        }
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


