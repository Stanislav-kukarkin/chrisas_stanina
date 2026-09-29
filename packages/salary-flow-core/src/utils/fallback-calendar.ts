import { eachDayOfInterval, endOfYear, format, getDay, startOfYear } from 'date-fns';
import type { CalendarDay, ProductionCalendar } from '../models/calendar.model';

/** Явный fallback: пн–пт рабочие, сб–вс выходные. */
export function buildFallbackCalendar(year: number, country = 'ru'): ProductionCalendar {
  const days = eachDayOfInterval({
    start: startOfYear(new Date(year, 0, 1)),
    end: endOfYear(new Date(year, 0, 1)),
  }).map((date): CalendarDay => {
    const dayOfWeek = getDay(date);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    return {
      date: format(date, 'yyyy-MM-dd'),
      isWorkingDay: !isWeekend,
      isHoliday: false,
      isWeekend,
    };
  });

  return { year, country, days, source: 'fallback' };
}
