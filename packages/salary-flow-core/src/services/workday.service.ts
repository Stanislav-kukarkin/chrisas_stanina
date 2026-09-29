import { addDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { CalendarDay } from '../models/calendar.model';
import type { SalarySettings } from '../models/salary.model';
import type { WorkdayPhase } from '../models/workday.model';
import {
  calculateTotalPaidMs,
  getDateIsoInTimezone,
  isTimestampInWorkWindow,
  parseTimeOnDate,
  parseWorkEndOnDate,
} from '../utils/time.utils';

export interface WorkdayContext {
  dateIso: string;
  dayInfo: CalendarDay | undefined;
  isOvernightTail: boolean;
}

export function getDayInfo(days: CalendarDay[], dateIso: string): CalendarDay | undefined {
  return days.find((day) => day.date === dateIso);
}

export function countWorkingDaysInMonth(days: CalendarDay[], yearMonth: string): number {
  return days.filter((day) => day.date.startsWith(yearMonth) && day.isWorkingDay).length;
}

export function findNextWorkingDay(days: CalendarDay[], fromDateIso: string): string | undefined {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.find((day) => day.date > fromDateIso && day.isWorkingDay)?.date;
}

export function resolveWorkdayContext(
  settings: SalarySettings,
  days: CalendarDay[],
  timestamp: number,
): WorkdayContext {
  const todayIso = getDateIsoInTimezone(timestamp, settings.timezone);

  if (settings.workEndsNextDay) {
    const yesterdayIso = format(addDays(parseISO(todayIso), -1), 'yyyy-MM-dd');
    const yesterdayInfo = getDayInfo(days, yesterdayIso);
    if (
      yesterdayInfo?.isWorkingDay &&
      isTimestampInWorkWindow(timestamp, yesterdayIso, settings)
    ) {
      return { dateIso: yesterdayIso, dayInfo: yesterdayInfo, isOvernightTail: true };
    }
  }

  return {
    dateIso: todayIso,
    dayInfo: getDayInfo(days, todayIso),
    isOvernightTail: false,
  };
}

export function getWorkdayPhase(
  settings: SalarySettings,
  dayInfo: CalendarDay | undefined,
  timestamp: number,
  dateIso?: string,
): WorkdayPhase {
  if (!dayInfo) {
    return 'weekend';
  }

  if (dayInfo.isHoliday) {
    return 'holiday';
  }

  if (!dayInfo.isWorkingDay) {
    return 'weekend';
  }

  const workDateIso = dateIso ?? getDateIsoInTimezone(timestamp, settings.timezone);
  const now = new Date(timestamp);
  const workStart = parseTimeOnDate(workDateIso, settings.workStart, settings.timezone);
  const workEnd = parseWorkEndOnDate(workDateIso, settings);

  if (now < workStart) {
    return 'before';
  }

  if (now >= workEnd) {
    return 'after';
  }

  if (settings.lunchEnabled) {
    const lunchStart = parseTimeOnDate(workDateIso, settings.lunchStart, settings.timezone);
    const lunchEnd = new Date(lunchStart.getTime() + settings.lunchDurationMinutes * 60_000);
    if (now >= lunchStart && now < lunchEnd) {
      return 'lunch';
    }
  }

  return 'working';
}

export function getTimeUntilWorkStartMs(settings: SalarySettings, timestamp: number): number {
  const todayIso = getDateIsoInTimezone(timestamp, settings.timezone);
  const workStart = parseTimeOnDate(todayIso, settings.workStart, settings.timezone);
  if (new Date(timestamp) >= workStart) {
    return 0;
  }
  return Math.max(0, workStart.getTime() - timestamp);
}

export function getTimeUntilWorkEndMs(
  settings: SalarySettings,
  timestamp: number,
  dateIso?: string,
): number {
  const workDateIso = dateIso ?? getDateIsoInTimezone(timestamp, settings.timezone);
  const workEnd = parseWorkEndOnDate(workDateIso, settings);
  return Math.max(0, workEnd.getTime() - timestamp);
}

export function countCompletedWorkingDays(
  days: CalendarDay[],
  yearMonth: string,
  todayIso: string,
): number {
  return days.filter(
    (day) => day.date.startsWith(yearMonth) && day.isWorkingDay && day.date < todayIso,
  ).length;
}

export function formatRussianDate(dateIso: string): string {
  return format(parseISO(dateIso), 'EEEE, d MMMM', { locale: ru });
}

export function getWeekDays(days: CalendarDay[], anchorDateIso: string): CalendarDay[] {
  const anchor = parseISO(anchorDateIso);
  const dayOfWeek = anchor.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = addDays(anchor, mondayOffset);
  const weekDates = Array.from({ length: 7 }, (_, index) =>
    format(addDays(monday, index), 'yyyy-MM-dd'),
  );
  const dayMap = new Map(days.map((day) => [day.date, day]));

  return weekDates.map(
    (date) =>
      dayMap.get(date) ?? {
        date,
        isWorkingDay: false,
        isHoliday: false,
        isWeekend: true,
      },
  );
}

export function getTotalPaidMsForDay(settings: SalarySettings, dateIso: string): number {
  return calculateTotalPaidMs(dateIso, settings);
}
