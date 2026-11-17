import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '../../init';
import { recipePath, recipesCollectionPath } from '../../paths';
import { queryKeys } from '../../query-keys';
import { type Recipe, type RecipeIngredient, type RecipeInput, type RecipeUpdate } from '../../types/recipes';
import { mapTimestamp } from '../../utils/firestore-mapper';

function mapIngredient(value: unknown, index: number): RecipeIngredient {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    id: typeof data.id === 'string' && data.id ? data.id : `ingredient-${index}`,
    name: String(data.name ?? ''),
    quantity: typeof data.quantity === 'number' && Number.isFinite(data.quantity) ? data.quantity : null,
    unit: typeof data.unit === 'string' ? data.unit : 'шт',
    note: typeof data.note === 'string' && data.note ? data.note : undefined,
  };
}

function mapRecipe(id: string, data: Record<string, unknown>): Recipe {
  return {
    id,
    title: String(data.title ?? ''),
    description: typeof data.description === 'string' && data.description ? data.description : undefined,
    servings: typeof data.servings === 'number' ? data.servings : null,
    prepMinutes: typeof data.prepMinutes === 'number' ? data.prepMinutes : null,
    cookMinutes: typeof data.cookMinutes === 'number' ? data.cookMinutes : null,
    ingredients: Array.isArray(data.ingredients) ? data.ingredients.map(mapIngredient) : [],
    steps: Array.isArray(data.steps) ? data.steps.filter((step): step is string => typeof step === 'string') : [],
    sourceUrl: typeof data.sourceUrl === 'string' && data.sourceUrl ? data.sourceUrl : undefined,
    favorite: data.favorite === true,
    authorId: String(data.authorId ?? ''),
    createdAt: mapTimestamp(data.createdAt),
    updatedAt: mapTimestamp(data.updatedAt),
  };
}

function recipeDocument(input: RecipeInput) {
  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    servings: input.servings,
    prepMinutes: input.prepMinutes,
    cookMinutes: input.cookMinutes,
    ingredients: input.ingredients.map((item) => ({
      id: item.id,
      name: item.name.trim(),
      quantity: item.quantity,
      unit: item.unit.trim() || 'шт',
      note: item.note?.trim() || null,
    })),
    steps: input.steps.map((step) => step.trim()).filter(Boolean),
    sourceUrl: input.sourceUrl?.trim() || null,
    favorite: input.favorite,
  };
}

export function useRecipes(familyId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.recipes(familyId),
    enabled: enabled && Boolean(familyId),
    queryFn: async () => {
      const snapshot = await getDocs(query(
        collection(getFirebaseFirestore(), recipesCollectionPath(familyId)),
        orderBy('updatedAt', 'desc'),
      ));
      return snapshot.docs.map((item) => mapRecipe(item.id, item.data()));
    },
  });
}

export function useCreateRecipe(familyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, authorId }: { input: RecipeInput; authorId: string }) => {
      const reference = await addDoc(collection(getFirebaseFirestore(), recipesCollectionPath(familyId)), {
        ...recipeDocument(input),
        authorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return reference.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.recipes(familyId) }),
  });
}

export function useUpdateRecipe(familyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ recipeId, update }: { recipeId: string; update: RecipeUpdate }) => {
      const normalized: Record<string, unknown> = {};
      if ('title' in update) normalized.title = update.title?.trim() ?? '';
      if ('description' in update) normalized.description = update.description?.trim() || null;
      if ('servings' in update) normalized.servings = update.servings ?? null;
      if ('prepMinutes' in update) normalized.prepMinutes = update.prepMinutes ?? null;
      if ('cookMinutes' in update) normalized.cookMinutes = update.cookMinutes ?? null;
      if ('ingredients' in update) normalized.ingredients = update.ingredients?.map((item) => ({
        id: item.id, name: item.name.trim(), quantity: item.quantity,
        unit: item.unit.trim() || 'шт', note: item.note?.trim() || null,
      })) ?? [];
      if ('steps' in update) normalized.steps = update.steps?.map((step) => step.trim()).filter(Boolean) ?? [];
      if ('sourceUrl' in update) normalized.sourceUrl = update.sourceUrl?.trim() || null;
      if ('favorite' in update) normalized.favorite = update.favorite === true;
      await updateDoc(doc(getFirebaseFirestore(), recipePath(familyId, recipeId)), {
        ...normalized,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.recipes(familyId) }),
  });
}

export function useDeleteRecipe(familyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipeId: string) => deleteDoc(doc(getFirebaseFirestore(), recipePath(familyId, recipeId))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.recipes(familyId) }),
  });
}
