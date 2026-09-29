import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { getDefaultFamilyId } from '../../config';
import { getFirebaseFirestore } from '../../init';
import { shoppingFavoritesCollectionPath } from '../../paths';
import { queryKeys } from '../../query-keys';
import { type ShoppingFavoriteInput } from '../../types/shopping';
import { mapShoppingFavorite } from './shopping-mappers';

export function useShoppingFavorites(familyId: string = getDefaultFamilyId()) {
  return useQuery({
    queryKey: queryKeys.shoppingFavorites(familyId),
    queryFn: async () => {
      const firestore = getFirebaseFirestore();
      const snapshot = await getDocs(
        collection(firestore, shoppingFavoritesCollectionPath(familyId)),
      );

      return snapshot.docs
        .map((favoriteDoc) => mapShoppingFavorite(favoriteDoc.id, favoriteDoc.data()))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    },
  });
}

export function useAddShoppingFavorite(familyId: string = getDefaultFamilyId()) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ShoppingFavoriteInput) => {
      const firestore = getFirebaseFirestore();
      const docRef = await addDoc(
        collection(firestore, shoppingFavoritesCollectionPath(familyId)),
        {
          name: input.name.trim(),
          quantity: input.quantity ?? 1,
          unit: input.unit ?? 'шт',
          category: input.category ?? null,
          store: input.store ?? null,
          createdAt: serverTimestamp(),
        },
      );
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shoppingFavorites(familyId) });
    },
  });
}
