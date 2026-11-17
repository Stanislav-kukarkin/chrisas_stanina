import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseAuth, getFirebaseFirestore, getFirebaseFunctions } from './init';
import { shoppingListItemsCollectionPath } from './paths';
import {
  type ShoppingConflictDecision,
  type ShoppingImportConflict,
  type ShoppingImportIngredient,
  type ShoppingImportResult,
  type ShoppingUnit,
} from './types/shopping';

interface CallableResult<T> {
  result: T;
}

export interface ParsedRecipeUrl {
  sourceUrl: string;
  title?: string;
  description?: string;
  servings?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  ingredientLines?: string[];
  steps?: string[];
  rawText?: string;
  structured: boolean;
}

function requiredUserId() {
  const userId = getFirebaseAuth().currentUser?.uid;
  if (!userId) throw new Error('Войдите в аккаунт.');
  return userId;
}

function normalizeName(value: string) {
  return value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
}

function safeQuantity(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || result > 1_000_000) throw new Error('Некорректное количество ингредиента.');
  return Math.round(result * 1000) / 1000;
}

function comparable(quantity: number | null, unit: ShoppingUnit) {
  if (quantity === null) return null;
  if (unit === 'кг') return { group: 'mass', value: quantity * 1000 };
  if (unit === 'г') return { group: 'mass', value: quantity };
  if (unit === 'л') return { group: 'volume', value: quantity * 1000 };
  if (unit === 'мл') return { group: 'volume', value: quantity };
  return { group: `unit:${unit}`, value: quantity };
}

function convertedQuantity(quantity: number, from: ShoppingUnit, to: ShoppingUnit): number | null {
  const source = comparable(quantity, from);
  if (!source) return null;
  if (to === 'кг' && source.group === 'mass') return source.value / 1000;
  if (to === 'г' && source.group === 'mass') return source.value;
  if (to === 'л' && source.group === 'volume') return source.value / 1000;
  if (to === 'мл' && source.group === 'volume') return source.value;
  return source.group === `unit:${to}` ? source.value : null;
}

function equalAmounts(leftQuantity: number | null, leftUnit: ShoppingUnit, rightQuantity: number | null, rightUnit: ShoppingUnit) {
  if (leftQuantity === null || rightQuantity === null) return leftQuantity === rightQuantity;
  const left = comparable(leftQuantity, leftUnit);
  const right = comparable(rightQuantity, rightUnit);
  return left?.group === right?.group && Math.abs((left?.value ?? 0) - (right?.value ?? 0)) < 0.0001;
}

function combineIngredients(ingredients: ShoppingImportIngredient[]) {
  const combined = new Map<string, ShoppingImportIngredient>();
  ingredients.forEach((raw, index) => {
    const name = raw.name.trim();
    if (!name) throw new Error(`У ингредиента ${index + 1} не указано название.`);
    const ingredient = { ...raw, name, quantity: safeQuantity(raw.quantity) };
    const key = normalizeName(name);
    const previous = combined.get(key);
    if (!previous) return void combined.set(key, ingredient);
    if (previous.quantity === null || ingredient.quantity === null) return;
    const converted = convertedQuantity(ingredient.quantity, ingredient.unit, previous.unit);
    if (converted !== null) previous.quantity = Math.round((previous.quantity + converted) * 1000) / 1000;
  });
  return [...combined.values()];
}

function importReceiptPath(familyId: string, userId: string, requestId: string) {
  return `families/${familyId}/apps/shopping/imports/${userId}_${requestId}`;
}

function nameIndexPath(familyId: string, listId: string, normalizedName: string) {
  const id = `${encodeURIComponent(listId)}__${encodeURIComponent(normalizedName)}`;
  return `families/${familyId}/apps/shopping/nameIndex/${id}`;
}

function itemUnit(data: DocumentData | undefined): ShoppingUnit {
  const unit = data?.unit;
  return typeof unit === 'string' ? unit as ShoppingUnit : 'шт';
}

async function importIngredientsDirectly(input: {
  familyId: string;
  listId: string;
  requestId: string;
  recipeId: string;
  ingredients: ShoppingImportIngredient[];
}): Promise<ShoppingImportResult> {
  const userId = requiredUserId();
  const firestore = getFirebaseFirestore();
  const ingredients = combineIngredients(input.ingredients);
  const items = collection(firestore, shoppingListItemsCollectionPath(input.familyId, input.listId));
  const activeItems = await getDocs(query(items, where('checked', '==', false)));
  const candidates = new Map<string, DocumentSnapshot>();
  activeItems.docs.forEach((item) => {
    const key = normalizeName(String(item.data().name ?? ''));
    if (key && !candidates.has(key)) candidates.set(key, item);
  });
  const receiptRef = doc(firestore, importReceiptPath(input.familyId, userId, input.requestId));
  const indexRefs = ingredients.map((ingredient) => doc(firestore, nameIndexPath(input.familyId, input.listId, normalizeName(ingredient.name))));
  const newItemRefs = ingredients.map(() => doc(items));

  return runTransaction(firestore, async (transaction) => {
    const receipt = await transaction.get(receiptRef);
    if (receipt.exists()) return receipt.data().result as ShoppingImportResult;
    const indexes = await Promise.all(indexRefs.map((reference) => transaction.get(reference)));
    const matchedRefs = ingredients.map((ingredient, index) => {
      const indexedId = indexes[index]?.data()?.itemId;
      if (typeof indexedId === 'string' && indexedId) return doc(items, indexedId);
      const candidate = candidates.get(normalizeName(ingredient.name));
      return candidate?.ref ?? null;
    });
    const matched = await Promise.all(matchedRefs.map((reference) => reference ? transaction.get(reference) : null));
    let added = 0;
    let existing = 0;
    const conflicts: ShoppingImportConflict[] = [];

    ingredients.forEach((ingredient, index) => {
      const current = matched[index];
      const active = current?.exists() && current.data()?.checked !== true ? current : null;
      if (!active) {
        const reference = newItemRefs[index]!;
        transaction.set(reference, {
          name: ingredient.name,
          normalizedName: normalizeName(ingredient.name),
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          category: null,
          note: ingredient.note ?? null,
          assigneeUid: null,
          store: null,
          important: false,
          checked: false,
          recipeId: input.recipeId,
          createdBy: userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        transaction.set(indexRefs[index]!, { itemId: reference.id, listId: input.listId, normalizedName: normalizeName(ingredient.name), updatedAt: serverTimestamp() });
        added += 1;
        return;
      }
      if (!indexes[index]?.exists()) {
        transaction.set(indexRefs[index]!, { itemId: active.id, listId: input.listId, normalizedName: normalizeName(ingredient.name), updatedAt: serverTimestamp() });
      }
      const currentQuantity = safeQuantity(active.data()?.quantity);
      const currentUnit = itemUnit(active.data());
      if (ingredient.quantity === null || equalAmounts(currentQuantity, currentUnit, ingredient.quantity, ingredient.unit)) {
        existing += 1;
        return;
      }
      conflicts.push({
        id: `${index}-${active.id}`,
        itemId: active.id,
        name: ingredient.name,
        currentQuantity,
        currentUnit,
        requestedQuantity: ingredient.quantity,
        requestedUnit: ingredient.unit,
      });
    });

    const result = { requestId: input.requestId, added, existing, conflicts };
    transaction.set(receiptRef, {
      userId,
      requestId: input.requestId,
      recipeId: input.recipeId,
      listId: input.listId,
      status: conflicts.length ? 'pending' : 'complete',
      result,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return result;
  });
}

export async function importIngredientsToShopping(input: {
  familyId: string;
  listId: string;
  requestId: string;
  recipeId: string;
  ingredients: ShoppingImportIngredient[];
}): Promise<ShoppingImportResult> {
  return importIngredientsDirectly(input);
}

export async function resolveShoppingImport(input: {
  familyId: string;
  requestId: string;
  decisions: ShoppingConflictDecision[];
}): Promise<ShoppingImportResult> {
  const userId = requiredUserId();
  const firestore = getFirebaseFirestore();
  const receiptRef = doc(firestore, importReceiptPath(input.familyId, userId, input.requestId));
  return runTransaction(firestore, async (transaction) => {
    const receipt = await transaction.get(receiptRef);
    if (!receipt.exists()) throw new Error('Отправка больше недоступна.');
    const receiptData = receipt.data();
    if (receiptData.status === 'resolved') return receiptData.result as ShoppingImportResult;
    const result = receiptData.result as ShoppingImportResult;
    const decisions = new Map(input.decisions.map((decision) => [decision.conflictId, decision]));
    const actionable = result.conflicts.filter((conflict) => decisions.get(conflict.id)?.action !== 'keep');
    const itemRefs = actionable.map((conflict) => doc(firestore, `${shoppingListItemsCollectionPath(input.familyId, String(receiptData.listId ?? 'main'))}/${conflict.itemId}`));
    const items = await Promise.all(itemRefs.map((reference) => transaction.get(reference)));

    actionable.forEach((conflict, index) => {
      const decision = decisions.get(conflict.id);
      const item = items[index];
      const itemRef = itemRefs[index];
      if (!decision || !item?.exists() || !itemRef || item.data()?.checked === true) return;
      let quantity = conflict.requestedQuantity;
      let unit = conflict.requestedUnit;
      const currentQuantity = safeQuantity(item.data()?.quantity);
      const currentUnit = itemUnit(item.data());
      if (decision.action === 'add' && currentQuantity !== null && conflict.requestedQuantity !== null) {
        const requested = convertedQuantity(conflict.requestedQuantity, conflict.requestedUnit, currentUnit);
        if (requested === null) throw new Error(`Для «${conflict.name}» выберите своё количество.`);
        quantity = Math.round((currentQuantity + requested) * 1000) / 1000;
        unit = currentUnit;
      }
      if (decision.action === 'custom') {
        quantity = safeQuantity(decision.quantity);
        unit = decision.unit ?? conflict.requestedUnit;
      }
      transaction.update(itemRef, { quantity, unit, updatedAt: serverTimestamp() });
    });

    const resolved = { ...result, conflicts: [] };
    transaction.update(receiptRef, { status: 'resolved', result: resolved, resolvedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return resolved;
  });
}

export async function parseRecipeFromUrl(url: string): Promise<ParsedRecipeUrl> {
  const command = httpsCallable<{ url: string }, CallableResult<ParsedRecipeUrl>>(
    getFirebaseFunctions(),
    'parseRecipeUrl',
  );
  return (await command({ url })).data.result;
}
