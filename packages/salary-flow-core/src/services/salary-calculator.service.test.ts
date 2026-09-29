import { describe, expect, it } from 'vitest';
import type { CalendarDay } from '../models/calendar.model';
import type { SalarySettings } from '../models/salary.model';
import { mapApiDay } from '../api/calendar.mapper';
import {
  buildSalaryProgressState,
  calculateDailyRate,
  calculateDayProgress,
  calculateEarnedToday,
  calculateHourlyRate,
  calculateMinuteRate,
  calculateRates,
  calculateSecondRate,
} from './salary-calculator.service';
import { getWorkdayPhase, resolveWorkdayContext } from './workday.service';
import { ProductionCalendarService } from './production-calendar.service';
import { getWorkDurationMinutes, parseTimeOnDate } from '../utils/time.utils';

function buildMonthWorkingDays(yearMonth: string, workingDates: string[]): CalendarDay[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const workingSet = new Set(workingDates);

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${yearMonth}-${String(day).padStart(2, '0')}`;
    const isWorkingDay = workingSet.has(date);
    return {
      date,
      isWorkingDay,
      isHoliday: !isWorkingDay && day % 7 === 0,
      isWeekend: !isWorkingDay,
    };
  });
}

const september2026WorkingDays = [
  '2026-09-01',
  '2026-09-02',
  '2026-09-03',
  '2026-09-04',
  '2026-09-07',
  '2026-09-08',
  '2026-09-09',
  '2026-09-10',
  '2026-09-11',
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
  '2026-09-17',
  '2026-09-18',
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
];

const settings: SalarySettings = {
  monthlySalary: 150_000,
  currency: 'RUB',
  workStart: '09:00',
  workEnd: '18:00',
  workEndsNextDay: false,
  lunchEnabled: true,
  lunchStart: '13:00',
  lunchDurationMinutes: 60,
  timezone: 'Europe/Moscow',
  visualizationType: 'money-jar',
  source: 'personal',
};

describe('SalaryCalculator rates', () => {
  it('calculates standard rates for 22 working days and 8 paid hours', () => {
    const daily = calculateDailyRate(150_000, 22);
    expect(daily).toBeCloseTo(6818.18, 2);

    const hourly = calculateHourlyRate(daily, 8);
    expect(hourly).toBeCloseTo(852.27, 2);

    const minute = calculateMinuteRate(hourly);
    expect(minute).toBeCloseTo(14.2, 2);

    const second = calculateSecondRate(hourly);
    expect(second).toBeCloseTo(0.2367, 4);
  });

  it('calculates higher daily rate for 20 working days', () => {
    const daily = calculateDailyRate(150_000, 20);
    expect(daily).toBeCloseTo(7500, 2);
  });
});

describe('SalaryCalculator earned today', () => {
  const calendarDays = buildMonthWorkingDays('2026-09', september2026WorkingDays);
  const dayInfo = calendarDays.find((day) => day.date === '2026-09-29')!;
  const rates = calculateRates(settings, 22);

  it('returns 0 before work start', () => {
    const beforeStart = parseTimeOnDate('2026-09-29', '08:30', settings.timezone).getTime();
    expect(calculateEarnedToday(settings, dayInfo, beforeStart, rates.daily)).toBe(0);
    expect(getWorkdayPhase(settings, dayInfo, beforeStart)).toBe('before');
  });

  it('returns about 50% at midday', () => {
    const midday = parseTimeOnDate('2026-09-29', '13:30', settings.timezone).getTime();
    const earned = calculateEarnedToday(settings, dayInfo, midday, rates.daily);
    expect(calculateDayProgress(earned, rates.daily)).toBeCloseTo(0.5, 1);
  });

  it('returns full daily rate after work end', () => {
    const afterWork = parseTimeOnDate('2026-09-29', '18:30', settings.timezone).getTime();
    const earned = calculateEarnedToday(settings, dayInfo, afterWork, rates.daily);
    expect(earned).toBeCloseTo(rates.daily, 2);
    expect(getWorkdayPhase(settings, dayInfo, afterWork)).toBe('after');
  });

  it('returns 0 on weekend', () => {
    const weekendDay: CalendarDay = {
      date: '2026-09-06',
      isWorkingDay: false,
      isHoliday: false,
      isWeekend: true,
    };
    const noon = parseTimeOnDate('2026-09-06', '12:00', settings.timezone).getTime();
    expect(calculateEarnedToday(settings, weekendDay, noon, rates.daily)).toBe(0);
    expect(getWorkdayPhase(settings, weekendDay, noon)).toBe('weekend');
  });

  it('pauses earning during lunch', () => {
    const atLunchStart = parseTimeOnDate('2026-09-29', '13:00', settings.timezone).getTime();
    const duringLunch = parseTimeOnDate('2026-09-29', '13:30', settings.timezone).getTime();
    const earnedAtLunchStart = calculateEarnedToday(settings, dayInfo, atLunchStart, rates.daily);
    const earnedDuring = calculateEarnedToday(settings, dayInfo, duringLunch, rates.daily);
    expect(getWorkdayPhase(settings, dayInfo, duringLunch)).toBe('lunch');
    expect(earnedDuring).toBeCloseTo(earnedAtLunchStart, 2);
  });
});

describe('overnight shift', () => {
  const overnightSettings: SalarySettings = {
    ...settings,
    workStart: '22:00',
    workEnd: '06:00',
    workEndsNextDay: true,
    lunchEnabled: false,
  };

  const calendarDays = buildMonthWorkingDays('2026-09', september2026WorkingDays);
  const monday = calendarDays.find((day) => day.date === '2026-09-29')!;
  const tuesday = calendarDays.find((day) => day.date === '2026-09-30')!;

  it('calculates 8 paid hours for overnight shift', () => {
    expect(getWorkDurationMinutes(overnightSettings)).toBe(8 * 60);
  });

  it('counts earnings on previous calendar day after midnight', () => {
    const afterMidnight = parseTimeOnDate('2026-09-30', '02:00', overnightSettings.timezone).getTime();
    const context = resolveWorkdayContext(overnightSettings, calendarDays, afterMidnight);
    const rates = calculateRates(overnightSettings, 22);

    expect(context.isOvernightTail).toBe(true);
    expect(context.dateIso).toBe('2026-09-29');
    expect(getWorkdayPhase(overnightSettings, monday, afterMidnight, context.dateIso)).toBe('working');

    const earned = calculateEarnedToday(
      overnightSettings,
      monday,
      afterMidnight,
      rates.daily,
      context.dateIso,
    );
    expect(calculateDayProgress(earned, rates.daily)).toBeCloseTo(0.5, 1);
  });

  it('marks new shift as before start on next evening', () => {
    const nextEvening = parseTimeOnDate('2026-09-30', '21:00', overnightSettings.timezone).getTime();
    expect(getWorkdayPhase(overnightSettings, tuesday, nextEvening)).toBe('before');
  });
});

describe('buildSalaryProgressState', () => {
  it('builds month progress state', () => {
    const calendar = {
      year: 2026,
      country: 'ru',
      source: 'api' as const,
      days: buildMonthWorkingDays('2026-09', september2026WorkingDays),
    };
    const timestamp = parseTimeOnDate('2026-09-29', '14:32', settings.timezone).getTime();
    const state = buildSalaryProgressState(settings, calendar, timestamp);

    expect(state.workdayPhase).toBe('working');
    expect(state.progress).toBeGreaterThan(0.5);
    expect(state.progress).toBeLessThan(1);
    expect(state.workingDaysInMonth).toBe(22);
    expect(state.workingDaysCompleted).toBeGreaterThan(0);
    expect(state.monthProgress).toBeGreaterThan(0);
    expect(state.monthProgress).toBeLessThanOrEqual(1);
  });
});

describe('available calendars', () => {
  it('includes all days for January 2027 when merging local years', () => {
    const service = new ProductionCalendarService();
    const calendar = service.getAvailableCalendars('ru');
    const january2027 = calendar.days.filter((day) => day.date.startsWith('2027-01'));

    expect(january2027).toHaveLength(31);
    expect(january2027.find((day) => day.date === '2027-01-01')?.isHoliday).toBe(true);
    expect(january2027.find((day) => day.date === '2027-01-11')?.isWorkingDay).toBe(true);
  });
});

describe('calendar mapper', () => {
  it('maps API day types to CalendarDay', () => {
    expect(
      mapApiDay({
        date: '2026-01-01',
        type: { id: 3, name: 'Государственный праздник', is_working: 0 },
        title: 'Новогодние каникулы',
        working_hours: 0,
      }),
    ).toEqual({
      date: '2026-01-01',
      isWorkingDay: false,
      isHoliday: true,
      isWeekend: false,
      name: 'Новогодние каникулы',
    });

    expect(
      mapApiDay({
        date: '2026-01-12',
        type: { id: 1, name: 'Рабочий день', is_working: 1 },
        title: null,
        working_hours: 8,
      }).isWorkingDay,
    ).toBe(true);
  });
});
