const CATEGORY_ICON_RULES: Array<{ pattern: RegExp; icon: string }> = [
  { pattern: /апте/i, icon: '💊' },
  { pattern: /супермарк|продукт|магазин/i, icon: '🛒' },
  { pattern: /азс|топлив|бензин/i, icon: '⛽' },
  { pattern: /развлеч|кино|театр|игр/i, icon: '🎮' },
  { pattern: /мебел|ремонт|дом/i, icon: '🛋️' },
  { pattern: /авто|такси|каршер|машин/i, icon: '🚗' },
  { pattern: /фастфуд|бургер|еда|ресторан|кафе|бар/i, icon: '🍔' },
  { pattern: /красот|космет|парфюм|салон/i, icon: '🌿' },
  { pattern: /одежд|обув/i, icon: '👕' },
  { pattern: /путеш|отел|тур|авиа|билет/i, icon: '✈️' },
  { pattern: /спорт|фитнес|бассейн/i, icon: '🏋️' },
  { pattern: /книг|канц/i, icon: '📚' },
  { pattern: /техник|электрон|смартф|компьютер/i, icon: '📱' },
  { pattern: /яндекс/i, icon: '🟡' },
  { pattern: /ozon|озон/i, icon: '🔵' },
  { pattern: /aliexpress|ali express/i, icon: '🟠' },
  { pattern: /покуп/i, icon: '🛍️' },
  { pattern: /банк|кредит|ипотек/i, icon: '🏦' },
  { pattern: /карт|плат/i, icon: '💳' },
  { pattern: /музык|концерт/i, icon: '🎵' },
  { pattern: /кофе|чай/i, icon: '☕' },
  { pattern: /пицц|суши|доставк/i, icon: '🍕' },
  { pattern: /подар/i, icon: '🎁' },
  { pattern: /кэш|кеш|cash/i, icon: '💰' },
  { pattern: /животн|ветерин/i, icon: '🐾' },
  { pattern: /дет/i, icon: '👶' },
  { pattern: /образован|универ|школ/i, icon: '🎓' },
  { pattern: /связ|интернет|мобил/i, icon: '🌐' },
  { pattern: /коммун|жкх|электр/i, icon: '⚡' },
  { pattern: /транспорт|метро|автобус/i, icon: '🚌' },
];

export const DEFAULT_CATEGORY_ICON = '◻';

export const CATEGORY_ICON_OPTIONS = [
  '💊',
  '🛒',
  '⛽',
  '🎮',
  '🛋️',
  '🚗',
  '🍔',
  '🌿',
  '👕',
  '✈️',
  '🏋️',
  '📚',
  '📱',
  '🟡',
  '🔵',
  '🟠',
  '🛍️',
  '🏦',
  '💳',
  '🎬',
  '🎵',
  '☕',
  '🍕',
  '🎁',
  '💰',
  '🏠',
  '🚌',
  '🚕',
  '🏥',
  '🐾',
  '👶',
  '🎓',
  '⚡',
  '🌐',
  DEFAULT_CATEGORY_ICON,
] as const;

export function getCategoryIcon(category: string) {
  for (const rule of CATEGORY_ICON_RULES) {
    if (rule.pattern.test(category)) {
      return rule.icon;
    }
  }

  return DEFAULT_CATEGORY_ICON;
}

export function createCashbackEntryData(category = '', percent = '') {
  return {
    category,
    percent,
    icon: getCategoryIcon(category),
    iconIsManual: false,
  };
}
