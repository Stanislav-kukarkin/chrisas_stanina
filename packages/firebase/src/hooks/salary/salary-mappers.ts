import {
  DEFAULT_SALARY_SETTINGS,
  isSalaryVisualizationType,
  type SalarySettings,
} from '@chrisasstanina/salary-flow-core';

export function mapSalarySettings(data: Record<string, unknown> | undefined): SalarySettings {
  if (!data || Object.keys(data).length === 0) {
    return { ...DEFAULT_SALARY_SETTINGS };
  }

  return {
    monthlySalary: typeof data.monthlySalary === 'number' ? data.monthlySalary : DEFAULT_SALARY_SETTINGS.monthlySalary,
    currency: typeof data.currency === 'string' ? data.currency : DEFAULT_SALARY_SETTINGS.currency,
    workStart: typeof data.workStart === 'string' ? data.workStart : DEFAULT_SALARY_SETTINGS.workStart,
    workEnd: typeof data.workEnd === 'string' ? data.workEnd : DEFAULT_SALARY_SETTINGS.workEnd,
    workEndsNextDay:
      typeof data.workEndsNextDay === 'boolean'
        ? data.workEndsNextDay
        : DEFAULT_SALARY_SETTINGS.workEndsNextDay,
    lunchEnabled:
      typeof data.lunchEnabled === 'boolean' ? data.lunchEnabled : DEFAULT_SALARY_SETTINGS.lunchEnabled,
    lunchStart: typeof data.lunchStart === 'string' ? data.lunchStart : DEFAULT_SALARY_SETTINGS.lunchStart,
    lunchDurationMinutes:
      typeof data.lunchDurationMinutes === 'number'
        ? data.lunchDurationMinutes
        : DEFAULT_SALARY_SETTINGS.lunchDurationMinutes,
    timezone: typeof data.timezone === 'string' ? data.timezone : DEFAULT_SALARY_SETTINGS.timezone,
    visualizationType: isSalaryVisualizationType(data.visualizationType)
      ? data.visualizationType
      : DEFAULT_SALARY_SETTINGS.visualizationType,
    source: data.source === 'family' ? 'family' : 'personal',
  };
}

export function salarySettingsToFirestore(settings: SalarySettings): Record<string, unknown> {
  return { ...settings };
}
