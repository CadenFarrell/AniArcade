// The Firebase config, apart from the SDK. firebase.js imports the SDK at its
// top level, so anything that imports it statically pulls Firebase into its
// chunk — fine for a game's online half, which only a game loads, but the hub
// has to know whether backup codes exist (services/cloudSave.js) before any game
// is open, and Firebase must stay out of its startup bundle (src/hub/CLAUDE.md,
// "Games load on demand"). This file is what the hub can afford to import.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Online mode is only available when the app has been configured with a real
// (or emulator) Firebase project. With no .env.local, this stays false and
// nothing ever touches the network — local pass-and-play mode has zero
// Firebase dependency.
export const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL);
