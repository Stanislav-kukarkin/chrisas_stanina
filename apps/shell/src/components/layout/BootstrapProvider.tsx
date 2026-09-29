import { type ReactNode } from 'react';
import { useAuth } from '@chrisasstanina/auth';
import { BootstrapProvider as FirebaseBootstrapProvider } from '@chrisasstanina/firebase';

export function BootstrapProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return (
    <FirebaseBootstrapProvider uid={user?.uid} email={user?.email ?? undefined}>
      {children}
    </FirebaseBootstrapProvider>
  );
}
