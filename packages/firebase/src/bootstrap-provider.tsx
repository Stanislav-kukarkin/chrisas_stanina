import { type ReactNode } from 'react';
import { useUserBootstrap } from './hooks/profile/use-user-bootstrap';
import { isFirebaseReady } from './init';

interface BootstrapProviderProps {
  children: ReactNode;
  uid?: string;
  email?: string;
}

export function BootstrapProvider({ children, uid, email }: BootstrapProviderProps) {
  useUserBootstrap(uid && isFirebaseReady() ? uid : undefined, email);

  return children;
}
