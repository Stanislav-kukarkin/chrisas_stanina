import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDefaultFamilyId } from './config';
import { getFirebaseFirestore } from './init';
import { familyMemberPath, userProfilePath } from './paths';
import { isProfileComplete, randomProfileColor } from './types/profile';

export async function ensureUserBootstrap(uid: string, email: string): Promise<void> {
  const firestore = getFirebaseFirestore();
  const familyId = getDefaultFamilyId();
  const profileRef = doc(firestore, userProfilePath(uid));
  const memberRef = doc(firestore, familyMemberPath(familyId, uid));

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

  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) {
    await setDoc(memberRef, {
      uid,
      email,
      role: 'member',
      joinedAt: serverTimestamp(),
    });
  } else if (email && memberSnap.data()?.email !== email) {
    await setDoc(memberRef, { email }, { merge: true });
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
