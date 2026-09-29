import {
  formatCurrency,
  formatDurationMs,
  formatRussianDate,
  type SalaryProgressState,
} from '@chrisasstanina/salary-flow-core';

interface WorkdayStatusProps {
  state: SalaryProgressState;
  currency: string;
}

export function WorkdayStatus({ state, currency }: WorkdayStatusProps) {
  const { workdayPhase, dailyRate, remainingToday, timeUntilWorkStartMs, timeUntilWorkEndMs } =
    state;

  if (workdayPhase === 'before') {
    return (
      <div className="space-y-2 text-zinc-300">
        <p className="text-sm text-zinc-400">Рабочий день ещё не начался</p>
        <p>
          Сегодня ты заработаешь{' '}
          <span className="font-semibold text-teal-300">{formatCurrency(dailyRate, currency)}</span>
        </p>
        <p className="text-sm text-zinc-500">
          До начала: {formatDurationMs(timeUntilWorkStartMs ?? 0)}
        </p>
      </div>
    );
  }

  if (workdayPhase === 'lunch') {
    return (
      <div className="space-y-2 text-zinc-300">
        <p className="font-medium text-amber-300">Обед</p>
        <p className="text-sm text-zinc-400">Заработок временно приостановлен</p>
      </div>
    );
  }

  if (workdayPhase === 'after') {
    return (
      <div className="space-y-2 text-zinc-300">
        <p className="font-medium text-teal-300">Рабочий день завершён</p>
        <p>
          Сегодня заработано{' '}
          <span className="font-semibold">{formatCurrency(state.earnedToday, currency)}</span>
        </p>
        <p className="text-sm text-zinc-500">100%</p>
      </div>
    );
  }

  if (workdayPhase === 'weekend') {
    return (
      <div className="space-y-2 text-zinc-300">
        <p className="font-medium">Сегодня выходной</p>
        <p className="text-sm text-zinc-400">
          Ты сегодня не работаешь, но месячная зарплата никуда не делась.
        </p>
        {state.nextWorkingDay && (
          <p className="text-sm text-zinc-500">
            Следующий рабочий день: {formatRussianDate(state.nextWorkingDay)}
          </p>
        )}
      </div>
    );
  }

  if (workdayPhase === 'holiday') {
    return (
      <div className="space-y-2 text-zinc-300">
        <p className="font-medium">Сегодня праздник</p>
        {state.holidayName && <p className="text-sm text-zinc-400">{state.holidayName}</p>}
        {state.nextWorkingDay && (
          <p className="text-sm text-zinc-500">
            Следующий рабочий день: {formatRussianDate(state.nextWorkingDay)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-zinc-300">
      <p>
        Осталось заработать{' '}
        <span className="font-semibold text-teal-300">
          {formatCurrency(remainingToday, currency)}
        </span>
      </p>
      <p className="text-sm text-zinc-500">
        До конца рабочего дня {formatDurationMs(timeUntilWorkEndMs ?? 0)}
      </p>
    </div>
  );
}
