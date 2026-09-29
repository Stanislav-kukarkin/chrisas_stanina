import type { ProductionCalendar } from '../models/calendar.model';
import { buildLocalCalendar, LOCAL_CALENDAR_YEARS } from '../data/local-calendars';
import { buildFallbackCalendar } from '../utils/fallback-calendar';

export class ProductionCalendarService {
  getCalendar(year: number, country = 'ru'): ProductionCalendar {
    const local = buildLocalCalendar(year, country);
    if (local) {
      return local;
    }

    return buildFallbackCalendar(year, country);
  }

  getAvailableCalendars(country = 'ru'): ProductionCalendar {
    const calendars = LOCAL_CALENDAR_YEARS.map((year) => this.getCalendar(year, country));
    return mergeProductionCalendars(calendars);
  }
}

export function mergeProductionCalendars(calendars: ProductionCalendar[]): ProductionCalendar {
  if (calendars.length === 0) {
    return buildFallbackCalendar(new Date().getFullYear());
  }

  const days = calendars
    .flatMap((calendar) => calendar.days)
    .sort((a, b) => a.date.localeCompare(b.date));

  const allLocal = calendars.every((calendar) => calendar.source === 'local');

  return {
    year: calendars[0].year,
    country: calendars[0].country,
    days,
    source: allLocal ? 'local' : 'fallback',
  };
}
