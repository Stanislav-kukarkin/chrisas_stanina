export type { WorkdayPhase } from './models/workday.model';
export type { CalendarDay, CalendarSource, ProductionCalendar } from './models/calendar.model';
export type {
  SalarySettings,
  SalarySettingsSource,
  SalaryRates,
  SalaryProgressState,
  MonthViewStats,
  SalaryVisualizationType,
} from './models/salary.model';
export {
  DEFAULT_SALARY_SETTINGS,
  getDefaultTimezone,
  isSalarySettingsConfigured,
  isSalaryVisualizationType,
  resolveSalarySettings,
  SALARY_VISUALIZATION_TYPES,
} from './models/salary.model';

export {
  ProductionCalendarApiError,
  type ProductionCalendarApi,
  type ProductionCalendarApiDay,
  type ProductionCalendarApiResponse,
} from './api/production-calendar.api';
export { mapApiDay, mapApiDays } from './api/calendar.mapper';
export { HttpProductionCalendarApi } from './api/http-production-calendar.api';
export type { CalendarOverridesFile } from './models/calendar-overrides.model';
export {
  buildLocalCalendar,
  clampYearMonth,
  hasLocalCalendar,
  isYearMonthInLocalCalendarRange,
  LOCAL_CALENDAR_MAX_MONTH,
  LOCAL_CALENDAR_MIN_MONTH,
  LOCAL_CALENDAR_YEARS,
} from './data/local-calendars';
export { mergeBaseWithOverrides } from './utils/calendar-merge';

export {
  calculateDailyRate,
  calculateHourlyRate,
  calculateMinuteRate,
  calculateSecondRate,
  calculateRates,
  calculateEarnedToday,
  calculateRemainingToday,
  calculateDayProgress,
  calculateMonthlyEarned,
  calculateMonthProgress,
  buildSalaryProgressState,
  buildMonthViewStats,
} from './services/salary-calculator.service';

export {
  getDayInfo,
  countWorkingDaysInMonth,
  findNextWorkingDay,
  getWorkdayPhase,
  getTimeUntilWorkStartMs,
  getTimeUntilWorkEndMs,
  countCompletedWorkingDays,
  formatRussianDate,
  getWeekDays,
} from './services/workday.service';

export {
  mergeProductionCalendars,
  ProductionCalendarService,
} from './services/production-calendar.service';

export { buildFallbackCalendar } from './utils/fallback-calendar';
export {
  formatCurrency,
  formatRate,
  getCurrencyFractionDigits,
  getRateFractionDigits,
} from './utils/currency.formatter';
export {
  formatDurationMs,
  getPaidHoursPerDay,
  getWorkDurationMinutes,
  getDateIsoInTimezone,
} from './utils/time.utils';
export { formatWorkingDays, pluralizeRu } from './utils/plural.utils';
export { resolveWorkdayContext, type WorkdayContext } from './services/workday.service';
