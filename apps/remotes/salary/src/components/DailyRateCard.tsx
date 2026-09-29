import { formatCurrency, formatWorkingDays } from '@chrisasstanina/salary-flow-core';
import { GlassPanel } from '@chrisasstanina/ui';

interface DailyRateCardProps {
  dailyRate: number;
  workingDaysInMonth: number;
  currency: string;
}

export function DailyRateCard({ dailyRate, workingDaysInMonth, currency }: DailyRateCardProps) {
  const typicalWorkingDays = 22;
  const typicalDailyRate = dailyRate * (workingDaysInMonth / typicalWorkingDays);
  const delta = dailyRate - typicalDailyRate;
  const isHigher = delta > 0.01;

  return (
    <GlassPanel className="p-6">
      <p className="text-sm text-zinc-400">
        {isHigher ? 'Этот месяц выгоднее обычного' : 'Стоимость рабочего дня в этом месяце'}
      </p>
      <p className="mt-2 text-lg text-zinc-100">{formatWorkingDays(workingDaysInMonth)}</p>
      <p className="mt-1 text-2xl font-semibold text-teal-300">
        {formatCurrency(dailyRate, currency)} / рабочий день
      </p>
      {isHigher && (
        <p className="mt-3 text-sm text-zinc-500">
          В обычном месяце: ≈ {formatCurrency(typicalDailyRate, currency)} / день
          <br />+{formatCurrency(delta, currency)} за каждый рабочий день
        </p>
      )}
    </GlassPanel>
  );
}
