import type { WorkdayPhase } from './workday.model';

export type SalarySettingsSource = 'personal' | 'family';

export type SalaryVisualizationType = 'money-jar' | 'xp-bar' | 'ticker-tape';

export const SALARY_VISUALIZATION_TYPES: SalaryVisualizationType[] = [
  'money-jar',
  'xp-bar',
  'ticker-tape',
];

export function isSalaryVisualizationType(value: unknown): value is SalaryVisualizationType {
  return typeof value === 'string' && SALARY_VISUALIZATION_TYPES.includes(value as SalaryVisualizationType);
}

export interface SalarySettings {
  monthlySalary: number;
  currency: string;
  workStart: string;
  workEnd: string;
  /** Конец рабочего дня на следующий календарный день (ночная смена). */
  workEndsNextDay: boolean;
  lunchEnabled: boolean;
  lunchStart: string;
  lunchDurationMinutes: number;
  timezone: string;
  visualizationType: SalaryVisualizationType;
  source: SalarySettingsSource;
}

export interface SalaryRates {
  daily: number;
  hourly: number;
  minute: number;
  second: number;
}

export interface MonthViewStats {
  yearMonth: string;
  workingDaysInMonth: number;
  workingDaysCompleted: number;
  workingDaysRemaining: number;
  earnedThisMonth: number;
  monthProgress: number;
  dailyRate: number;
  isCurrentMonth: boolean;
}

export interface SalaryProgressState {
  progress: number;
  earnedToday: number;
  remainingToday: number;
  earnedThisMonth: number;
  monthRemaining: number;
  monthProgress: number;
  rates: SalaryRates;
  workdayPhase: WorkdayPhase;
  dailyRate: number;
  workingDaysInMonth: number;
  workingDaysCompleted: number;
  workingDaysRemaining: number;
  holidayName?: string;
  nextWorkingDay?: string;
  timeUntilWorkStartMs?: number;
  timeUntilWorkEndMs?: number;
  isFallbackCalendar: boolean;
}

export const DEFAULT_SALARY_SETTINGS: SalarySettings = {
  monthlySalary: 0,
  currency: 'RUB',
  workStart: '',
  workEnd: '',
  workEndsNextDay: false,
  lunchEnabled: false,
  lunchStart: '',
  lunchDurationMinutes: 0,
  timezone: '',
  visualizationType: 'money-jar',
  source: 'personal',
};

export function getDefaultTimezone(): string {
  if (typeof Intl !== 'undefined') {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return 'UTC';
}

/** Подставляет часовой пояс браузера, если пользователь ещё не задал свой. */
export function resolveSalarySettings(settings: SalarySettings): SalarySettings {
  return {
    ...settings,
    timezone: settings.timezone.trim() || getDefaultTimezone(),
  };
}

export function isSalarySettingsConfigured(settings: SalarySettings): boolean {
  return (
    settings.monthlySalary > 0 &&
    settings.workStart.trim().length > 0 &&
    settings.workEnd.trim().length > 0
  );
}
