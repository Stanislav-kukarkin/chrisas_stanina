import type { CalendarDay } from '../models/calendar.model';
import type { ProductionCalendarApiDay } from './production-calendar.api';

export function mapApiDay(day: ProductionCalendarApiDay): CalendarDay {
  const isWorkingDay = day.type.is_working === 1;
  const isHoliday = day.type.id === 3 || day.type.id === 4;
  const isWeekend = day.type.id === 2 || day.type.id === 6;

  return {
    date: day.date,
    isWorkingDay,
    isHoliday,
    isWeekend,
    name: day.title ?? undefined,
  };
}

export function mapApiDays(days: ProductionCalendarApiDay[]): CalendarDay[] {
  return days.map(mapApiDay);
}
