import { SHOPPING_UNITS, type RecipeIngredient, type RecipeInput, type ShoppingUnit } from '@chrisasstanina/firebase';

const FRACTIONS: Record<string, number> = {
  '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125,
};

const UNIT_ALIASES: Array<[RegExp, ShoppingUnit]> = [
  [/^(?:кг|килограмм(?:а|ов)?)(?=\s|$)/i, 'кг'],
  [/^(?:г|гр|грамм(?:а|ов)?)(?=\s|$)/i, 'г'],
  [/^(?:мл|миллилитр(?:а|ов)?)(?=\s|$)/i, 'мл'],
  [/^(?:л|литр(?:а|ов)?)(?=\s|$)/i, 'л'],
  [/^(?:ч\.?\s*л\.?|чай(?:ная|ной|ных)?\s+ложк(?:а|и|ек)?)(?=\s|$)/i, 'ч. л.'],
  [/^(?:ст\.?\s*л\.?|столов(?:ая|ой|ых)?\s+ложк(?:а|и|ек)?)(?=\s|$)/i, 'ст. л.'],
  [/^стакан(?:а|ов)?(?=\s|$)/i, 'стакан'],
  [/^щепотк(?:а|и)?(?=\s|$)/i, 'щепотка'],
  [/^зубчик(?:а|ов)?(?=\s|$)/i, 'зубчик'],
  [/^пуч(?:ок|ка|ков)(?=\s|$)/i, 'пучок'],
  [/^(?:уп\.?|упаковк(?:а|и|ок)?)(?=\s|$)/i, 'уп'],
  [/^(?:шт\.?|штук(?:а|и)?|кус(?:ок|ка|ков)?)(?=\s|$)/i, 'шт'],
];

function id() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `ingredient-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseNumber(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized in FRACTIONS) return FRACTIONS[normalized];
  const mixed = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = normalized.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

function splitNote(value: string) {
  const taste = value.match(/^(.*?)(?:,?\s+)(по вкусу|для подачи|для жарки)$/i);
  if (taste) return { name: taste[1].trim(), note: taste[2].trim() };
  const parentheses = value.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (parentheses) return { name: parentheses[1].trim(), note: parentheses[2].trim() };
  const comma = value.match(/^([^,]+),\s*(.+)$/);
  return comma ? { name: comma[1].trim(), note: comma[2].trim() } : { name: value.trim(), note: undefined };
}

export function parseIngredientLine(source: string): RecipeIngredient | null {
  let line = source.trim().replace(/^[-–—•*✓☐\s]+/, '').trim();
  if (!line) return null;
  const trailingQuantity = line.match(/^(.*?)\s*[–—-]\s*(\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?|[½¼¾⅓⅔⅛])\s*(кг|г|гр|мл|л|ч\.?\s*л\.?|ст\.?\s*л\.?|стакан(?:а|ов)?|щепотк(?:а|и)?|зубчик(?:а|ов)?|пуч(?:ок|ка|ков)|уп\.?|упаковк(?:а|и|ок)?|шт\.?|штук(?:а|и)?)(\s*(?:\([^)]*\))?)$/i);
  if (trailingQuantity) {
    line = `${trailingQuantity[2]} ${trailingQuantity[3]} ${trailingQuantity[1]}${trailingQuantity[4] ?? ''}`;
  }
  const quantityMatch = line.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛])(?:\s*[-–—]\s*(\d+(?:[.,]\d+)?|\d+\/\d+|[½¼¾⅓⅔⅛]))?\s*/);
  let quantity: number | null = null;
  let rangeNote: string | undefined;
  if (quantityMatch) {
    const first = parseNumber(quantityMatch[1]);
    const second = quantityMatch[2] ? parseNumber(quantityMatch[2]) : null;
    quantity = second ?? first;
    if (second !== null && first !== null) rangeNote = `${quantityMatch[1]}–${quantityMatch[2]}`;
    line = line.slice(quantityMatch[0].length).trim();
  }
  let unit: ShoppingUnit = 'шт';
  for (const [pattern, mapped] of UNIT_ALIASES) {
    const match = line.match(pattern);
    if (!match) continue;
    unit = mapped;
    line = line.slice(match[0].length).trim().replace(/^[-–—,:]+\s*/, '');
    break;
  }
  const { name, note } = splitNote(line);
  if (!name) return null;
  return {
    id: id(),
    name,
    quantity,
    unit: SHOPPING_UNITS.includes(unit) ? unit : 'шт',
    note: [rangeNote, note].filter(Boolean).join(' · ') || undefined,
  };
}

export function parseIngredientLines(lines: string[]): RecipeIngredient[] {
  return lines.map(parseIngredientLine).filter((item): item is RecipeIngredient => Boolean(item));
}

function cleanStep(line: string) {
  return line.replace(/^\s*(?:шаг\s*)?\d+[.)\-:]?\s*/i, '').replace(/^[-–—•*]\s*/, '').trim();
}

export function emptyRecipe(): RecipeInput {
  return {
    title: '',
    description: '',
    servings: null,
    prepMinutes: null,
    cookMinutes: null,
    ingredients: [{ id: id(), name: '', quantity: null, unit: 'шт' }],
    steps: [''],
    sourceUrl: '',
    favorite: false,
  };
}

export function parseRecipeText(text: string): RecipeInput {
  const lines = text.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  const draft = emptyRecipe();
  if (lines.length === 0) return draft;
  const ingredientHeader = lines.findIndex((line) => /^(ингредиенты|состав|ingredients)\s*:?$/i.test(line));
  const stepsHeader = lines.findIndex((line) => /^(приготовление|способ приготовления|инструкция|шаги|instructions?|directions?)\s*:?$/i.test(line));
  const firstHeader = [ingredientHeader, stepsHeader].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? -1;
  draft.title = (firstHeader > 0 ? lines[0] : lines[0]).replace(/^#+\s*/, '').slice(0, 180);
  let ingredientLines: string[] = [];
  let stepLines: string[] = [];
  if (ingredientHeader >= 0) {
    ingredientLines = lines.slice(ingredientHeader + 1, stepsHeader > ingredientHeader ? stepsHeader : undefined);
  }
  if (stepsHeader >= 0) stepLines = lines.slice(stepsHeader + 1);
  if (ingredientHeader < 0 && stepsHeader < 0) {
    const remaining = lines.slice(1);
    ingredientLines = remaining.filter((line) => /^(?:[-–—•*]\s*)?(?:\d|[½¼¾⅓⅔⅛])/.test(line) || /по вкусу$/i.test(line));
    stepLines = remaining.filter((line) => !ingredientLines.includes(line));
  }
  const ingredients = parseIngredientLines(ingredientLines);
  const steps = stepLines.map(cleanStep).filter(Boolean);
  draft.ingredients = ingredients.length ? ingredients : draft.ingredients;
  draft.steps = steps.length ? steps : draft.steps;
  return draft;
}

function cleanMarkdownLine(line: string) {
  return line
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s{2,}$/g, '')
    .trim();
}

/** Parses the plain Markdown returned by a read-only web reader. */
export function parseReaderRecipe(text: string, sourceUrl: string): RecipeInput {
  const rawLines = text.replace(/\r/g, '').split('\n');
  const lines = rawLines.map(cleanMarkdownLine);
  const ingredientHeader = lines.findIndex((line) => /^(?:ингредиенты|состав|что (?:нужно|надо)|ingredients?)\s*:?$/i.test(line));
  const stepsHeader = lines.findIndex((line, index) => index > ingredientHeader
    && /^(?:приготовление|способ приготовления|что делать|инструкция|шаги|instructions?|directions?)\s*:?$/i.test(line));
  if (ingredientHeader < 0 || stepsHeader < 0) {
    const fallback = parseRecipeText(lines.filter(Boolean).join('\n'));
    return { ...fallback, sourceUrl };
  }

  const headingIndexes = rawLines
    .map((line, index) => (/^#{1,6}\s+/.test(line.trim()) && index < ingredientHeader ? index : -1))
    .filter((index) => index >= 0);
  const readerTitle = lines.find((line) => /^Title:\s+/i.test(line))?.replace(/^Title:\s+/i, '') ?? '';
  const title = headingIndexes.length ? lines[headingIndexes.at(-1)!] : readerTitle;

  const ingredientLines: string[] = [];
  for (let index = ingredientHeader + 1; index < stepsHeader; index += 1) {
    const raw = rawLines[index]?.trimEnd() ?? '';
    const line = lines[index];
    if (!line) continue;
    if (/^[-*+]\s+/.test(raw.trimStart())) ingredientLines.push(line);
    else if (ingredientLines.length && /^\s+/.test(raw)) ingredientLines[ingredientLines.length - 1] += ` ${line}`;
    else ingredientLines.push(line);
  }

  const stepLines: string[] = [];
  for (let index = stepsHeader + 1; index < lines.length; index += 1) {
    const raw = rawLines[index]?.trim() ?? '';
    const line = lines[index];
    if (/^!\[/.test(raw) || (/^#{1,6}\s+/.test(raw) && stepLines.length)) break;
    if (!line) continue;
    if (/^(?:рецепты\s+|если вы заметили|автор\s*:|[А-ЯЁ][А-ЯЁ\s]+:\s*$)/i.test(line)) break;
    stepLines.push(cleanStep(line));
  }

  const ingredients = parseIngredientLines(ingredientLines);
  const draft = emptyRecipe();
  return {
    ...draft,
    title: (title || readerTitle || 'Рецепт').slice(0, 180),
    ingredients: ingredients.length ? ingredients : draft.ingredients,
    steps: stepLines.length ? stepLines : draft.steps,
    sourceUrl,
  };
}
