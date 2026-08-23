import {
  signInWithPopup,
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

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedUser: AuthUser | null = null;
const authListeners: Array<{
  onSuccess?: (user: AuthUser, token: string) => void;
  onFailure?: () => void;
}> = [];

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
async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleAuthUser> {
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
function requestGisToken(clientId: string): Promise<{ user: GoogleAuthUser; accessToken: string }> {
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
          reject(new Error(err.message || 'Google Sign-In popup was closed or blocked.'));
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
  for (const listener of authListeners) {
    listener.onSuccess?.(user, token);
  }
}

function notifyAuthFailure() {
  cachedUser = null;
  cachedAccessToken = null;
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

  // If already authenticated in this session, trigger immediately
  if (cachedUser && cachedAccessToken) {
    onAuthSuccess?.(cachedUser, cachedAccessToken);
  }

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

export const googleSignIn = async (): Promise<{ user: AuthUser; accessToken: string } | null> => {
  if (isSigningIn) return null;
  isSigningIn = true;

  try {
    // Primary approach: Use Google Identity Services (GIS) token client with Client ID
    // This runs completely client-side and avoids Firebase Auth's unauthorized-domain error
    if (OAUTH_CLIENT_ID) {
      try {
        const gisResult = await requestGisToken(OAUTH_CLIENT_ID);
        notifyAuthSuccess(gisResult.user, gisResult.accessToken);
        return gisResult;
      } catch (gisErr: any) {
        console.warn('GIS Token client attempt note:', gisErr?.message || gisErr);
        // If user cancelled, throw clearly
        if (gisErr?.message?.toLowerCase().includes('popup_closed') || gisErr?.message?.toLowerCase().includes('closed')) {
          throw new Error('Sign-in popup was closed before completing authorization.');
        }
        // If GIS failed due to other issues, continue to Firebase Auth fallback below
      }
    }

    // Secondary fallback: Firebase signInWithPopup
    try {
      const result = await signInWithPopup(auth, firebaseProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Failed to retrieve Google Access Token from Firebase Auth.');
      }

      const token = credential.accessToken;
      notifyAuthSuccess(result.user, token);
      return { user: result.user, accessToken: token };
    } catch (fbErr: any) {
      const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'your domain';
      const errorCode = fbErr?.code || '';
      const errorMsg = fbErr?.message || '';

      if (
        errorCode === 'auth/unauthorized-domain' ||
        errorMsg.toLowerCase().includes('unauthorized domain') ||
        errorMsg.toLowerCase().includes('requested action is invalid')
      ) {
        // If Firebase threw unauthorized domain and GIS had not succeeded, retry GIS explicitly
        if (OAUTH_CLIENT_ID) {
          const retryGis = await requestGisToken(OAUTH_CLIENT_ID);
          notifyAuthSuccess(retryGis.user, retryGis.accessToken);
          return retryGis;
        }

        const customErr = new Error(
          `Domain "${currentHostname}" is not authorized in Firebase Authentication. Please add "${currentHostname}" to Firebase Console -> Authentication -> Settings -> Authorized domains.`
        );
        (customErr as any).code = 'auth/unauthorized-domain';
        (customErr as any).hostname = currentHostname;
        throw customErr;
      }

      if (errorCode === 'auth/popup-blocked') {
        throw new Error('The Google login popup was blocked by your browser. Please allow popups for this site and try again.');
      }

      if (errorCode === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in popup was closed before completing authentication. Please try again.');
      }

      throw fbErr;
    }
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
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

