import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { getDefaultFamilyId } from '../config';
import { getFirebaseFirestore } from '../init';
import { type FamilyAppName, familyAppCollectionPath } from '../paths';
import { queryKeys } from '../query-keys';

export function useFamilyCollection<T extends { id: string }>(
  appName: FamilyAppName,
  familyId: string = getDefaultFamilyId(),
) {
  return useQuery({
    queryKey: queryKeys.familyAppCollection(familyId, appName),
    queryFn: async (): Promise<T[]> => {
      const firestore = getFirebaseFirestore();
      const snapshot = await getDocs(
        collection(firestore, familyAppCollectionPath(familyId, appName)),
      );

      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as T);
    },
  });
}
