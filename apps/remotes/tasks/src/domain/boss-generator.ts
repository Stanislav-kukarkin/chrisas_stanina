export interface GeneratedBoss {
  name: string;
  archetype: string;
  season: string;
  description: string;
  quote: string;
  visualTraits: string[];
  icon: string;
}

export interface SeasonSlot {
  id: string;
  month: number;
  half: 0 | 1;
  theme: string;
  prefixes: readonly string[];
  traits: readonly string[];
  introTemplates: readonly string[];
  icon: string;
}

export const BOSS_ARCHETYPES = [
  'Лентяй', 'Пылекрут', 'Слизень', 'Хламоглот', 'Носкоед', 'Крошкоед', 'Барон Беспорядок', 'Граф Прокрастинатор',
  'Король Дивана', 'Повелитель Посуды', 'Шкафный Тролль', 'Квитанционный Голем', 'Пылевой Элементаль', 'Мусорный Огрон',
  'Пятновик', 'Ковровый Гоблин', 'Великий Разбрасыватель', 'Герцог Немытой Кружки', 'Архимаг Отговорок',
  'Лорд Носочных Пар', 'Кухонный Мимик', 'Балконный Дракон', 'Властелин Коробок', 'Мастер Завтра', 'Демон Недоделок',
  'Полочный Гаргуль', 'Повелитель Крошек', 'Ванный Кобольд', 'Страж Грязной Плиты', 'Архивный Некромант', 'Генерал Бардак', 'Император Лени',
] as const;

const slotData = [
  ['frost', ['Морозный', 'Ледяной', 'Снежный'], ['ice', 'snow', 'frost'], '❄️'],
  ['deep_winter', ['Вьюжный', 'Стужный', 'Заснеженный'], ['blizzard', 'icicles', 'cold_fire'], '🌨️'],
  ['lantern', ['Фонарный', 'Сумеречный', 'Искристый'], ['lanterns', 'long_night', 'sparks'], '🏮'],
  ['thaw', ['Талый', 'Капельный', 'Скользкий'], ['thaw', 'puddles', 'wet_snow'], '💧'],
  ['first_bloom', ['Первоцветный', 'Ручейный', 'Звонкий'], ['buds', 'streams', 'morning_mist'], '🌱'],
  ['spring', ['Цветущий', 'Дождливый', 'Зелёный'], ['flowers', 'rain', 'green_glow'], '🌸'],
  ['rain', ['Ливневый', 'Грозовой', 'Тучный'], ['rain', 'thunder', 'wet_stone'], '🌧️'],
  ['garden', ['Садовый', 'Сиреневый', 'Пыльцевой'], ['lilac', 'pollen', 'garden'], '🌿'],
  ['sun', ['Солнечный', 'Полуденный', 'Лучистый'], ['sun', 'warm_dust', 'gold_glow'], '☀️'],
  ['meadow', ['Луговой', 'Одуванчиковый', 'Травяной'], ['meadow', 'dandelion', 'breeze'], '🌼'],
  ['heat', ['Знойный', 'Раскалённый', 'Маревый'], ['heat_haze', 'dry_stone', 'bright_sky'], '🔥'],
  ['midsummer', ['Купальский', 'Ночной', 'Светлячковый'], ['fireflies', 'midsummer', 'river_glow'], '✨'],
  ['storm', ['Громовой', 'Электрический', 'Буревой'], ['storm', 'lightning', 'dark_clouds'], '⛈️'],
  ['harvest', ['Урожайный', 'Медовый', 'Колосистый'], ['grain', 'honey', 'warm_evening'], '🌾'],
  ['berry', ['Ягодный', 'Малиновый', 'Черничный'], ['berries', 'forest', 'purple_glow'], '🫐'],
  ['late_summer', ['Закатный', 'Пыльный', 'Августовский'], ['sunset', 'dry_grass', 'long_shadows'], '🌇'],
  ['school', ['Тетрадный', 'Чернильный', 'Звонковый'], ['paper', 'ink', 'brass_bell'], '📚'],
  ['autumn', ['Осенний', 'Листопадный', 'Промозглый'], ['leaves', 'rain', 'mud'], '🍂'],
  ['fog', ['Туманный', 'Сырой', 'Дымчатый'], ['fog', 'wet_leaves', 'dim_lights'], '🌫️'],
  ['pumpkin', ['Тыквенный', 'Ночной', 'Жутковатый'], ['pumpkin_armor', 'candle_glow', 'orange_fog'], '🎃'],
  ['first_snow', ['Предзимний', 'Инеевый', 'Хрустящий'], ['first_snow', 'frosted_leaves', 'pale_sky'], '🌬️'],
  ['dark_night', ['Полуночный', 'Беззвёздный', 'Теневой'], ['long_night', 'moon', 'blue_flame'], '🌙'],
  ['festive', ['Праздничный', 'Мандариновый', 'Гирляндный'], ['garlands', 'tangerines', 'gold_sparks'], '🎄'],
  ['new_year', ['Новогодний', 'Сверкающий', 'Полуночный'], ['fireworks', 'snow', 'clockwork'], '🎆'],
] as const;

const intros = [
  'Из тумана у дверей таверны показался {name}.',
  'В таверне погасли свечи — появился {name}.',
  'Где-то подозрительно заскрипел шкаф. Это {name}.',
] as const;

export const SEASON_SLOTS: SeasonSlot[] = slotData.map(([theme, prefixes, traits, icon], index) => ({
  id: `${String(Math.floor(index / 2) + 1).padStart(2, '0')}-${index % 2 === 0 ? 'a' : 'b'}`,
  month: Math.floor(index / 2),
  half: index % 2 as 0 | 1,
  theme,
  prefixes,
  traits,
  icon,
  introTemplates: intros,
}));

const descriptions = [
  '{boss} веками охраняет священное искусство ничего не делать.',
  'Говорят, {boss} однажды почти навёл порядок. Летописи расходятся во мнениях.',
  '{boss} становится сильнее каждый раз, когда кто-то говорит: «сделаю потом».',
  '{boss} питается забытыми чашками, потерянными носками и сорванными дедлайнами.',
] as const;

const quotes = [
  'Зачем делать сегодня то, что можно перенести в следующий спринт?',
  'Я уже почти начал. Ещё пять минут…',
  'Ваш порядок нарушает древние традиции хаоса!',
  'Ни одна чистая кружка не покинет эту кухню!',
] as const;

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

function fill(template: string, name: string) {
  return template.replaceAll('{name}', name).replaceAll('{boss}', name);
}

export function generateBoss(familyId: string, sprintId: string, date = new Date()): GeneratedBoss {
  const seed = hash(`${familyId}:${sprintId}`);
  const slot = SEASON_SLOTS.find((candidate) => candidate.month === date.getMonth() && candidate.half === (date.getDate() <= 15 ? 0 : 1))
    ?? SEASON_SLOTS[0];
  const archetype = BOSS_ARCHETYPES[seed % BOSS_ARCHETYPES.length];
  const prefix = slot.prefixes[(seed >>> 4) % slot.prefixes.length];
  const name = `${prefix} ${archetype}`;
  const intro = fill(slot.introTemplates[(seed >>> 8) % slot.introTemplates.length], name);
  const description = fill(descriptions[(seed >>> 12) % descriptions.length], name);
  return {
    name,
    archetype,
    season: slot.theme,
    description: `${intro} ${description}`,
    quote: quotes[(seed >>> 16) % quotes.length],
    visualTraits: [...slot.traits],
    icon: slot.icon,
  };
}
