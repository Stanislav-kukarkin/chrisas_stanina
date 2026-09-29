import { describe, expect, it } from 'vitest';
import { formatWorkingDays, pluralizeRu } from './plural.utils';

describe('pluralizeRu', () => {
  it('uses singular form for 1, 21, 101', () => {
    expect(pluralizeRu(1, 'день', 'дня', 'дней')).toBe('день');
    expect(pluralizeRu(21, 'день', 'дня', 'дней')).toBe('день');
    expect(pluralizeRu(101, 'день', 'дня', 'дней')).toBe('день');
  });

  it('uses few form for 2-4 and 22-24', () => {
    expect(pluralizeRu(2, 'день', 'дня', 'дней')).toBe('дня');
    expect(pluralizeRu(22, 'день', 'дня', 'дней')).toBe('дня');
    expect(pluralizeRu(24, 'день', 'дня', 'дней')).toBe('дня');
  });

  it('uses many form for 5-20 and 25-30', () => {
    expect(pluralizeRu(5, 'день', 'дня', 'дней')).toBe('дней');
    expect(pluralizeRu(11, 'день', 'дня', 'дней')).toBe('дней');
    expect(pluralizeRu(25, 'день', 'дня', 'дней')).toBe('дней');
  });
});

describe('formatWorkingDays', () => {
  it('formats common month values correctly', () => {
    expect(formatWorkingDays(1)).toBe('1 рабочий день');
    expect(formatWorkingDays(22)).toBe('22 рабочих дня');
    expect(formatWorkingDays(20)).toBe('20 рабочих дней');
    expect(formatWorkingDays(21)).toBe('21 рабочий день');
  });
});
