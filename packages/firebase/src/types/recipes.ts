export interface RecipeIngredient {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  note?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: RecipeIngredient[];
  steps: string[];
  sourceUrl?: string;
  favorite: boolean;
  authorId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type RecipeInput = Omit<Recipe, 'id' | 'authorId' | 'createdAt' | 'updatedAt'>;
export type RecipeUpdate = Partial<RecipeInput>;
