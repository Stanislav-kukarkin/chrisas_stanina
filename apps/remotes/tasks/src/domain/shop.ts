export type ShopItemKind = 'streak_freeze' | 'daily_reroll' | 'avatar' | 'frame' | 'background' | 'title' | 'badge' | 'effect' | 'mystery_chest';

export interface SystemShopItem {
  id: string;
  kind: ShopItemKind;
  name: string;
  description: string;
  icon: string;
  price: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  value?: string;
  durationDays?: number;
}

export const SYSTEM_SHOP: SystemShopItem[] = [
  { id: 'freeze', kind: 'streak_freeze', name: 'Streak Freeze', description: 'Сохранит Daily Streak при пропуске.', icon: '🧊', price: 80, rarity: 'common' },
  { id: 'reroll', kind: 'daily_reroll', name: 'Daily Reroll', description: 'Бесплатная замена набора Daily.', icon: '🎲', price: 45, rarity: 'common' },
  { id: 'avatar_dragon', kind: 'avatar', name: 'Дракончик', description: 'Avatar override для профиля.', icon: '🐲', price: 140, rarity: 'rare', value: '🐲' },
  { id: 'frame_fire', kind: 'frame', name: 'Огненная рамка', description: 'Постоянная рамка профиля.', icon: '🔥', price: 240, rarity: 'epic', value: 'fire' },
  { id: 'frame_frost', kind: 'frame', name: 'Ледяная рамка', description: 'Постоянная рамка профиля.', icon: '❄️', price: 240, rarity: 'epic', value: 'frost' },
  { id: 'background_tavern', kind: 'background', name: 'Зал трофеев', description: 'Фон mini-profile с тёплым свечением.', icon: '🏰', price: 260, rarity: 'epic', value: 'tavern' },
  { id: 'title_keeper', kind: 'title', name: 'Хранитель очага', description: 'Редкий титул профиля.', icon: '🏷️', price: 180, rarity: 'rare', value: 'Хранитель очага' },
  { id: 'badge_seasonal', kind: 'badge', name: 'Знак сезона', description: 'Сезонный badge на 30 дней.', icon: '🔰', price: 300, rarity: 'legendary', value: 'seasonal', durationDays: 30 },
  { id: 'effect_sparks', kind: 'effect', name: 'Искры героя', description: 'Эффект для профиля.', icon: '✨', price: 320, rarity: 'legendary', value: 'sparks' },
  { id: 'mystery', kind: 'mystery_chest', name: 'Таинственный сундук', description: 'Случайная награда с защитой от дублей.', icon: '🎁', price: 180, rarity: 'epic' },
];

function hash(seed: string) {
  let value = 2166136261;
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return value >>> 0;
}

export function chestRarity(seed: string): SystemShopItem['rarity'] {
  const roll = hash(seed) % 100;
  if (roll < 70) return 'common';
  if (roll < 92) return 'rare';
  if (roll < 99) return 'epic';
  return 'legendary';
}

export function mysteryReward(seed: string) {
  const rarity = chestRarity(seed);
  const rewards = SYSTEM_SHOP.filter((item) => item.kind !== 'mystery_chest' && item.rarity === rarity);
  return rewards[hash(`${seed}:reward`) % rewards.length];
}
