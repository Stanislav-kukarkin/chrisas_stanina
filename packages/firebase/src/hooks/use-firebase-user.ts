import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '../init';

/** Подписка на Firebase Auth без React Context — работает в Module Federation remotes */
export function useFirebaseUser(): User | null {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    setUser(auth.currentUser);
    return onAuthStateChanged(auth, setUser);
  }, []);

  return user;
}
