import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { CalendarDay } from '@chrisasstanina/salary-flow-core';
import { FadeIn, GlassPanel, cn } from '@chrisasstanina/ui';

interface MonthCalendarProps {
  days: CalendarDay[];
  monthLabel: string;
  todayIso: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
}

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function getDaySymbol(day: CalendarDay): string {
  if (day.isHoliday) {
    return '🎉';
  }
  return day.isWorkingDay ? '●' : '○';
}

function getDayCellClass(day: CalendarDay, isToday: boolean): string {
  if (isToday) {
    return 'border-teal-400/60 bg-teal-500/15 text-teal-100 ring-1 ring-teal-400/30';
  }
  if (day.isHoliday) {
    return 'border-amber-500/50 bg-amber-500/20 text-amber-100';
  }
  if (!day.isWorkingDay) {
    return 'border-rose-500/40 bg-rose-950/60 text-rose-200';
  }
  return 'border-zinc-700/80 bg-zinc-900/50 text-zinc-200';
}

export function MonthCalendar({
  days,
  monthLabel,
  todayIso,
  onPreviousMonth,
  onNextMonth,
  canGoPrevious,
  canGoNext,
}: MonthCalendarProps) {
  const monthDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const firstDay = monthDays[0] ? parseISO(monthDays[0].date) : new Date();
  const offset = (firstDay.getDay() + 6) % 7;
  const cells: Array<CalendarDay | null> = [
    ...Array.from({ length: offset }, () => null),
    ...monthDays,
  ];

  return (
    <GlassPanel className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPreviousMonth}
          disabled={!canGoPrevious}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-teal-500/40 hover:text-teal-200 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Предыдущий месяц"
        >
          ←
        </button>

        <h2 className="text-center text-lg font-medium capitalize text-zinc-100">{monthLabel}</h2>

        <button
          type="button"
          onClick={onNextMonth}
          disabled={!canGoNext}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-teal-500/40 hover:text-teal-200 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Следующий месяц"
        >
          →
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-3 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-zinc-600 bg-zinc-900/50" />
          Рабочий
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-rose-500/40 bg-rose-950/60" />
          Выходной
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-amber-500/50 bg-amber-500/20" />
          Праздник
        </span>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs text-zinc-500">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {cells.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} />;
          }

          const dayNumber = format(parseISO(day.date), 'd');
          const isToday = day.date === todayIso;

          return (
            <FadeIn key={day.date} index={index % 7}>
              <div
                className={cn(
                  'flex flex-col items-center rounded-lg border px-1 py-2 text-center text-xs',
                  getDayCellClass(day, isToday),
                )}
                aria-label={`${dayNumber} ${day.isHoliday ? 'праздник' : day.isWorkingDay ? 'рабочий день' : 'выходной'}`}
              >
                <span className="font-medium">{dayNumber}</span>
                <span className="mt-1 text-[10px]">{getDaySymbol(day)}</span>
              </div>
            </FadeIn>
          );
        })}
      </div>
    </GlassPanel>
  );
}
