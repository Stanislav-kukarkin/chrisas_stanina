import { TZDate } from '@date-fns/tz';
import { addDays, addMinutes, format, parseISO } from 'date-fns';

export function parseTimeOnDate(dateIso: string, time: string, timezone: string): Date {
  const [year, month, day] = dateIso.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new TZDate(year, month - 1, day, hours, minutes, 0, 0, timezone);
}

export function getDateIsoInTimezone(timestamp: number, timezone: string): string {
  const date = new TZDate(timestamp, timezone);
  return format(date, 'yyyy-MM-dd');
}

export function getZonedDate(timestamp: number, timezone: string): Date {
  return new TZDate(timestamp, timezone);
}

export function addMinutesToTime(time: string, minutesToAdd: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  const base = new Date(2000, 0, 1, hours, minutes, 0, 0);
  return format(addMinutes(base, minutesToAdd), 'HH:mm');
}

export function timeToMinutes(time: string): number {
  if (!time.includes(':')) {
    return 0;
  }
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }
  return hours * 60 + minutes;
}

export function getWorkEndDateIso(dateIso: string, settings: { workEndsNextDay: boolean }): string {
  if (!settings.workEndsNextDay) {
    return dateIso;
  }
  return format(addDays(parseISO(dateIso), 1), 'yyyy-MM-dd');
}

export function parseWorkEndOnDate(
  dateIso: string,
  settings: { workEnd: string; workEndsNextDay: boolean; timezone: string },
): Date {
  const endDateIso = getWorkEndDateIso(dateIso, settings);
  return parseTimeOnDate(endDateIso, settings.workEnd, settings.timezone);
}

export function getWorkDurationMinutes(settings: {
  workStart: string;
  workEnd: string;
  workEndsNextDay: boolean;
  lunchEnabled: boolean;
  lunchDurationMinutes: number;
}): number {
  const start = timeToMinutes(settings.workStart);
  const end = timeToMinutes(settings.workEnd);
  if (!settings.workStart || !settings.workEnd) {
    return 0;
  }
  const gross = settings.workEndsNextDay ? 24 * 60 - start + end : end - start;
  const lunch = settings.lunchEnabled ? settings.lunchDurationMinutes : 0;
  return Math.max(0, gross - lunch);
}

export function getPaidHoursPerDay(settings: {
  workStart: string;
  workEnd: string;
  workEndsNextDay: boolean;
  lunchEnabled: boolean;
  lunchDurationMinutes: number;
}): number {
  return getWorkDurationMinutes(settings) / 60;
}

export function getPaidIntervals(
  dateIso: string,
  settings: {
    workStart: string;
    workEnd: string;
    workEndsNextDay: boolean;
    lunchEnabled: boolean;
    lunchStart: string;
    lunchDurationMinutes: number;
    timezone: string;
  },
): Array<{ start: Date; end: Date }> {
  const workStart = parseTimeOnDate(dateIso, settings.workStart, settings.timezone);
  const workEnd = parseWorkEndOnDate(dateIso, settings);

  if (!settings.lunchEnabled) {
    return [{ start: workStart, end: workEnd }];
  }

  const lunchStart = parseTimeOnDate(dateIso, settings.lunchStart, settings.timezone);
  const lunchEnd = addMinutes(lunchStart, settings.lunchDurationMinutes);

  return [
    { start: workStart, end: lunchStart },
    { start: lunchEnd, end: workEnd },
  ];
}

export function isTimestampInWorkWindow(
  timestamp: number,
  dateIso: string,
  settings: {
    workStart: string;
    workEnd: string;
    workEndsNextDay: boolean;
    lunchEnabled: boolean;
    lunchStart: string;
    lunchDurationMinutes: number;
    timezone: string;
  },
): boolean {
  const now = new Date(timestamp);
  const workStart = parseTimeOnDate(dateIso, settings.workStart, settings.timezone);
  const workEnd = parseWorkEndOnDate(dateIso, settings);
  return now >= workStart && now < workEnd;
}

export function calculateElapsedPaidMs(
  timestamp: number,
  dateIso: string,
  settings: {
    workStart: string;
    workEnd: string;
    workEndsNextDay: boolean;
    lunchEnabled: boolean;
    lunchStart: string;
    lunchDurationMinutes: number;
    timezone: string;
  },
): number {
  const now = new Date(timestamp);
  const intervals = getPaidIntervals(dateIso, settings);
  let elapsed = 0;

  for (const interval of intervals) {
    if (now <= interval.start) {
      continue;
    }
    const effectiveEnd = now < interval.end ? now : interval.end;
    elapsed += effectiveEnd.getTime() - interval.start.getTime();
  }

  return Math.max(0, elapsed);
}

export function calculateTotalPaidMs(
  dateIso: string,
  settings: {
    workStart: string;
    workEnd: string;
    workEndsNextDay: boolean;
    lunchEnabled: boolean;
    lunchStart: string;
    lunchDurationMinutes: number;
    timezone: string;
  },
): number {
  const intervals = getPaidIntervals(dateIso, settings);
  return intervals.reduce((sum, interval) => sum + (interval.end.getTime() - interval.start.getTime()), 0);
}

export function formatDurationMs(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} ч ${minutes} мин`;
  }
  if (hours > 0) {
    return `${hours} ч`;
  }
  return `${minutes} мин`;
}
