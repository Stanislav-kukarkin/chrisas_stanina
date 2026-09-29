export type ShoppingUnit = 'шт' | 'л' | 'кг' | 'г' | 'уп';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
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
  quantity?: number;
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
