import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from '../../init';
import { shoppingListPath, shoppingListsCollectionPath } from '../../paths';
import { queryKeys } from '../../query-keys';
import { type ShoppingList } from '../../types/shopping';
import { mapShoppingList } from './shopping-mappers';

const MAIN_LIST: ShoppingList = { id: 'main', name: 'Основной', createdBy: '' };

export function useShoppingLists(familyId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.shoppingLists(familyId),
    enabled: enabled && Boolean(familyId),
    queryFn: async () => {
      const snapshot = await getDocs(collection(getFirebaseFirestore(), shoppingListsCollectionPath(familyId)));
      const lists = snapshot.docs.map((item) => mapShoppingList(item.id, item.data()));
      const withoutMain = lists.filter((item) => item.id !== 'main');
      return [lists.find((item) => item.id === 'main') ?? MAIN_LIST, ...withoutMain]
        .sort((left, right) => left.id === 'main' ? -1 : right.id === 'main' ? 1 : left.name.localeCompare(right.name, 'ru'));
    },
  });
}

export function useEnsureMainShoppingList(familyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (createdBy: string) => {
      await setDoc(doc(getFirebaseFirestore(), shoppingListPath(familyId, 'main')), {
        name: 'Основной',
        createdBy,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shoppingLists(familyId) }),
  });
}

export function useCreateShoppingList(familyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, createdBy }: { name: string; createdBy: string }) => {
      const reference = doc(collection(getFirebaseFirestore(), shoppingListsCollectionPath(familyId)));
      await setDoc(reference, {
        name: name.trim(), createdBy, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      return reference.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.shoppingLists(familyId) }),
  });
}
