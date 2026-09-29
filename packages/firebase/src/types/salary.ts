import type { SalarySettings, SalarySettingsSource } from '@chrisasstanina/salary-flow-core';

export type { SalarySettings, SalarySettingsSource };

export type SalarySettingsInput = Omit<SalarySettings, 'source'> & {
  source?: SalarySettingsSource;
};

export type SalarySettingsUpdate = Partial<SalarySettingsInput>;
