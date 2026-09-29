import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { getDefaultFamilyId } from '../../config';
import { getFirebaseFirestore } from '../../init';
import { shoppingItemPath, shoppingItemsCollectionPath } from '../../paths';
import { queryKeys } from '../../query-keys';
import {
  type ShoppingItem,
  type ShoppingItemInput,
  type ShoppingItemUpdate,
} from '../../types/shopping';
import { mapShoppingItem } from './shopping-mappers';

function sortItems(items: ShoppingItem[]): ShoppingItem[] {
  return [...items].sort((a, b) => {
    if (a.checked !== b.checked) {
      return a.checked ? 1 : -1;
    }
    if (a.important !== b.important) {
      return a.important ? -1 : 1;
    }
    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;
    return bTime - aTime;
  });
}

export function useShoppingItems(familyId: string = getDefaultFamilyId()) {
  return useQuery({
    queryKey: queryKeys.shoppingItems(familyId),
    queryFn: async (): Promise<ShoppingItem[]> => {
      const firestore = getFirebaseFirestore();
      const snapshot = await getDocs(collection(firestore, shoppingItemsCollectionPath(familyId)));
      const items = snapshot.docs.map((itemDoc) =>
        mapShoppingItem(itemDoc.id, itemDoc.data()),
      );
      return sortItems(items);
    },
  });
}

export function useAddShoppingItem(familyId: string = getDefaultFamilyId()) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      input,
      createdBy,
    }: {
      input: ShoppingItemInput;
      createdBy: string;
    }) => {
      const firestore = getFirebaseFirestore();
      const docRef = await addDoc(collection(firestore, shoppingItemsCollectionPath(familyId)), {
        name: input.name.trim(),
        quantity: input.quantity ?? 1,
        unit: input.unit ?? 'шт',
        category: input.category ?? null,
        note: input.note ?? null,
        assigneeUid: input.assigneeUid ?? null,
        store: input.store ?? null,
        important: input.important ?? false,
        checked: false,
        recipeId: input.recipeId ?? null,
        createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shoppingItems(familyId) });
    },
  });
}

export function useUpdateShoppingItem(familyId: string = getDefaultFamilyId()) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      update,
    }: {
      itemId: string;
      update: ShoppingItemUpdate;
    }) => {
      const firestore = getFirebaseFirestore();
      await updateDoc(doc(firestore, shoppingItemPath(familyId, itemId)), {
        ...update,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shoppingItems(familyId) });
    },
  });
}

export function useToggleShoppingItem(familyId: string = getDefaultFamilyId()) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: string; checked: boolean }) => {
      const firestore = getFirebaseFirestore();
      await updateDoc(doc(firestore, shoppingItemPath(familyId, itemId)), {
        checked,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shoppingItems(familyId) });
    },
  });
}

export function useDeleteShoppingItem(familyId: string = getDefaultFamilyId()) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const firestore = getFirebaseFirestore();
      await deleteDoc(doc(firestore, shoppingItemPath(familyId, itemId)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shoppingItems(familyId) });
    },
  });
}

export function useClearCheckedItems(familyId: string = getDefaultFamilyId()) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (checkedItemIds: string[]) => {
      if (checkedItemIds.length === 0) {
        return;
      }

      const firestore = getFirebaseFirestore();
      const batch = writeBatch(firestore);

      checkedItemIds.forEach((itemId) => {
        batch.delete(doc(firestore, shoppingItemPath(familyId, itemId)));
      });

      await batch.commit();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shoppingItems(familyId) });
    },
  });
}
