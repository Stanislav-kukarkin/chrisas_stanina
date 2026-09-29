export interface CalendarDay {
  date: string;
  isWorkingDay: boolean;
  isHoliday: boolean;
  isWeekend: boolean;
  name?: string;
}

export type CalendarSource = 'local' | 'fallback';

export interface ProductionCalendar {
  year: number;
  country: string;
  days: CalendarDay[];
  source: CalendarSource;
}
