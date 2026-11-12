import { useQuery } from '@tanstack/react-query';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { getDefaultFamilyId } from '../../config';
import { getFirebaseFirestore } from '../../init';
import { fetchUserProfile } from './use-user-profile';
import { familyMembersCollectionPath } from '../../paths';
import { queryKeys } from '../../query-keys';
import { type FamilyMember, type UserProfile } from '../../types/profile';
import { mapTimestamp } from '../../utils/firestore-mapper';
import { familyAccessPath, type WorkspaceAppName } from '../../app-workspaces';

export interface FamilyMemberWithProfile extends FamilyMember {
  profile: UserProfile | null;
}

function mapFamilyMember(id: string, data: Record<string, unknown>): FamilyMember {
  return {
    id,
    uid: String(data.uid ?? id),
    email: String(data.email ?? ''),
    role: data.role === 'admin' ? 'admin' : 'member',
    source: data.source === 'legacy' || data.source === 'invitation' || data.source === 'personal'
      ? data.source
      : undefined,
    accessVersion: typeof data.accessVersion === 'number' ? data.accessVersion : undefined,
    joinedAt: mapTimestamp(data.joinedAt),
  };
}

export function useFamilyMembers(
  familyId: string = getDefaultFamilyId(),
  enabled = true,
  appName?: WorkspaceAppName,
) {
  return useQuery({
    queryKey: [...queryKeys.familyMembers(familyId), appName ?? 'all'],
    queryFn: async (): Promise<FamilyMemberWithProfile[]> => {
      const firestore = getFirebaseFirestore();
      const snapshot = await getDocs(collection(firestore, familyMembersCollectionPath(familyId)));

      let members = snapshot.docs.map((memberDoc) =>
        mapFamilyMember(memberDoc.id, memberDoc.data()),
      );

      if (appName) {
        const access = await Promise.all(members.map((member) =>
          getDoc(doc(firestore, familyAccessPath(familyId, appName, member.uid))),
        ));
        members = members.filter((member, index) => {
          const role = access[index]?.data()?.role;
          return role === 'view' || role === 'edit' || member.accessVersion === undefined;
        });
      }

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
    enabled,
  });
}
