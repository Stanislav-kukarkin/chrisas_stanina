import { ProductionCalendarService, type ProductionCalendar } from '@chrisasstanina/salary-flow-core';

const calendarService = new ProductionCalendarService();

export async function fetchProductionCalendar(year: number): Promise<ProductionCalendar> {
  return calendarService.getCalendar(year, 'ru');
}

export async function fetchAvailableProductionCalendar(): Promise<ProductionCalendar> {
  return calendarService.getAvailableCalendars('ru');
}
