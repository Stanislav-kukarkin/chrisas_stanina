import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, type Auth, type User } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getMissingFirebaseEnvKeys, isFirebaseConfigured, type FirebaseConfig } from './config';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let firestore: Firestore | undefined;
let functions: Functions | undefined;

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  functions: Functions;
}

function syncFromExistingApp(): boolean {
  if (getApps().length === 0) {
    return false;
  }

  app = getApps()[0];
  auth = getAuth(app);
  firestore = getFirestore(app);
  functions = getFunctions(app, 'europe-west1');
  return true;
}

export function isFirebaseReady(): boolean {
  if (app !== undefined && auth !== undefined && firestore !== undefined && functions !== undefined) {
    return true;
  }
  return syncFromExistingApp();
}

export function initializeFirebase(config: FirebaseConfig): FirebaseServices | null {
  if (!isFirebaseConfigured(config)) {
    console.warn(
      `[firebase] Missing env vars: ${getMissingFirebaseEnvKeys(config).join(', ')}. ` +
        'UI will work, but auth and Firestore are disabled until .env is configured.',
    );
    return null;
  }

  if (!app) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(config);
  }

  if (!auth) {
    auth = getAuth(app);
  }

  if (!firestore) {
    firestore = getFirestore(app);
  }

  if (!functions) {
    functions = getFunctions(app, 'europe-west1');
  }

  return { app, auth, firestore, functions };
}

export function getFirebaseAuth(): Auth {
  if (!auth && !syncFromExistingApp()) {
    throw new Error('Firebase not initialized. Call initializeFirebase first.');
  }
  return auth!;
}

export function subscribeToFirebaseAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export function getFirebaseFirestore(): Firestore {
  if (!firestore && !syncFromExistingApp()) {
    throw new Error('Firebase not initialized. Call initializeFirebase first.');
  }
  return firestore!;
}

export function getFirebaseFunctions(): Functions {
  if (!functions && !syncFromExistingApp()) {
    throw new Error('Firebase not initialized. Call initializeFirebase first.');
  }
  return functions!;
}
