import type { CalendarDay } from '../models/calendar.model';
import { buildFallbackCalendar } from './fallback-calendar';

/** База пн–пт + overrides для праздников, переносов и рабочих суббот. */
export function mergeBaseWithOverrides(year: number, overrides: CalendarDay[]): CalendarDay[] {
  const baseDays = buildFallbackCalendar(year).days;
  const overrideMap = new Map(overrides.map((day) => [day.date, day]));

  return baseDays.map((day) => {
    const override = overrideMap.get(day.date);
    if (!override) {
      return day;
    }

    return {
      date: day.date,
      isWorkingDay: override.isWorkingDay,
      isHoliday: override.isHoliday,
      isWeekend: override.isWeekend,
      name: override.name,
    };
  });
}
