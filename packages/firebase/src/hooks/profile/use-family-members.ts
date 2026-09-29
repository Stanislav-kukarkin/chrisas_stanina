import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { getDefaultFamilyId } from '../../config';
import { getFirebaseFirestore } from '../../init';
import { fetchUserProfile } from './use-user-profile';
import { familyMembersCollectionPath } from '../../paths';
import { queryKeys } from '../../query-keys';
import { type FamilyMember, type UserProfile } from '../../types/profile';
import { mapTimestamp } from '../../utils/firestore-mapper';

export interface FamilyMemberWithProfile extends FamilyMember {
  profile: UserProfile | null;
}

function mapFamilyMember(id: string, data: Record<string, unknown>): FamilyMember {
  return {
    id,
    uid: String(data.uid ?? id),
    email: String(data.email ?? ''),
    role: data.role === 'admin' ? 'admin' : 'member',
    joinedAt: mapTimestamp(data.joinedAt),
  };
}

export function useFamilyMembers(familyId: string = getDefaultFamilyId()) {
  return useQuery({
    queryKey: queryKeys.familyMembers(familyId),
    queryFn: async (): Promise<FamilyMemberWithProfile[]> => {
      const firestore = getFirebaseFirestore();
      const snapshot = await getDocs(collection(firestore, familyMembersCollectionPath(familyId)));

      const members = snapshot.docs.map((memberDoc) =>
        mapFamilyMember(memberDoc.id, memberDoc.data()),
      );

      const withProfiles = await Promise.all(
        members.map(async (member) => ({
          ...member,
          profile: await fetchUserProfile(member.uid),
        })),
      );

      return withProfiles.sort((a, b) =>
        (a.profile?.displayName ?? a.email).localeCompare(b.profile?.displayName ?? b.email, 'ru'),
      );
    },
  });
}
