import { useCallback, useEffect } from 'react';
import {
  formatCurrency,
  type SalaryProgressState,
  type SalaryVisualizationType,
} from '@chrisasstanina/salary-flow-core';
import { AnimatedNumber, Aurora, cn } from '@chrisasstanina/ui';
import { exitNativeFullscreen, isNativeFullscreenActive } from '../lib/fullscreen';
import { SalaryRate } from './SalaryRate';
import { WorkdayStatus } from './WorkdayStatus';
import { SalaryProgressVisualization } from './visualization/SalaryProgressVisualization';

interface SalaryImmersiveViewProps {
  open: boolean;
  state: SalaryProgressState;
  currency: string;
  visualizationType: SalaryVisualizationType;
  onClose: () => void;
}

export function SalaryImmersiveView({
  open,
  state,
  currency,
  visualizationType,
  onClose,
}: SalaryImmersiveViewProps) {
  const handleClose = useCallback(async () => {
    await exitNativeFullscreen();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      void exitNativeFullscreen();
      return;
    }

    const onFullscreenChange = () => {
      if (!isNativeFullscreenActive()) {
        onClose();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isNativeFullscreenActive()) {
        void handleClose();
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKeyDown);

    if (!isNativeFullscreenActive()) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      void exitNativeFullscreen();
    };
  }, [handleClose, onClose, open]);

  if (!open) {
    return null;
  }

  const showLiveAmount =
    state.workdayPhase === 'working' || state.workdayPhase === 'lunch';

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-zinc-950">
      <Aurora />

      <button
        type="button"
        onClick={() => void handleClose()}
        className="absolute right-4 top-4 z-20 rounded-xl border border-zinc-700/80 bg-zinc-900/70 px-4 py-2 text-sm text-zinc-300 backdrop-blur hover:border-teal-500/40 hover:text-teal-200"
        aria-label="Закрыть полноэкранный режим"
      >
        Закрыть
      </button>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
        <AnimatedNumber
          value={
            showLiveAmount
              ? state.earnedToday
              : state.workdayPhase === 'after'
                ? state.earnedToday
                : 0
          }
          format={(value) => formatCurrency(value, currency)}
          className="block text-5xl font-semibold tracking-tight text-zinc-50 sm:text-7xl md:text-8xl"
          aria-label="Заработано сегодня"
        />

        {(state.workdayPhase === 'working' || state.workdayPhase === 'lunch') && (
          <SalaryRate rates={state.rates} currency={currency} />
        )}

        <SalaryProgressVisualization
          type={visualizationType}
          progress={state.progress}
          phase={state.workdayPhase}
          rates={state.rates}
          currency={currency}
          className="max-w-[220px] scale-125"
        />

        <div className={cn('max-w-md text-left text-zinc-300')}>
          <WorkdayStatus state={state} currency={currency} />
        </div>
      </div>
    </div>
  );
}
