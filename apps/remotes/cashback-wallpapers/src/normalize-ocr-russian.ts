import { KNOWN_CASHBACK_CATEGORIES } from './categories';

const KNOWN_CATEGORIES = KNOWN_CASHBACK_CATEGORIES;

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

const LATIN_HOMOGLYPHS: Record<string, string> = {
  A: 'А',
  a: 'а',
  B: 'В',
  E: 'Е',
  e: 'е',
  K: 'К',
  k: 'к',
  M: 'М',
  m: 'м',
  H: 'Н',
  h: 'н',
  O: 'О',
  o: 'о',
  P: 'Р',
  p: 'р',
  C: 'С',
  c: 'с',
  T: 'Т',
  t: 'т',
  X: 'Х',
  x: 'х',
  Y: 'У',
  y: 'у',
  I: 'И',
  i: 'и',
  D: 'Д',
  d: 'д',
  L: 'Л',
  l: 'л',
  U: 'У',
  u: 'у',
  S: 'С',
  s: 'с',
  R: 'Р',
  r: 'р',
};

const OCR_ARTIFACTS: Record<string, string> = {
  ı: 'i',
  İ: 'I',
  ł: 'l',
  Ł: 'L',
  ǝ: 'e',
  ə: 'e',
  ѵ: 'v',
  Ѵ: 'V',
  '3': 'z',
};

const OCR_FINGERPRINT_FIXES: Record<string, string> = {
  g: 'd',
  q: 'p',
};

const MANUAL_CATEGORY_ALIASES: Record<string, string[]> = {
  'Все покупки': ['vse pokupki', 'bce pokupki', 'vse nokuikm', 'bce nokuikm', 'nokuikm', 'nokupki'],
  'Яндекс Лавка': ['yandeks lavka', 'ahgekc jlabka', 'andeks lavka', 'ahdekc lavka', 'ahgekc lavka'],
  'Яндекс Такси': [
    'yandeks taksi',
    'yandeks taxi',
    'ahgekc taksi',
    'ahgekc takcn',
    'ahdekc taksi',
    'ahdekc takcn',
    'andeks taksi',
  ],
  'Супермаркеты': ['supermarkety', 'cupermarkety', 'synepmarkety'],
  'Книги и канцтовары': ['knigi i kanctovary', 'knigi i kanstovary'],
  'Кафе и рестораны': ['kafe i restorany'],
  'Одежда и обувь': ['odezhda i obuv'],
  'За все покупки': ['za vse pokupki'],
  'На все покупки': ['na vse pokupki'],
  'Развлечения': ['raz vneuenma', 'ra3 vneuenma', 'razvneuenma', 'razvlecheniya'],
  'Ж/д билеты': ['zhd bilety', 'zh d bilety', 'z d bilety'],
  'Онлайн-кинотеатры': ['onlain kinoteatry', 'online kinoteatry', 'onlayn kinoteatry'],
  'Электросамокаты': ['elektrosamokaty', 'elektro samokaty'],
  'Общественный транспорт': ['obshchestvenny transport', 'obshhestvennyj transport'],
  'Магазины у дома': ['magaziny u doma', 'magaziny u doma'],
  'Доставка еды': ['dostavka edy', 'dostavka iedy'],
  'Медицинские услуги': ['medicinskie uslugi', 'meditsinskie uslugi'],
  'Строительные материалы': ['stroitelnye materialy', 'stroitel nyematerialy'],
  'Автомобильные товары': ['avtomobilnye tovary', 'avtomobil nye tovary'],
  'Спортивная одежда': ['sportivnaya odezhda', 'sportivnaia odezhda'],
  'Ювелирные магазины': ['yuvelirnye magaziny', 'uvelirnye magaziny'],
  'Парки развлечений': ['parki razvlechenij', 'parki razvlecheniy'],
  'Детские развлечения': ['detskie razvlecheniya', 'detskie razvlecheniia'],
  'Мобильная связь': ['mobilnaya svyaz', 'mobilnaia sviaz'],
};

function cleanOcrArtifacts(value: string) {
  return value
    .split('')
    .map((char) => OCR_ARTIFACTS[char] ?? char)
    .join('');
}

function transliterateToLatin(value: string) {
  return value
    .toLowerCase()
    .split('')
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join('')
    .replace(/[^a-z0-9\s+%.-]/g, '');
}

function applyHomoglyphs(value: string) {
  return value
    .split('')
    .map((char) => LATIN_HOMOGLYPHS[char] ?? char)
    .join('');
}

function applyFingerprintFixes(value: string) {
  return value
    .split('')
    .map((char) => OCR_FINGERPRINT_FIXES[char] ?? char)
    .join('');
}

function toLatinFingerprint(value: string) {
  return applyFingerprintFixes(
    transliterateToLatin(cleanOcrArtifacts(applyHomoglyphs(value))),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

export { toLatinFingerprint };

function buildCategoryFingerprintAliases() {
  const aliases: Record<string, string[]> = {};

  for (const category of KNOWN_CATEGORIES) {
    const generated = toLatinFingerprint(category);
    const manual = MANUAL_CATEGORY_ALIASES[category] ?? [];

    aliases[category] = [...new Set([generated, ...manual].filter(Boolean))];
  }

  return aliases;
}

const CATEGORY_FINGERPRINT_ALIASES = buildCategoryFingerprintAliases();

function levenshtein(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  );

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function fuzzyScore(a: string, b: string) {
  if (!a || !b) {
    return Number.POSITIVE_INFINITY;
  }

  const distance = levenshtein(a, b);
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 0 : distance / maxLength;
}

const FUZZY_MATCH_THRESHOLD = 0.35;

type CategoryMatchCandidate = {
  category: string;
  score: number;
};

// Short OCR labels should map to general categories, not longer specific ones.
const GENERAL_CATEGORY_BY_FINGERPRINT: Record<string, string> = {
  tehnika: 'Техника',
  razvlecheniya: 'Развлечения',
  razvlecheniia: 'Развлечения',
  razvlechenij: 'Развлечения',
  razvlecheniy: 'Развлечения',
};

function compactFingerprint(value: string) {
  return value.replace(/\s+/g, '');
}

function scoreFingerprintMatch(input: string, alias: string): number | null {
  const compactInput = compactFingerprint(input);
  const compactAlias = compactFingerprint(alias);

  if (!compactInput || !compactAlias) {
    return null;
  }

  if (input === alias || compactInput === compactAlias) {
    return 0;
  }

  const fuzzy = Math.min(fuzzyScore(input, alias), fuzzyScore(compactInput, compactAlias));

  if (fuzzy > FUZZY_MATCH_THRESHOLD) {
    return null;
  }

  if (compactAlias.length > compactInput.length) {
    const aliasContainsInput =
      compactAlias.includes(compactInput) ||
      alias.includes(input) ||
      compactAlias.endsWith(compactInput);

    if (aliasContainsInput) {
      const lengthPenalty =
        ((compactAlias.length - compactInput.length) / compactInput.length) * 0.12;
      const adjustedScore = fuzzy + lengthPenalty;

      if (adjustedScore > FUZZY_MATCH_THRESHOLD) {
        return null;
      }

      return adjustedScore;
    }
  }

  return fuzzy;
}

function pickBestCategoryMatch(candidates: CategoryMatchCandidate[]) {
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => {
    if (left.score !== right.score) {
      return left.score - right.score;
    }

    return left.category.length - right.category.length;
  });

  return candidates[0]?.category ?? null;
}

function collectAliasMatches(fingerprint: string) {
  const candidates: CategoryMatchCandidate[] = [];

  for (const [category, aliases] of Object.entries(CATEGORY_FINGERPRINT_ALIASES)) {
    for (const alias of aliases) {
      const score = scoreFingerprintMatch(fingerprint, alias);

      if (score !== null) {
        candidates.push({ category, score });
      }
    }
  }

  return candidates;
}

function matchByAliases(fingerprint: string) {
  const compact = compactFingerprint(fingerprint);

  if (/tak/i.test(compact)) {
    return 'Яндекс Такси';
  }

  if (/lavk|jlabk|labka/i.test(compact)) {
    return 'Яндекс Лавка';
  }

  const generalCategory = GENERAL_CATEGORY_BY_FINGERPRINT[compact];
  if (generalCategory) {
    return generalCategory;
  }

  const aliasMatch = pickBestCategoryMatch(collectAliasMatches(fingerprint));
  if (aliasMatch) {
    return aliasMatch;
  }

  if (/^ra[z3].*v.{3,}/.test(compact)) {
    return 'Развлечения';
  }

  return null;
}

function matchKnownCategory(raw: string) {
  const fingerprint = toLatinFingerprint(raw);
  if (!fingerprint) {
    return null;
  }

  const aliasMatch = matchByAliases(fingerprint);
  if (aliasMatch) {
    return aliasMatch;
  }

  const candidates: CategoryMatchCandidate[] = [];

  for (const category of KNOWN_CATEGORIES) {
    const categoryFingerprint = toLatinFingerprint(category);
    const score = scoreFingerprintMatch(fingerprint, categoryFingerprint);

    if (score !== null) {
      candidates.push({ category, score });
    }
  }

  return pickBestCategoryMatch(candidates);
}

function capitalizeWords(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function prettifyMixedText(raw: string) {
  return capitalizeWords(cleanOcrArtifacts(applyHomoglyphs(raw.trim())));
}

export function normalizeOcrRussianText(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }

  const matchedCategory = matchKnownCategory(trimmed);
  if (matchedCategory) {
    return matchedCategory;
  }

  return prettifyMixedText(trimmed);
}

export function normalizeOcrLines(lines: string[]) {
  return lines.map((line) => normalizeOcrRussianText(line));
}

export { KNOWN_CATEGORIES };
