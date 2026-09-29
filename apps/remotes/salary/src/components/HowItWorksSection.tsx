import {
  formatCurrency,
  formatRate,
  getPaidHoursPerDay,
  getRateFractionDigits,
  type SalaryProgressState,
  type SalarySettings,
} from '@chrisasstanina/salary-flow-core';
import { GlassPanel } from '@chrisasstanina/ui';

interface HowItWorksSectionProps {
  settings: SalarySettings;
  state: SalaryProgressState;
}

export function HowItWorksSection({ settings, state }: HowItWorksSectionProps) {
  const paidHours = getPaidHoursPerDay(settings);

  return (
    <GlassPanel className="p-6">
      <h2 className="text-lg font-medium text-zinc-100">Как считается</h2>
      <dl className="mt-4 space-y-2 text-sm text-zinc-300">
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Твоя зарплата</dt>
          <dd>{formatCurrency(settings.monthlySalary, settings.currency)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Рабочих дней в месяце</dt>
          <dd>{state.workingDaysInMonth}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">За рабочий день</dt>
          <dd>{formatCurrency(state.dailyRate, settings.currency)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">За час</dt>
          <dd>{formatRate(state.rates.hourly, settings.currency, 'ч', 2)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">За минуту</dt>
          <dd>{formatRate(state.rates.minute, settings.currency, 'мин', 2)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">За секунду</dt>
          <dd>
            {formatRate(
              state.rates.second,
              settings.currency,
              'сек',
              getRateFractionDigits(state.rates.second),
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Оплачиваемых часов в день</dt>
          <dd>{paidHours}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm leading-relaxed text-zinc-500">
        Месячная зарплата распределяется между рабочими днями текущего месяца согласно
        производственному календарю.
      </p>
    </GlassPanel>
  );
}
