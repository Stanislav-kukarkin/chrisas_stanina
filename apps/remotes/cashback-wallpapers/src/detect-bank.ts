const BANK_PATTERNS = [
  { pattern: /альфа|alfa/i, name: 'Альфа-Банк' },
  { pattern: /т[-\s]?банк|tinkoff|тинькофф/i, name: 'Т-Банк' },
  { pattern: /\bвтб\b|vtb/i, name: 'ВТБ' },
  { pattern: /яндекс\s*банк|yandex\s*bank/i, name: 'Яндекс Банк' },
  {
    pattern: /сво[иi]\s*плюс|своих\s*плюсов|svoi\s*plus|cbou\s*plus|cbon\s*plus|svoih\s*plusov/i,
    name: 'Яндекс',
  },
  // A cashback category such as “Яндекс Лавка” is not evidence that the
  // screenshot belongs to Яндекс Банк. Keep this match explicit to avoid
  // assigning a merchant name as the bank.
  { pattern: /сбербанк|\bsber\b/i, name: 'Сбербанк' },
  { pattern: /райффайзен|raiffeisen/i, name: 'Райффайзен' },
  { pattern: /газпром/i, name: 'Газпромбанк' },
  { pattern: /открытие/i, name: 'Открытие' },
  { pattern: /совком/i, name: 'Совкомбанк' },
];

export function detectBankName(lines: string[], fingerprintText?: string): string {
  const text = lines.join(' ');
  const sources = [text, fingerprintText].filter(Boolean) as string[];

  for (const source of sources) {
    for (const bank of BANK_PATTERNS) {
      if (bank.pattern.test(source)) {
        return bank.name;
      }
    }
  }

  return '';
}
