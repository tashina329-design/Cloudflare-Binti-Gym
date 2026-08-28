import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

// Support static configuration from firebase-applet-config.json with optional Vite/Cloudflare environment variable overrides
const env = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : ({} as any);

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || (appletConfig as any).apiKey || 'AIzaSyBZSZqX6mDucE2pAeSATjxoPF3Lrw1K0iE',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || (appletConfig as any).authDomain || 'gen-lang-client-0329117938.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || (appletConfig as any).projectId || 'gen-lang-client-0329117938',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || (appletConfig as any).storageBucket || 'gen-lang-client-0329117938.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || (appletConfig as any).messagingSenderId || '368231596957',
  appId: env.VITE_FIREBASE_APP_ID || (appletConfig as any).appId || '1:368231596957:web:22393ebc9b7ffb85a1e574',
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || (appletConfig as any).firestoreDatabaseId || 'ai-studio-remixcloudflares-0b3e9627-65e1-490b-aea7-629c0a1cae75',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const rawDbId = firebaseConfig.firestoreDatabaseId;
const databaseId = rawDbId && rawDbId !== '(default)' && rawDbId !== 'default' ? rawDbId : undefined;

export const db: Firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
export const auth = getAuth(app);

let authInitPromise: Promise<User | null> | null = null;

export async function ensureFirebaseAuth(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  if (authInitPromise) return authInitPromise;

  authInitPromise = new Promise<User | null>((resolve) => {
    let settled = false;
    const unsub = onAuthStateChanged(
      auth,
      async (user) => {
        if (user) {
          if (!settled) {
            settled = true;
            unsub();
            resolve(user);
          }
        } else {
          try {
            const cred = await signInAnonymously(auth);
            if (!settled) {
              settled = true;
              unsub();
              resolve(cred.user);
            }
          } catch (err: any) {
            console.warn('Firebase anonymous auth status:', err?.message || err);
            if (!settled) {
              settled = true;
              unsub();
              authInitPromise = null;
              resolve(null);
            }
          }
        }
      },
      (error) => {
        console.warn('Firebase auth listener error:', error);
        if (!settled) {
          settled = true;
          unsub();
          authInitPromise = null;
          resolve(null);
        }
      }
    );
  });

  return authInitPromise;
}

// Automatically ensure authenticated session on app initialization
ensureFirebaseAuth().catch((err) => {
  console.warn('Firebase auth initialization warning:', err);
});






