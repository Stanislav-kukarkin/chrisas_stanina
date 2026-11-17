import { SHOPPING_UNITS } from '../../constants/shopping-categories';
import { type ShoppingFavorite, type ShoppingItem, type ShoppingList, type ShoppingUnit } from '../../types/shopping';
import { mapTimestamp } from '../../utils/firestore-mapper';

function parseUnit(value: unknown): ShoppingUnit {
  return SHOPPING_UNITS.includes(value as ShoppingUnit) ? (value as ShoppingUnit) : 'шт';
}

export function mapShoppingItem(id: string, data: Record<string, unknown>): ShoppingItem {
  return {
    id,
    name: String(data.name ?? ''),
    quantity: typeof data.quantity === 'number' && Number.isFinite(data.quantity)
      ? data.quantity
      : null,
    unit: parseUnit(data.unit),
    category: data.category ? String(data.category) : undefined,
    note: data.note ? String(data.note) : undefined,
    assigneeUid: data.assigneeUid ? String(data.assigneeUid) : undefined,
    store: data.store ? String(data.store) : undefined,
    important: Boolean(data.important),
    checked: Boolean(data.checked),
    recipeId: data.recipeId ? String(data.recipeId) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdAt: mapTimestamp(data.createdAt),
    updatedAt: mapTimestamp(data.updatedAt),
  };
}

export function mapShoppingList(id: string, data: Record<string, unknown>): ShoppingList {
  return {
    id,
    name: String(data.name ?? (id === 'main' ? 'Основной' : 'Список')),
    createdBy: String(data.createdBy ?? ''),
    createdAt: mapTimestamp(data.createdAt),
    updatedAt: mapTimestamp(data.updatedAt),
  };
}

export function mapShoppingFavorite(id: string, data: Record<string, unknown>): ShoppingFavorite {
  return {
    id,
    name: String(data.name ?? ''),
    quantity: Number(data.quantity ?? 1),
    unit: parseUnit(data.unit),
    category: data.category ? String(data.category) : undefined,
    store: data.store ? String(data.store) : undefined,
  };
}
