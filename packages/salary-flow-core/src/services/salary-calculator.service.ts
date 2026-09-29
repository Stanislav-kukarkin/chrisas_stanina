import type { CalendarDay, ProductionCalendar } from '../models/calendar.model';
import type {
  MonthViewStats,
  SalaryProgressState,
  SalaryRates,
  SalarySettings,
} from '../models/salary.model';
import {
  calculateElapsedPaidMs,
  calculateTotalPaidMs,
  getDateIsoInTimezone,
  getPaidHoursPerDay,
  parseTimeOnDate,
} from '../utils/time.utils';
import {
  countCompletedWorkingDays,
  countWorkingDaysInMonth,
  findNextWorkingDay,
  getDayInfo,
  getTimeUntilWorkEndMs,
  getTimeUntilWorkStartMs,
  getWorkdayPhase,
  resolveWorkdayContext,
} from './workday.service';

export function calculateDailyRate(monthlySalary: number, workingDays: number): number {
  if (workingDays <= 0 || monthlySalary <= 0) {
    return 0;
  }
  return monthlySalary / workingDays;
}

export function calculateHourlyRate(dailyRate: number, paidHoursPerDay: number): number {
  if (paidHoursPerDay <= 0) {
    return 0;
  }
  return dailyRate / paidHoursPerDay;
}

export function calculateMinuteRate(hourlyRate: number): number {
  return hourlyRate / 60;
}

export function calculateSecondRate(hourlyRate: number): number {
  return hourlyRate / 3600;
}

export function calculateRates(
  settings: SalarySettings,
  workingDaysInMonth: number,
): SalaryRates & { daily: number } {
  const paidHours = getPaidHoursPerDay(settings);
  const daily = calculateDailyRate(settings.monthlySalary, workingDaysInMonth);
  const hourly = calculateHourlyRate(daily, paidHours);
  return {
    daily,
    hourly,
    minute: calculateMinuteRate(hourly),
    second: calculateSecondRate(hourly),
  };
}

export function calculateEarnedToday(
  settings: SalarySettings,
  dayInfo: CalendarDay | undefined,
  timestamp: number,
  dailyRate: number,
  workDateIso?: string,
): number {
  if (!dayInfo?.isWorkingDay || dailyRate <= 0) {
    return 0;
  }

  const dateIso = workDateIso ?? getDateIsoInTimezone(timestamp, settings.timezone);
  const phase = getWorkdayPhase(settings, dayInfo, timestamp, dateIso);
  if (phase === 'before' || phase === 'weekend' || phase === 'holiday') {
    return 0;
  }

  const totalPaidMs = calculateTotalPaidMs(dateIso, settings);
  if (totalPaidMs <= 0) {
    return 0;
  }

  let effectiveTimestamp = timestamp;
  if (phase === 'lunch' && settings.lunchEnabled) {
    effectiveTimestamp = parseTimeOnDate(dateIso, settings.lunchStart, settings.timezone).getTime();
  }

  let elapsedMs = calculateElapsedPaidMs(effectiveTimestamp, dateIso, settings);

  if (phase === 'after') {
    elapsedMs = totalPaidMs;
  }

  return Math.min(dailyRate, (elapsedMs / totalPaidMs) * dailyRate);
}

export function calculateRemainingToday(earnedToday: number, dailyRate: number, phase: string): number {
  if (phase === 'weekend' || phase === 'holiday' || phase === 'before') {
    return dailyRate;
  }
  if (phase === 'after') {
    return 0;
  }
  return Math.max(0, dailyRate - earnedToday);
}

export function calculateDayProgress(earnedToday: number, dailyRate: number): number {
  if (dailyRate <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, earnedToday / dailyRate));
}

export function calculateMonthlyEarned(
  settings: SalarySettings,
  calendar: ProductionCalendar,
  timestamp: number,
  dailyRate: number,
  earnedToday: number,
  earningDateIso?: string,
): number {
  const calendarIso = getDateIsoInTimezone(timestamp, settings.timezone);
  const dateIso = earningDateIso ?? calendarIso;
  const yearMonth = calendarIso.slice(0, 7);
  const completed = countCompletedWorkingDays(calendar.days, yearMonth, calendarIso);
  const dayInfo = getDayInfo(calendar.days, dateIso);
  const todayContribution = dayInfo?.isWorkingDay ? earnedToday : 0;
  return completed * dailyRate + todayContribution;
}

export function calculateMonthProgress(earnedThisMonth: number, monthlySalary: number): number {
  if (monthlySalary <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, earnedThisMonth / monthlySalary));
}

export function buildSalaryProgressState(
  settings: SalarySettings,
  calendar: ProductionCalendar,
  timestamp: number,
): SalaryProgressState {
  const calendarIso = getDateIsoInTimezone(timestamp, settings.timezone);
  const workday = resolveWorkdayContext(settings, calendar.days, timestamp);
  const { dateIso: earningDateIso, dayInfo } = workday;
  const yearMonth = calendarIso.slice(0, 7);
  const workingDaysInMonth = countWorkingDaysInMonth(calendar.days, yearMonth);
  const rates = calculateRates(settings, workingDaysInMonth);
  const workdayPhase = getWorkdayPhase(settings, dayInfo, timestamp, earningDateIso);
  const earnedToday = calculateEarnedToday(
    settings,
    dayInfo,
    timestamp,
    rates.daily,
    earningDateIso,
  );
  const remainingToday = calculateRemainingToday(earnedToday, rates.daily, workdayPhase);
  const progress = calculateDayProgress(earnedToday, rates.daily);
  const earnedThisMonth = calculateMonthlyEarned(
    settings,
    calendar,
    timestamp,
    rates.daily,
    earnedToday,
    earningDateIso,
  );
  const monthProgress = calculateMonthProgress(earnedThisMonth, settings.monthlySalary);
  const workingDaysCompleted = countCompletedWorkingDays(calendar.days, yearMonth, calendarIso);
  const todayDayInfo = getDayInfo(calendar.days, calendarIso);
  const todayIsWorking = todayDayInfo?.isWorkingDay ?? false;
  const workingDaysDone = workingDaysCompleted + (todayIsWorking ? 1 : 0);

  return {
    progress,
    earnedToday,
    remainingToday,
    earnedThisMonth,
    monthRemaining: Math.max(0, settings.monthlySalary - earnedThisMonth),
    monthProgress,
    rates,
    workdayPhase,
    dailyRate: rates.daily,
    workingDaysInMonth,
    workingDaysCompleted: workingDaysDone,
    workingDaysRemaining: Math.max(0, workingDaysInMonth - workingDaysDone),
    holidayName: dayInfo?.name ?? todayDayInfo?.name,
    nextWorkingDay: findNextWorkingDay(calendar.days, calendarIso),
    timeUntilWorkStartMs: getTimeUntilWorkStartMs(settings, timestamp),
    timeUntilWorkEndMs: getTimeUntilWorkEndMs(settings, timestamp, earningDateIso),
    isFallbackCalendar: calendar.source === 'fallback',
  };
}

export function buildMonthViewStats(
  settings: SalarySettings,
  calendar: ProductionCalendar,
  yearMonth: string,
  timestamp: number,
): MonthViewStats {
  const calendarIso = getDateIsoInTimezone(timestamp, settings.timezone);
  const currentYearMonth = calendarIso.slice(0, 7);
  const workingDaysInMonth = countWorkingDaysInMonth(calendar.days, yearMonth);
  const dailyRate = calculateDailyRate(settings.monthlySalary, workingDaysInMonth);

  if (yearMonth === currentYearMonth) {
    const live = buildSalaryProgressState(settings, calendar, timestamp);
    return {
      yearMonth,
      workingDaysInMonth: live.workingDaysInMonth,
      workingDaysCompleted: live.workingDaysCompleted,
      workingDaysRemaining: live.workingDaysRemaining,
      earnedThisMonth: live.earnedThisMonth,
      monthProgress: live.monthProgress,
      dailyRate: live.dailyRate,
      isCurrentMonth: true,
    };
  }

  if (yearMonth < currentYearMonth) {
    const earned = dailyRate * workingDaysInMonth;
    return {
      yearMonth,
      workingDaysInMonth,
      workingDaysCompleted: workingDaysInMonth,
      workingDaysRemaining: 0,
      earnedThisMonth: earned,
      monthProgress: calculateMonthProgress(earned, settings.monthlySalary),
      dailyRate,
      isCurrentMonth: false,
    };
  }

  return {
    yearMonth,
    workingDaysInMonth,
    workingDaysCompleted: 0,
    workingDaysRemaining: workingDaysInMonth,
    earnedThisMonth: 0,
    monthProgress: 0,
    dailyRate,
    isCurrentMonth: false,
  };
}
