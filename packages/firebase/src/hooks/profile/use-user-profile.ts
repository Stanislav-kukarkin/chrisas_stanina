import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from '../../init';
import { userProfilePath } from '../../paths';
import { queryKeys } from '../../query-keys';
import { type UserProfile } from '../../types/profile';
import { mapTimestamp } from '../../utils/firestore-mapper';

function mapUserProfile(id: string, data: Record<string, unknown>): UserProfile {
  return {
    id,
    displayName: String(data.displayName ?? ''),
    emoji: String(data.emoji ?? ''),
    color: String(data.color ?? '#8b5cf6'),
    email: String(data.email ?? ''),
    profileComplete: Boolean(data.profileComplete),
    updatedAt: mapTimestamp(data.updatedAt),
  };
}

export function useUserProfile(uid: string | undefined) {
  return useQuery({
    queryKey: queryKeys.userProfile(uid ?? 'none'),
    queryFn: async (): Promise<UserProfile | null> => {
      if (!uid) {
        return null;
      }

      const firestore = getFirebaseFirestore();
      const snapshot = await getDoc(doc(firestore, userProfilePath(uid)));

      if (!snapshot.exists()) {
        return null;
      }

      return mapUserProfile(snapshot.id, snapshot.data());
    },
    enabled: Boolean(uid),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const firestore = getFirebaseFirestore();
  const snapshot = await getDoc(doc(firestore, userProfilePath(uid)));

  if (!snapshot.exists()) {
    return null;
  }

  return mapUserProfile(snapshot.id, snapshot.data());
}

export function useProfileComplete(uid: string | undefined): boolean {
  const { data } = useUserProfile(uid);
  return data?.profileComplete ?? false;
}
