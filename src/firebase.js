// src/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL
};

// Only initialize if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
// Use long-polling when WebChannel is blocked (ad-blockers, strict privacy browsers)
// experimentalAutoDetectLongPolling will fallback automatically; you can force via env if needed
let dbInstance;
try {
  const forceLongPolling = String(process.env.REACT_APP_FIRESTORE_FORCE_LONGPOLL || '').toLowerCase() === 'true';
  if (forceLongPolling) {
    dbInstance = initializeFirestore(app, { experimentalForceLongPolling: true, useFetchStreams: false });
  } else {
    dbInstance = initializeFirestore(app, { experimentalAutoDetectLongPolling: true, useFetchStreams: false });
  }
} catch (e) {
  // If Firestore was already initialized elsewhere, fall back to default getter
  dbInstance = getFirestore(app);
}
export const db = dbInstance;
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
