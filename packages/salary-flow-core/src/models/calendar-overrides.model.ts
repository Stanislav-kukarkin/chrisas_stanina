import type { CalendarDay } from './calendar.model';

export interface CalendarOverridesFile {
  year: number;
  days: CalendarDay[];
}
