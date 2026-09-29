import { formatCurrency, type MonthViewStats } from '@chrisasstanina/salary-flow-core';
import { GlassPanel, ProgressGlow } from '@chrisasstanina/ui';

interface MonthProgressProps {
  stats: MonthViewStats;
  currency: string;
  monthLabel: string;
  monthlySalary: number;
  currentYearMonth: string;
}

export function MonthProgress({
  stats,
  currency,
  monthLabel,
  monthlySalary,
  currentYearMonth,
}: MonthProgressProps) {
  const monthRemaining = Math.max(0, monthlySalary - stats.earnedThisMonth);

  return (
    <GlassPanel className="p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium capitalize text-zinc-100">{monthLabel}</h2>
        <span className="text-sm text-zinc-500">{Math.round(stats.monthProgress * 1000) / 10}%</span>
      </div>

      <dl className="mb-6 grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="text-zinc-500">Рабочих дней</dt>
          <dd className="mt-1 text-lg font-medium text-zinc-100">{stats.workingDaysInMonth}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Отработано</dt>
          <dd className="mt-1 text-lg font-medium text-zinc-100">{stats.workingDaysCompleted}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Осталось</dt>
          <dd className="mt-1 text-lg font-medium text-zinc-100">{stats.workingDaysRemaining}</dd>
        </div>
      </dl>

      <div className="space-y-2">
        <p className="text-sm text-zinc-400">Заработано</p>
        <p className="text-2xl font-semibold text-teal-300">
          {formatCurrency(stats.earnedThisMonth, currency)}
        </p>
        <ProgressGlow progress={stats.monthProgress} label="Прогресс месяца" />
      </div>

      {stats.isCurrentMonth ? (
        <p className="mt-4 text-sm text-zinc-500">
          К концу месяца: {formatCurrency(stats.earnedThisMonth + monthRemaining, currency)}
        </p>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">
          {stats.yearMonth < currentYearMonth ? 'Месяц завершён' : 'Месяц ещё не начался'}
        </p>
      )}
    </GlassPanel>
  );
}
