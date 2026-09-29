export const SHOPPING_CATEGORIES = [
  'Молочка',
  'Мясо и рыба',
  'Овощи и фрукты',
  'Бакалея',
  'Напитки',
  'Заморозка',
  'Бытовое',
  'Гигиена',
  'Другое',
] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export const SHOPPING_UNITS = ['шт', 'л', 'кг', 'г', 'уп'] as const;
