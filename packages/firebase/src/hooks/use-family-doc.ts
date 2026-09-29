import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { getDefaultFamilyId } from '../config';
import { getFirebaseFirestore } from '../init';
import { type FamilyAppName, familyAppDocPath } from '../paths';
import { queryKeys } from '../query-keys';

export function useFamilyDoc<T>(
  appName: FamilyAppName,
  docId: string,
  familyId: string = getDefaultFamilyId(),
) {
  return useQuery({
    queryKey: queryKeys.familyAppDoc(familyId, appName, docId),
    queryFn: async (): Promise<T | null> => {
      const firestore = getFirebaseFirestore();
      const snapshot = await getDoc(
        doc(firestore, familyAppDocPath(familyId, appName, docId)),
      );

      if (!snapshot.exists()) {
        return null;
      }

      return { id: snapshot.id, ...snapshot.data() } as T;
    },
    enabled: Boolean(docId),
  });
}
