import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDefaultFamilyId } from '../../config';
import { getFirebaseFirestore } from '../../init';
import { salarySettingsPath } from '../../paths';
import { queryKeys } from '../../query-keys';
import {
  type SalarySettings,
  type SalarySettingsInput,
  type SalarySettingsUpdate,
} from '../../types/salary';
import { mapSalarySettings, salarySettingsToFirestore } from './salary-mappers';

async function fetchSalarySettings(
  familyId: string,
  uid: string,
): Promise<SalarySettings | null> {
  const firestore = getFirebaseFirestore();
  const snapshot = await getDoc(doc(firestore, salarySettingsPath(familyId, uid)));
  if (!snapshot.exists()) {
    return null;
  }
  return mapSalarySettings(snapshot.data());
}

export function useSalarySettings(
  uid: string | undefined,
  familyId: string | null = getDefaultFamilyId(),
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.salarySettings(familyId ?? 'unresolved', uid ?? 'anonymous'),
    queryFn: async () => {
      if (!uid || !familyId) {
        throw new Error('User and family workspace are required');
      }
      return fetchSalarySettings(familyId, uid);
    },
    enabled: Boolean(uid && familyId && enabled),
  });
}

export function useUpdateSalarySettings(
  uid: string | undefined,
  familyId: string | null = getDefaultFamilyId(),
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (update: SalarySettingsUpdate | SalarySettingsInput) => {
      if (!uid || !familyId) {
        throw new Error('User and family workspace are required');
      }

      const current = (await fetchSalarySettings(familyId, uid)) ?? mapSalarySettings(undefined);
      const next: SalarySettings = {
        ...current,
        ...update,
        source: update.source ?? current.source ?? 'personal',
      };

      const firestore = getFirebaseFirestore();
      await setDoc(doc(firestore, salarySettingsPath(familyId, uid)), salarySettingsToFirestore(next), {
        merge: true,
      });

      return next;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.salarySettings(familyId ?? 'unresolved', uid ?? 'anonymous'), data);
    },
  });
}
