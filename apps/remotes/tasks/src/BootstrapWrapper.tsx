import type { ReactNode } from 'react';
import { useAuth } from '@chrisasstanina/auth';
import { BootstrapProvider } from '@chrisasstanina/firebase';

export function BootstrapWrapper({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <BootstrapProvider uid={user?.uid} email={user?.email ?? undefined}>
      {children}
    </BootstrapProvider>
  );
}

