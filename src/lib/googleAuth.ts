import {
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from './firebase';


const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If logged in but token was lost (e.g., page refresh), user can click Sign In to refresh token
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve Google Access Token. Please ensure permissions are granted in Google prompt.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);

    const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'your domain';
    const errorCode = error?.code || '';
    const errorMsg = error?.message || '';

    if (
      errorCode === 'auth/unauthorized-domain' ||
      errorMsg.toLowerCase().includes('unauthorized domain') ||
      errorMsg.toLowerCase().includes('requested action is invalid')
    ) {
      const customErr = new Error(
        `Domain "${currentHostname}" is not authorized in Firebase Authentication. Please add "${currentHostname}" to Firebase Console -> Authentication -> Settings -> Authorized domains.`
      );
      (customErr as any).code = 'auth/unauthorized-domain';
      (customErr as any).hostname = currentHostname;
      throw customErr;
    }

    if (errorCode === 'auth/popup-blocked') {
      const customErr = new Error('The Google login popup was blocked by your browser. Please allow popups for this site and try again.');
      (customErr as any).code = errorCode;
      throw customErr;
    }

    if (errorCode === 'auth/popup-closed-by-user') {
      const customErr = new Error('Sign-in popup was closed before completing authentication. Please try again.');
      (customErr as any).code = errorCode;
      throw customErr;
    }

    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const googleSignOut = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};
