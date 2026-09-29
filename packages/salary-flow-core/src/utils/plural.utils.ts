/** Склонение по правилам русского языка: 1 / 2-4 / 5+. */
export function pluralizeRu(count: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(count));
  const mod10 = abs % 10;
  const mod100 = abs % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return few;
  }
  return many;
}

export function formatWorkingDays(count: number): string {
  const word = pluralizeRu(count, 'рабочий день', 'рабочих дня', 'рабочих дней');
  return `${count} ${word}`;
}
