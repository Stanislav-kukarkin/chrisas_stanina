import calendar2026 from '../../data/2026.json';
import calendar2027 from '../../data/2027.json';
import type { CalendarOverridesFile } from '../models/calendar-overrides.model';
import type { ProductionCalendar } from '../models/calendar.model';
import { mergeBaseWithOverrides } from '../utils/calendar-merge';

const LOCAL_CALENDAR_OVERRIDES: Record<number, CalendarOverridesFile> = {
  2026: calendar2026 as CalendarOverridesFile,
  2027: calendar2027 as CalendarOverridesFile,
};

export const LOCAL_CALENDAR_YEARS = Object.keys(LOCAL_CALENDAR_OVERRIDES)
  .map(Number)
  .sort((a, b) => a - b);

const minYear = LOCAL_CALENDAR_YEARS[0] ?? new Date().getFullYear();
const maxYear = LOCAL_CALENDAR_YEARS[LOCAL_CALENDAR_YEARS.length - 1] ?? minYear;

/** Первый доступный месяц (YYYY-MM). */
export const LOCAL_CALENDAR_MIN_MONTH = `${minYear}-01`;
/** Последний доступный месяц (YYYY-MM). */
export const LOCAL_CALENDAR_MAX_MONTH = `${maxYear}-12`;

export function isYearMonthInLocalCalendarRange(yearMonth: string): boolean {
  return yearMonth >= LOCAL_CALENDAR_MIN_MONTH && yearMonth <= LOCAL_CALENDAR_MAX_MONTH;
}

export function clampYearMonth(yearMonth: string): string {
  if (yearMonth < LOCAL_CALENDAR_MIN_MONTH) {
    return LOCAL_CALENDAR_MIN_MONTH;
  }
  if (yearMonth > LOCAL_CALENDAR_MAX_MONTH) {
    return LOCAL_CALENDAR_MAX_MONTH;
  }
  return yearMonth;
}

export function hasLocalCalendar(year: number): boolean {
  return year in LOCAL_CALENDAR_OVERRIDES;
}

export function buildLocalCalendar(year: number, country = 'ru'): ProductionCalendar | null {
  const overridesFile = LOCAL_CALENDAR_OVERRIDES[year];
  if (!overridesFile) {
    return null;
  }

  return {
    year,
    country,
    days: mergeBaseWithOverrides(year, overridesFile.days),
    source: 'local',
  };
}
