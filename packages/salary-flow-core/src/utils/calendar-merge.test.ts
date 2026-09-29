import { describe, expect, it } from 'vitest';
import { mergeBaseWithOverrides } from './calendar-merge';

describe('mergeBaseWithOverrides', () => {
  it('keeps regular weekdays as working days', () => {
    const days = mergeBaseWithOverrides(2026, []);
    const jan12 = days.find((day) => day.date === '2026-01-12');
    expect(jan12?.isWorkingDay).toBe(true);
    expect(jan12?.isHoliday).toBe(false);
  });

  it('applies holiday override on weekday', () => {
    const days = mergeBaseWithOverrides(2026, [
      {
        date: '2026-02-23',
        isWorkingDay: false,
        isHoliday: true,
        isWeekend: false,
        name: 'День защитника Отечества',
      },
    ]);
    const feb23 = days.find((day) => day.date === '2026-02-23');
    expect(feb23?.isWorkingDay).toBe(false);
    expect(feb23?.isHoliday).toBe(true);
    expect(feb23?.name).toBe('День защитника Отечества');
  });

  it('applies working saturday override', () => {
    const days = mergeBaseWithOverrides(2027, [
      {
        date: '2027-02-20',
        isWorkingDay: true,
        isHoliday: false,
        isWeekend: false,
        name: 'Рабочая суббота',
      },
    ]);
    const saturday = days.find((day) => day.date === '2027-02-20');
    expect(saturday?.isWorkingDay).toBe(true);
    expect(saturday?.isWeekend).toBe(false);
  });

  it('builds full year length', () => {
    expect(mergeBaseWithOverrides(2026, [])).toHaveLength(365);
    expect(mergeBaseWithOverrides(2024, [])).toHaveLength(366);
  });
});
