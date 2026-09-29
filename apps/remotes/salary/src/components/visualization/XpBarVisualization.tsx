import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@chrisasstanina/ui';
import type { WorkdayPhase } from '@chrisasstanina/salary-flow-core';

interface XpBarVisualizationProps {
  progress: number;
  phase: WorkdayPhase;
  className?: string;
}

function getStatusLabel(phase: WorkdayPhase, percent: number): string {
  if (phase === 'lunch') {
    return 'Пауза';
  }
  if (phase === 'before') {
    return 'День не начался';
  }
  if (phase === 'after') {
    return 'День завершён';
  }
  if (phase === 'weekend' || phase === 'holiday') {
    return 'Выходной';
  }
  return `${percent}%`;
}

export function XpBarVisualization({ progress, phase, className }: XpBarVisualizationProps) {
  const prefersReducedMotion = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, progress));
  const percent = Math.round(clamped * 100);
  const isActive = phase === 'working';
  const shouldPulse = isActive && !prefersReducedMotion;

  return (
    <div
      className={cn('relative mx-auto w-full max-w-[160px] space-y-3', className)}
      aria-hidden="true"
    >
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400/80">
          Опыт за день
        </p>
        <p className="mt-1 text-sm font-medium text-zinc-300">{getStatusLabel(phase, percent)}</p>
      </div>

      <div className="relative overflow-hidden rounded-lg border-2 border-zinc-700/80 bg-zinc-950/80 p-1 shadow-inner">
        <div className="relative h-8 overflow-hidden rounded-md bg-zinc-900">
          <motion.div
            className={cn(
              'h-full rounded-md bg-gradient-to-r from-teal-600 via-teal-400 to-emerald-300',
              shouldPulse && 'shadow-[0_0_12px_rgba(45,212,191,0.45)]',
            )}
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={{ type: 'spring', stiffness: 90, damping: 22 }}
          />
          {shouldPulse && (
            <motion.div
              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              animate={{ x: ['-100%', '400%'] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </div>
      </div>

      <p className="text-center text-xs tabular-nums text-zinc-500">LV {percent}</p>
    </div>
  );
}
