import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { firebaseConfig as config, firebaseEnabled } from './firebaseConfig';

// Re-exported so every existing `firebaseEnabled` import keeps working — and
// so a test's mock of this module still decides it for the game screens. The
// value lives in firebaseConfig.js, which the hub can import without the SDK.
export { firebaseEnabled };

let app = null;
let auth = null;
let db = null;

function ensureInitialized() {
  if (!firebaseEnabled) {
    throw new Error('Firebase is not configured (missing VITE_FIREBASE_* env vars).');
  }
  if (app) return;

  app = initializeApp(config);
  auth = getAuth(app);
  db = getDatabase(app);

  if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectDatabaseEmulator(db, '127.0.0.1', 9000);
  }
}

export function getFirebaseAuth() {
  ensureInitialized();
  return auth;
}

export function getFirebaseDb() {
  ensureInitialized();
  return db;
}

// Signs this device in anonymously (idempotent — Firebase persists the
// anonymous uid across reloads via IndexedDB) and resolves with the uid.
export function ensureSignedIn() {
  const authInstance = getFirebaseAuth();
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      unsubscribe();
      if (user) {
        resolve(user.uid);
      } else {
        signInAnonymously(authInstance)
          .then((cred) => resolve(cred.user.uid))
          .catch(reject);
      }
    }, reject);
  });
}
