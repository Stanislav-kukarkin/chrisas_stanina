export function getCurrencyFractionDigits(currency: string): number {
  return currency === 'RUB' ? 0 : 2;
}

export function formatCurrency(
  value: number,
  currency: string,
  fractionDigits = getCurrencyFractionDigits(currency),
): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatRate(value: number, currency: string, unit: string, fractionDigits = 2): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  const formatted = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);

  return `${formatted} / ${unit}`;
}

export function getRateFractionDigits(value: number): number {
  if (value >= 1) {
    return 2;
  }
  if (value >= 0.01) {
    return 4;
  }
  return 6;
}
