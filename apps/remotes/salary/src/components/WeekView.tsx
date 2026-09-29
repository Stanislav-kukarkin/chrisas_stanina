import {
  formatCurrency,
  getDateIsoInTimezone,
  getWeekDays,
  type ProductionCalendar,
  type SalaryProgressState,
  type SalarySettings,
} from '@chrisasstanina/salary-flow-core';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { FadeIn, GlassPanel, ProgressGlow } from '@chrisasstanina/ui';

interface WeekViewProps {
  settings: SalarySettings;
  calendar: ProductionCalendar;
  state: SalaryProgressState;
  currency: string;
}

export function WeekView({ settings, calendar, state, currency }: WeekViewProps) {
  const todayIso = getDateIsoInTimezone(Date.now(), settings.timezone);
  const weekDays = getWeekDays(calendar.days, todayIso);

  return (
    <GlassPanel className="space-y-4 p-6">
      <h2 className="text-lg font-medium text-zinc-100">Эта неделя</h2>
      <div className="space-y-3">
        {weekDays.map((day, index) => {
          const label = format(parseISO(day.date), 'EEE', { locale: ru }).toUpperCase();
          const isToday = day.date === todayIso;
          let progress = 0;

          if (day.isWorkingDay) {
            if (isToday) {
              progress = state.progress;
            } else if (day.date < todayIso) {
              progress = 1;
            }
          }

          return (
            <FadeIn key={day.date} index={index}>
              <div className="grid grid-cols-[48px_1fr_auto] items-center gap-3">
                <span className="text-sm font-medium text-zinc-400">{label}</span>
                <div>
                  {day.isWorkingDay ? (
                    <ProgressGlow progress={progress} label={`Прогресс ${label}`} />
                  ) : (
                    <p className="text-sm text-zinc-500">
                      {day.isHoliday ? '🎉 праздник' : '○ выходной'}
                    </p>
                  )}
                </div>
                <span className="text-sm text-zinc-300">
                  {!day.isWorkingDay
                    ? '—'
                    : isToday
                      ? formatCurrency(state.earnedToday, currency)
                      : day.date < todayIso
                        ? formatCurrency(state.dailyRate, currency)
                        : '—'}
                </span>
              </div>
            </FadeIn>
          );
        })}
      </div>
    </GlassPanel>
  );
}
