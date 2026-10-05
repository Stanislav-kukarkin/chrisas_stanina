import { normalizeOcrRussianText } from './normalize-ocr-russian';

export type ParsedCashback = {
  title: string;
  value: string;
  confidence: number;
};

export type OcrWord = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

type OcrRow = {
  words: OcrWord[];
  top: number;
  bottom: number;
  centerY: number;
};

type PercentAnchor = {
  words: OcrWord[];
  row: OcrRow;
  value: string;
  centerX: number;
  left: number;
  right: number;
};

type AnchorColumn = { anchors: PercentAnchor[]; centerX: number };

const NOISE_PATTERNS = [
  /^закрыть$/iu,
  /^уже выбрано$/iu,
  /подсказки/iu,
  /условия программы/iu,
  /зарплатным клиентам/iu,
  /ещё\s+\d+\s+дн/iu,
  /не суммируется/iu,
  /изменить можно/iu,
  /ваши\s+\d+\s+категор/iu,
  /повышенный кешбэк/iu,
  /кешбэк при оплате/iu,
  /кешбэк в яндекс/iu,
  /за золотой уровень/iu,
  /своих плюсов/iu,
  /промокод/iu,
  /prime/iu,
  /на покупки от/iu,
  /покупки от\s+\d/iu,
  /от\s+\d[\d\s.,]*\s*₽/iu,
  /выберите категори/iu,
  /условия кешбэк/iu,
  /^\d{1,2}:\d{2}$/u,
  /^[\d\s]+₽/u,
  /^[iℹ?？✓✔□■▪▫]+$/u,
];

const PERCENT_PATTERN = /(\d+[,.]?\d*)\s*%/u;
const MIN_CONFIDENCE = 10;

function normalizeLine(line: string) {
  return line.replace(/\s+/g, ' ').trim();
}

function isNoise(line: string) {
  if (!line || line.length < 3) {
    return true;
  }

  return NOISE_PATTERNS.some((pattern) => pattern.test(line));
}

function capitalizeTitle(title: string) {
  if (!title) {
    return title;
  }

  return title.charAt(0).toUpperCase() + title.slice(1);
}

function normalizePercent(value: string) {
  const number = Number(value.replace(',', '.'));
  if (!Number.isFinite(number) || number <= 0 || number > 100) {
    return null;
  }

  return `${Number.isInteger(number) ? number : number.toString()}%`;
}

function parseLine(line: string): ParsedCashback | null {
  const normalized = normalizeLine(line);

  if (isNoise(normalized) || !normalized.includes('%')) {
    return null;
  }

  const percentMatch = normalized.match(PERCENT_PATTERN);
  if (!percentMatch) {
    return null;
  }

  const value = normalizePercent(percentMatch[1]);
  if (!value) {
    return null;
  }
  let title = normalized
    .replace(PERCENT_PATTERN, ' ')
    .replace(/\+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title || title.length < 2 || isNoise(title)) {
    return null;
  }

  title = capitalizeTitle(normalizeOcrRussianText(title));

  return { title, value, confidence: 55 };
}

function parseAdjacentLines(first: string, second: string): ParsedCashback | null {
  const percentFirst = parseLine(first);
  if (percentFirst) {
    return percentFirst;
  }

  const current = normalizeLine(first);
  const next = normalizeLine(second);
  const percentMatch = next.match(PERCENT_PATTERN);

  if (!percentMatch || PERCENT_PATTERN.test(current) || isNoise(current) || isNoise(next)) {
    return null;
  }

  const value = normalizePercent(percentMatch[1]);
  if (!value) {
    return null;
  }

  return {
    title: capitalizeTitle(normalizeOcrRussianText(current)),
    value,
    confidence: 45,
  };
}

export function parseCashbackLines(lines: string[]): ParsedCashback[] {
  const normalizedLines = lines.map(normalizeLine).filter(Boolean);
  const parsed: ParsedCashback[] = [];
  const seen = new Set<string>();

  const addItem = (item: ParsedCashback | null) => {
    if (!item) {
      return;
    }

    const key = `${item.title.toLowerCase()}|${item.value}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    parsed.push(item);
  };

  for (const line of normalizedLines) {
    addItem(parseLine(line));
  }

  for (let index = 0; index < normalizedLines.length - 1; index += 1) {
    addItem(parseAdjacentLines(normalizedLines[index], normalizedLines[index + 1]));
  }

  return parsed;
}

export function parseCashbackText(text: string): ParsedCashback[] {
  return parseCashbackLines(text.split('\n'));
}

function wordHeight(word: OcrWord) {
  return Math.max(1, word.bbox.y1 - word.bbox.y0);
}

function wordCenterY(word: OcrWord) {
  return (word.bbox.y0 + word.bbox.y1) / 2;
}

function validWords(words: OcrWord[]) {
  return words.filter((word) => {
    const text = normalizeLine(word.text);
    return text.length > 0 && word.confidence >= MIN_CONFIDENCE &&
      word.bbox.x1 > word.bbox.x0 && word.bbox.y1 > word.bbox.y0;
  });
}

function groupIntoRows(words: OcrWord[]): OcrRow[] {
  const sorted = [...words].sort((left, right) => wordCenterY(left) - wordCenterY(right));
  const rows: OcrRow[] = [];

  for (const word of sorted) {
    const centerY = wordCenterY(word);
    const height = wordHeight(word);
    const row = rows.find((candidate) => {
      const candidateHeight = Math.max(1, candidate.bottom - candidate.top);
      const verticalOverlap = Math.max(0, Math.min(candidate.bottom, word.bbox.y1) - Math.max(candidate.top, word.bbox.y0));
      const overlapRatio = verticalOverlap / Math.min(candidateHeight, height);
      const centerTolerance = Math.max(4, Math.min(candidateHeight, height) * 0.38);
      return overlapRatio >= 0.28 || Math.abs(candidate.centerY - centerY) <= centerTolerance;
    });

    if (!row) {
      rows.push({ words: [word], top: word.bbox.y0, bottom: word.bbox.y1, centerY });
      continue;
    }

    row.words.push(word);
    row.top = Math.min(row.top, word.bbox.y0);
    row.bottom = Math.max(row.bottom, word.bbox.y1);
    row.centerY = row.words.reduce((sum, entry) => sum + wordCenterY(entry), 0) / row.words.length;
  }

  return rows
    .map((row) => ({ ...row, words: [...row.words].sort((left, right) => left.bbox.x0 - right.bbox.x0) }))
    .sort((left, right) => left.centerY - right.centerY);
}

function percentToken(text: string) {
  const match = normalizeLine(text).match(/^(\d{1,3}(?:[,.]\d{1,2})?)%?$/u);
  if (!match) {
    return null;
  }

  return normalizePercent(match[1]);
}

function findPercentAnchors(rows: OcrRow[]): PercentAnchor[] {
  const anchors: PercentAnchor[] = [];

  rows.forEach((row) => {
    const sorted = [...row.words].sort((left, right) => left.bbox.x0 - right.bbox.x0);
    const consumed = new Set<OcrWord>();

    sorted.forEach((word, index) => {
      if (consumed.has(word)) return;
      const attachedPercent = normalizeLine(word.text).match(/^(\d{1,3}(?:[,.]\d{1,2})?)%$/u);
      let value = attachedPercent ? normalizePercent(attachedPercent[1]) : null;
      let anchorWords = [word];

      if (!value) {
        value = percentToken(word.text);
        const next = sorted[index + 1];
        if (value && next && /^%$/u.test(normalizeLine(next.text))) {
          const gap = next.bbox.x0 - word.bbox.x1;
          if (gap <= Math.max(wordHeight(word), wordHeight(next)) * 1.3) {
            anchorWords = [word, next];
            consumed.add(next);
          }
        } else if (value) {
          // A bare number is only a cashback rate when a percent sign was
          // recognized separately on the same visual line.
          value = null;
        }
      }

      if (!value) return;
      consumed.add(word);
      const left = Math.min(...anchorWords.map((entry) => entry.bbox.x0));
      const right = Math.max(...anchorWords.map((entry) => entry.bbox.x1));
      anchors.push({ words: anchorWords, row, value, left, right, centerX: (left + right) / 2 });
    });
  });

  return anchors;
}

function clusterAnchors(anchors: PercentAnchor[], pageWidth: number): AnchorColumn[] {
  const sorted = [...anchors].sort((left, right) => left.centerX - right.centerX);
  const columns: AnchorColumn[] = [];
  const maxWithinColumnGap = Math.max(24, pageWidth * 0.16);

  sorted.forEach((anchor) => {
    const column = columns.at(-1);
    if (!column || anchor.centerX - column.centerX > maxWithinColumnGap) {
      columns.push({ anchors: [anchor], centerX: anchor.centerX });
      return;
    }

    column.anchors.push(anchor);
    column.centerX = column.anchors.reduce((sum, item) => sum + item.centerX, 0) / column.anchors.length;
  });

  return columns;
}

function getColumnBounds(columns: AnchorColumn[], index: number, pageWidth: number) {
  const previous = columns[index - 1];
  const next = columns[index + 1];
  return {
    left: previous ? (previous.centerX + columns[index].centerX) / 2 : 0,
    right: next ? (columns[index].centerX + next.centerX) / 2 : pageWidth,
  };
}

function isPercentOrJunkWord(word: OcrWord) {
  const text = normalizeLine(word.text);
  return percentToken(text) !== null || /^[%?？✓✔□■▪▫•·…—–-]+$/u.test(text) || !/[a-zа-яё]/iu.test(text);
}

function candidateTitle(words: OcrWord[]) {
  const candidateWords = words
    .filter((word) => !isPercentOrJunkWord(word))
    .filter((word) => !NOISE_PATTERNS.some((pattern) => pattern.test(normalizeLine(word.text))));
  const raw = normalizeLine(candidateWords.map((word) => word.text).join(' '))
    .replace(/^[^a-zа-яё0-9]+|[^a-zа-яё0-9]+$/giu, '')
    .replace(/[|_]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

  if (!raw || raw.length < 3 || /\d|₽|руб/iu.test(raw) || isNoise(raw) || !/[a-zа-яё]{2}/iu.test(raw)) {
    return null;
  }

  const title = capitalizeTitle(normalizeOcrRussianText(raw));
  if (isNoise(title)) return null;

  return { title, words: candidateWords };
}

function wordsInsideColumn(row: OcrRow, left: number, right: number) {
  return row.words.filter((word) => {
    const centerX = (word.bbox.x0 + word.bbox.x1) / 2;
    return centerX >= left && centerX <= right;
  });
}

function findTitleForAnchor(
  anchor: PercentAnchor,
  rows: OcrRow[],
  bounds: { left: number; right: number },
  pageHeight: number,
) {
  const sameRow = wordsInsideColumn(anchor.row, bounds.left, bounds.right);
  const toRight = sameRow.filter((word) => word.bbox.x0 >= anchor.right - Math.max(2, wordHeight(word) * 0.12));
  const sameRowTitle = candidateTitle(toRight);
  if (sameRowTitle) {
    return { ...sameRowTitle, distance: 0, sameRow: true };
  }

  const toLeft = sameRow.filter((word) => word.bbox.x1 <= anchor.left + Math.max(2, wordHeight(word) * 0.12));
  const titleBeforePercent = candidateTitle(toLeft);
  if (titleBeforePercent) {
    return { ...titleBeforePercent, distance: 0, sameRow: true };
  }

  const anchorHeight = Math.max(...anchor.words.map(wordHeight));
  const maximumDistance = Math.min(pageHeight * 0.18, Math.max(anchorHeight * 2.7, pageHeight * 0.075));
  const nearbyRows = rows
    .filter((row) => row.centerY > anchor.row.centerY + anchorHeight * 0.35)
    .filter((row) => row.centerY - anchor.row.centerY <= maximumDistance)
    .sort((left, right) => left.centerY - right.centerY);

  for (const row of nearbyRows) {
    const title = candidateTitle(wordsInsideColumn(row, bounds.left, bounds.right));
    if (title) {
      return { ...title, distance: row.centerY - anchor.row.centerY, sameRow: false };
    }
  }

  return null;
}

/**
 * Parse offers by their visual layout: a percentage is paired with a title on
 * the same row or the closest text row underneath it, within the same column.
 */
export function parseCashbackWords(input: OcrWord[]): ParsedCashback[] {
  const words = validWords(input);
  if (!words.length) return [];

  const rows = groupIntoRows(words);
  const anchors = findPercentAnchors(rows);
  if (!anchors.length) return [];

  const pageWidth = Math.max(...words.map((word) => word.bbox.x1));
  const pageHeight = Math.max(...words.map((word) => word.bbox.y1));
  const columns = clusterAnchors(anchors, pageWidth);
  const positioned: Array<{ entry: ParsedCashback; y: number; x: number }> = [];
  const seen = new Set<string>();

  columns.forEach((column, columnIndex) => {
    const bounds = getColumnBounds(columns, columnIndex, pageWidth);
    column.anchors
      .sort((left, right) => left.row.centerY - right.row.centerY)
      .forEach((anchor) => {
        const title = findTitleForAnchor(anchor, rows, bounds, pageHeight);
        if (!title) return;

        const confidenceWords = [...anchor.words, ...title.words];
        const ocrConfidence = confidenceWords.reduce((sum, word) => sum + word.confidence, 0) / confidenceWords.length;
        const proximityPenalty = title.sameRow ? 0 : Math.min(15, title.distance / Math.max(1, pageHeight) * 100);
        const confidence = Math.max(0, Math.min(100, Math.round(ocrConfidence * 0.78 + (title.sameRow ? 22 : 14) - proximityPenalty)));
        const key = `${title.title.toLocaleLowerCase()}|${anchor.value}`;
        if (seen.has(key)) return;

        seen.add(key);
        positioned.push({
          entry: { title: title.title, value: anchor.value, confidence },
          y: anchor.row.centerY,
          x: anchor.centerX,
        });
      });
  });

  return positioned
    .sort((left, right) => left.y - right.y || left.x - right.x)
    .map(({ entry }) => entry);
}

export function dedupeCashbacks(items: ParsedCashback[]): ParsedCashback[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.title.toLowerCase()}|${item.value}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
