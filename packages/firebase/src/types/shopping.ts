export type ShoppingUnit =
  | 'шт'
  | 'г'
  | 'кг'
  | 'мл'
  | 'л'
  | 'ч. л.'
  | 'ст. л.'
  | 'стакан'
  | 'щепотка'
  | 'зубчик'
  | 'пучок'
  | 'уп';

export interface ShoppingList {
  id: string;
  name: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: ShoppingUnit;
  category?: string;
  note?: string;
  assigneeUid?: string;
  store?: string;
  important: boolean;
  checked: boolean;
  recipeId?: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ShoppingItemInput {
  name: string;
  quantity?: number | null;
  unit?: ShoppingUnit;
  category?: string;
  note?: string;
  assigneeUid?: string;
  store?: string;
  important?: boolean;
  recipeId?: string;
}

export interface ShoppingFavorite {
  id: string;
  name: string;
  quantity: number;
  unit: ShoppingUnit;
  category?: string;
  store?: string;
}

export interface ShoppingImportIngredient {
  id: string;
  name: string;
  quantity: number | null;
  unit: ShoppingUnit;
  note?: string;
}

export interface ShoppingImportConflict {
  id: string;
  itemId: string;
  name: string;
  currentQuantity: number | null;
  currentUnit: ShoppingUnit;
  requestedQuantity: number | null;
  requestedUnit: ShoppingUnit;
}

export interface ShoppingImportResult {
  requestId: string;
  added: number;
  existing: number;
  conflicts: ShoppingImportConflict[];
}

export type ShoppingConflictAction = 'keep' | 'set' | 'add' | 'custom';

export interface ShoppingConflictDecision {
  conflictId: string;
  action: ShoppingConflictAction;
  quantity?: number | null;
  unit?: ShoppingUnit;
}

export interface ShoppingFavoriteInput {
  name: string;
  quantity?: number;
  unit?: ShoppingUnit;
  category?: string;
  store?: string;
}

export type ShoppingItemUpdate = Partial<
  Omit<ShoppingItem, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>
>;
