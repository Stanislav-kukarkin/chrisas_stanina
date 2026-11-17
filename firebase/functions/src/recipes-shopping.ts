import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

if (getApps().length === 0) initializeApp();

const db = getFirestore();
const REGION = 'europe-west1';
const UNITS = ['шт', 'г', 'кг', 'мл', 'л', 'ч. л.', 'ст. л.', 'стакан', 'щепотка', 'зубчик', 'пучок', 'уп'] as const;
type Unit = (typeof UNITS)[number];

interface ImportIngredient {
  id: string;
  name: string;
  quantity: number | null;
  unit: Unit;
  note?: string;
}

interface Conflict {
  id: string;
  itemId: string;
  name: string;
  currentQuantity: number | null;
  currentUnit: Unit;
  requestedQuantity: number | null;
  requestedUnit: Unit;
}

function requiredText(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new HttpsError('invalid-argument', `Некорректное поле ${field}.`);
  }
  return value.trim();
}

function normalizeName(value: string): string {
  return value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
}

function normalizeUnit(value: unknown): Unit {
  const raw = String(value ?? '').toLocaleLowerCase('ru-RU').trim().replace(/\s+/g, ' ');
  const aliases: Record<string, Unit> = {
    штука: 'шт', штуки: 'шт', штук: 'шт', шт: 'шт',
    грамм: 'г', грамма: 'г', граммов: 'г', г: 'г',
    килограмм: 'кг', килограмма: 'кг', килограммов: 'кг', кг: 'кг',
    миллилитр: 'мл', миллилитра: 'мл', миллилитров: 'мл', мл: 'мл',
    литр: 'л', литра: 'л', литров: 'л', л: 'л',
    'ч.л.': 'ч. л.', 'ч. л.': 'ч. л.', 'чайная ложка': 'ч. л.', 'чайных ложки': 'ч. л.',
    'ст.л.': 'ст. л.', 'ст. л.': 'ст. л.', 'столовая ложка': 'ст. л.', 'столовых ложки': 'ст. л.',
    стакан: 'стакан', стакана: 'стакан', стаканов: 'стакан',
    щепотка: 'щепотка', щепотки: 'щепотка',
    зубчик: 'зубчик', зубчика: 'зубчик', зубчиков: 'зубчик',
    пучок: 'пучок', пучка: 'пучок', пучков: 'пучок',
    упаковка: 'уп', упаковки: 'уп', упаковок: 'уп', уп: 'уп',
  };
  return aliases[raw] ?? (UNITS.includes(raw as Unit) ? raw as Unit : 'шт');
}

function amount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || result > 1_000_000) {
    throw new HttpsError('invalid-argument', 'Некорректное количество ингредиента.');
  }
  return Math.round(result * 1000) / 1000;
}

function comparable(quantity: number | null, unit: Unit) {
  if (quantity === null) return null;
  if (unit === 'кг') return { group: 'mass', value: quantity * 1000 };
  if (unit === 'г') return { group: 'mass', value: quantity };
  if (unit === 'л') return { group: 'volume', value: quantity * 1000 };
  if (unit === 'мл') return { group: 'volume', value: quantity };
  return { group: `unit:${unit}`, value: quantity };
}

function convert(quantity: number, from: Unit, to: Unit): number | null {
  const source = comparable(quantity, from);
  if (!source) return null;
  if (to === 'кг' && source.group === 'mass') return source.value / 1000;
  if (to === 'г' && source.group === 'mass') return source.value;
  if (to === 'л' && source.group === 'volume') return source.value / 1000;
  if (to === 'мл' && source.group === 'volume') return source.value;
  return source.group === `unit:${to}` ? source.value : null;
}

function equalAmounts(leftQuantity: number | null, leftUnit: Unit, rightQuantity: number | null, rightUnit: Unit) {
  if (leftQuantity === null || rightQuantity === null) return leftQuantity === rightQuantity;
  const left = comparable(leftQuantity, leftUnit);
  const right = comparable(rightQuantity, rightUnit);
  return left?.group === right?.group && Math.abs((left?.value ?? 0) - (right?.value ?? 0)) < 0.0001;
}

function itemCollectionPath(familyId: string, listId: string) {
  return listId === 'main'
    ? `families/${familyId}/apps/shopping/items`
    : `families/${familyId}/apps/shopping/lists/${listId}/items`;
}

async function assertShoppingList(familyId: string, listId: string) {
  if (listId === 'main') return;
  const snapshot = await db.doc(`families/${familyId}/apps/shopping/lists/${listId}`).get();
  if (!snapshot.exists) throw new HttpsError('not-found', 'Список покупок больше не существует.');
}

async function assertShoppingEditor(familyId: string, userId: string) {
  const [member, access] = await Promise.all([
    db.doc(`families/${familyId}/members/${userId}`).get(),
    db.doc(`families/${familyId}/appAccess/shopping/members/${userId}`).get(),
  ]);
  if (!member.exists) throw new HttpsError('permission-denied', 'Нет доступа к этому пространству покупок.');
  const legacy = !('accessVersion' in (member.data() ?? {}));
  if (!legacy && (!access.exists || access.data()?.role !== 'edit')) {
    throw new HttpsError('permission-denied', 'Список покупок доступен только для просмотра.');
  }
}

function parseIngredients(value: unknown): ImportIngredient[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new HttpsError('invalid-argument', 'Передайте от 1 до 100 ингредиентов.');
  }
  const parsed = value.map((entry, index) => {
    const data = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    return {
      id: typeof data.id === 'string' ? data.id : `ingredient-${index}`,
      name: requiredText(data.name, `ingredients[${index}].name`, 180),
      quantity: amount(data.quantity),
      unit: normalizeUnit(data.unit),
      note: typeof data.note === 'string' ? data.note.trim().slice(0, 300) : undefined,
    };
  });

  const combined = new Map<string, ImportIngredient>();
  parsed.forEach((ingredient) => {
    const key = normalizeName(ingredient.name);
    const previous = combined.get(key);
    if (!previous) {
      combined.set(key, ingredient);
      return;
    }
    if (previous.quantity === null || ingredient.quantity === null) return;
    const converted = convert(ingredient.quantity, ingredient.unit, previous.unit);
    if (converted !== null) previous.quantity = Math.round((previous.quantity + converted) * 1000) / 1000;
  });
  return [...combined.values()];
}

export const shoppingImport = onCall({ region: REGION, cors: true, enforceAppCheck: false }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', 'Войдите в аккаунт.');
  const data = request.data && typeof request.data === 'object' ? request.data as Record<string, unknown> : {};
  const familyId = requiredText(data.familyId, 'familyId', 180);
  const listId = requiredText(data.listId, 'listId', 180);
  const requestId = requiredText(data.requestId, 'requestId', 120);
  const recipeId = requiredText(data.recipeId, 'recipeId', 180);
  const ingredients = parseIngredients(data.ingredients);
  await assertShoppingEditor(familyId, userId);
  await assertShoppingList(familyId, listId);

  const receiptRef = db.doc(`families/${familyId}/apps/shopping/imports/${userId}_${requestId}`);
  const itemsCollection = db.collection(itemCollectionPath(familyId, listId));
  const result = await db.runTransaction(async (transaction) => {
    const receipt = await transaction.get(receiptRef);
    if (receipt.exists) return receipt.data()?.result;
    const activeItems = await transaction.get(itemsCollection.where('checked', '==', false));
    const byName = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    activeItems.docs.forEach((item) => {
      const key = normalizeName(String(item.data().name ?? ''));
      if (key && !byName.has(key)) byName.set(key, item);
    });
    let added = 0;
    let existing = 0;
    const conflicts: Conflict[] = [];
    ingredients.forEach((ingredient, index) => {
      const match = byName.get(normalizeName(ingredient.name));
      if (!match) {
        const reference = itemsCollection.doc();
        transaction.create(reference, {
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
          recipeId,
          createdBy: userId,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        added += 1;
        return;
      }
      const currentQuantity = amount(match.data().quantity);
      const currentUnit = normalizeUnit(match.data().unit);
      if (ingredient.quantity === null || equalAmounts(currentQuantity, currentUnit, ingredient.quantity, ingredient.unit)) {
        existing += 1;
        return;
      }
      conflicts.push({
        id: `${index}-${match.id}`,
        itemId: match.id,
        name: ingredient.name,
        currentQuantity,
        currentUnit,
        requestedQuantity: ingredient.quantity,
        requestedUnit: ingredient.unit,
      });
    });
    const response = { requestId, added, existing, conflicts };
    transaction.create(receiptRef, {
      userId, requestId, recipeId, listId, status: conflicts.length ? 'pending' : 'complete',
      result: response, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return response;
  });
  return { result };
});

export const shoppingResolveImport = onCall({ region: REGION, cors: true, enforceAppCheck: false }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', 'Войдите в аккаунт.');
  const data = request.data && typeof request.data === 'object' ? request.data as Record<string, unknown> : {};
  const familyId = requiredText(data.familyId, 'familyId', 180);
  const requestId = requiredText(data.requestId, 'requestId', 120);
  await assertShoppingEditor(familyId, userId);
  const decisions = Array.isArray(data.decisions) ? data.decisions as Array<Record<string, unknown>> : [];
  const receiptRef = db.doc(`families/${familyId}/apps/shopping/imports/${userId}_${requestId}`);
  const result = await db.runTransaction(async (transaction) => {
    const receipt = await transaction.get(receiptRef);
    if (!receipt.exists) throw new HttpsError('not-found', 'Отправка больше недоступна.');
    const receiptData = receipt.data()!;
    if (receiptData.status === 'resolved') return receiptData.result;
    const conflicts = Array.isArray(receiptData.result?.conflicts) ? receiptData.result.conflicts as Conflict[] : [];
    const decisionMap = new Map(decisions.map((decision) => [String(decision.conflictId ?? ''), decision]));
    const listId = String(receiptData.listId ?? 'main');
    const actionable = conflicts.filter((conflict) => {
      const decision = decisionMap.get(conflict.id);
      return decision && decision.action !== 'keep';
    });
    const itemRefs = actionable.map((conflict) => db.doc(`${itemCollectionPath(familyId, listId)}/${conflict.itemId}`));
    const itemSnapshots = await Promise.all(itemRefs.map((reference) => transaction.get(reference)));
    actionable.forEach((conflict, index) => {
      const decision = decisionMap.get(conflict.id)!;
      const itemRef = itemRefs[index];
      const item = itemSnapshots[index];
      if (!item.exists || item.data()?.checked === true) return;
      let quantity = conflict.requestedQuantity;
      let unit = conflict.requestedUnit;
      const freshQuantity = amount(item.data()?.quantity);
      const freshUnit = normalizeUnit(item.data()?.unit);
      if (decision.action === 'add' && freshQuantity !== null && conflict.requestedQuantity !== null) {
        const requestedInCurrent = convert(conflict.requestedQuantity, conflict.requestedUnit, freshUnit);
        if (requestedInCurrent === null) throw new HttpsError('failed-precondition', `Для «${conflict.name}» выберите своё количество.`);
        quantity = Math.round((freshQuantity + requestedInCurrent) * 1000) / 1000;
        unit = freshUnit;
      }
      if (decision.action === 'custom') {
        quantity = amount(decision.quantity);
        unit = normalizeUnit(decision.unit);
      }
      transaction.update(itemRef, { quantity, unit, updatedAt: FieldValue.serverTimestamp() });
    });
    const response = { ...receiptData.result, conflicts: [] };
    transaction.update(receiptRef, { status: 'resolved', result: response, resolvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return response;
  });
  return { result };
});

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function findRecipe(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipe(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const type = data['@type'];
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) return data;
  return findRecipe(data['@graph']);
}

function durationMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?/i);
  return match ? Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0) : null;
}

function instructionText(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return [item];
    if (item && typeof item === 'object') {
      const data = item as Record<string, unknown>;
      if (typeof data.text === 'string') return [data.text];
      return instructionText(data.itemListElement);
    }
    return [];
  }).map((item) => decodeHtml(item).trim()).filter(Boolean);
}

function assertPublicUrl(value: unknown): URL {
  const url = new URL(requiredText(value, 'url', 2000));
  if (!['http:', 'https:'].includes(url.protocol)) throw new HttpsError('invalid-argument', 'Поддерживаются только http/https ссылки.');
  const host = url.hostname.toLocaleLowerCase();
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')
    || /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\.|^100\.(?:6[4-9]|[78]\d|9\d|1[01]\d|12[0-7])\./.test(host)
    || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
    || /^(?:fc|fd|fe8|fe9|fea|feb)/i.test(host.replaceAll('[', '').replaceAll(']', '').replaceAll(':', ''))) {
    throw new HttpsError('invalid-argument', 'Локальные адреса не поддерживаются.');
  }
  return url;
}

async function fetchPublicPage(initialUrl: URL): Promise<Response> {
  let url = initialUrl;
  for (let redirects = 0; redirects < 6; redirects += 1) {
    const response = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; MyRecipes/1.0)' },
      signal: AbortSignal.timeout(15_000),
      redirect: 'manual',
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get('location');
    if (!location) return response;
    url = assertPublicUrl(new URL(location, url).toString());
  }
  throw new HttpsError('failed-precondition', 'Слишком много перенаправлений.');
}

export const parseRecipeUrl = onCall({ region: REGION, cors: true, enforceAppCheck: false, timeoutSeconds: 30 }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Войдите в аккаунт.');
  const url = assertPublicUrl((request.data as Record<string, unknown> | undefined)?.url);
  let response: Response;
  try {
    response = await fetchPublicPage(url);
  } catch {
    throw new HttpsError('unavailable', 'Страница недоступна. Вставьте текст рецепта или загрузите скриншот.');
  }
  if (!response.ok) throw new HttpsError('unavailable', `Страница вернула ошибку ${response.status}.`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('text/html')) throw new HttpsError('failed-precondition', 'По ссылке нет HTML-страницы с рецептом.');
  const html = (await response.text()).slice(0, 1_500_000);
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let recipe: Record<string, unknown> | null = null;
  for (const script of scripts) {
    try {
      recipe = findRecipe(JSON.parse(decodeHtml(script[1])));
      if (recipe) break;
    } catch {
      // Some pages expose malformed JSON-LD; the text fallback below remains available.
    }
  }
  const plainText = decodeHtml(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n'))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 50_000);
  if (!recipe) return { result: { sourceUrl: url.toString(), rawText: plainText, structured: false } };
  const ingredients = Array.isArray(recipe.recipeIngredient)
    ? recipe.recipeIngredient.filter((item): item is string => typeof item === 'string')
    : [];
  return { result: {
    sourceUrl: url.toString(),
    title: typeof recipe.name === 'string' ? decodeHtml(recipe.name) : '',
    description: typeof recipe.description === 'string' ? decodeHtml(recipe.description).replace(/<[^>]+>/g, '') : '',
    servings: typeof recipe.recipeYield === 'number' ? recipe.recipeYield : Number(String(recipe.recipeYield ?? '').match(/\d+/)?.[0] ?? 0) || null,
    prepMinutes: durationMinutes(recipe.prepTime),
    cookMinutes: durationMinutes(recipe.cookTime),
    ingredientLines: ingredients.map(decodeHtml),
    steps: instructionText(recipe.recipeInstructions),
    rawText: plainText,
    structured: true,
  } };
});
