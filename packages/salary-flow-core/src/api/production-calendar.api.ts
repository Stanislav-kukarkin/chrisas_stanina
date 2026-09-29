import type { CalendarDay } from '../models/calendar.model';

export interface ProductionCalendarApiDay {
  date: string;
  type: {
    id: number;
    name: string;
    is_working: 0 | 1;
  };
  title: string | null;
  working_hours: number;
}

export interface ProductionCalendarApiResponse {
  status: string;
  days: ProductionCalendarApiDay[];
}

export interface ProductionCalendarApi {
  fetchCalendar(year: number, country?: string): Promise<ProductionCalendarApiResponse>;
}

export class ProductionCalendarApiError extends Error {
  constructor(
    public status: number,
    message?: string,
  ) {
    super(message ?? `Production calendar API error: ${status}`);
    this.name = 'ProductionCalendarApiError';
  }
}

export type { CalendarDay };
