import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from './init';
import { userProfilePath } from './paths';
import { isProfileComplete, randomProfileColor } from './types/profile';

export async function ensureUserBootstrap(uid: string, email: string): Promise<void> {
  const firestore = getFirebaseFirestore();
  const profileRef = doc(firestore, userProfilePath(uid));

  const profileSnap = await getDoc(profileRef);
  if (!profileSnap.exists()) {
    await setDoc(profileRef, {
      displayName: '',
      emoji: '',
      color: randomProfileColor(),
      email,
      profileComplete: false,
      updatedAt: serverTimestamp(),
    });
  }
}

export function computeProfileComplete(fields: {
  displayName?: string;
  emoji?: string;
}): boolean {
  return isProfileComplete({
    displayName: fields.displayName ?? '',
    emoji: fields.emoji ?? '',
  });
}
