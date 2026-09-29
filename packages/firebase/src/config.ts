export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export function getFirebaseConfigFromEnv(): FirebaseConfig {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  };
}

export function isFirebaseConfigured(config: FirebaseConfig = getFirebaseConfigFromEnv()): boolean {
  return Object.values(config).every(Boolean);
}

export function getMissingFirebaseEnvKeys(
  config: FirebaseConfig = getFirebaseConfigFromEnv(),
): string[] {
  return Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

export function getDefaultFamilyId(): string {
  return import.meta.env.VITE_DEFAULT_FAMILY_ID ?? 'main';
}
