import {
  formatRate,
  getRateFractionDigits,
  type SalaryRates,
  type WorkdayPhase,
} from '@chrisasstanina/salary-flow-core';
import { cn } from '@chrisasstanina/ui';

interface TickerTapeVisualizationProps {
  progress: number;
  phase: WorkdayPhase;
  rates: SalaryRates;
  currency: string;
  className?: string;
}

function buildTickerText(rates: SalaryRates, currency: string): string {
  const secondDigits = getRateFractionDigits(rates.second);
  const minuteDigits = getRateFractionDigits(rates.minute);
  const second = formatRate(rates.second, currency, 'сек', secondDigits);
  const minute = formatRate(rates.minute, currency, 'мин', minuteDigits);
  const hourly = formatRate(rates.hourly, currency, 'ч', 2);
  return `+${second}  ·  +${minute}  ·  +${hourly}  ·  `;
}

export function TickerTapeVisualization({
  progress,
  phase,
  rates,
  currency,
  className,
}: TickerTapeVisualizationProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const percent = Math.round(clamped * 100);
  const tickerText = buildTickerText(rates, currency);
  const isScrolling = phase === 'working';

  return (
    <div
      className={cn('relative mx-auto w-full max-w-[200px] space-y-3', className)}
      aria-hidden="true"
    >
      <div className="overflow-hidden rounded-lg border border-zinc-700/80 bg-zinc-950/90">
        <div className="border-b border-zinc-800 bg-zinc-900/80 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-500">
          Salary Flow · LIVE
        </div>
        <div className="relative h-9 overflow-hidden">
          <div
            className={cn(
              'flex w-max whitespace-nowrap py-2 text-xs font-medium text-teal-300',
              isScrolling && 'animate-ticker-scroll',
            )}
          >
            <span className="px-2">{tickerText}</span>
            {isScrolling && <span className="px-2">{tickerText}</span>}
          </div>
          {!isScrolling && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60 text-[10px] text-zinc-500">
              {phase === 'lunch' ? 'Пауза' : '—'}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-zinc-500">
          <span>Прогресс дня</span>
          <span className="tabular-nums">{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-400 transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

    </div>
  );
}
