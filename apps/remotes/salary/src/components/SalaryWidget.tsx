import {
  formatCurrency,
  type SalaryProgressState,
  type SalaryVisualizationType,
} from '@chrisasstanina/salary-flow-core';
import { AnimatedNumber, GlassPanel, ProgressGlow } from '@chrisasstanina/ui';
import { SalaryRate } from './SalaryRate';
import { WorkdayStatus } from './WorkdayStatus';
import { SalaryProgressVisualization } from './visualization/SalaryProgressVisualization';
import { enterNativeFullscreen } from '../lib/fullscreen';
import { useSalaryUiStore } from '../stores/salary-ui-store';

interface SalaryWidgetProps {
  state: SalaryProgressState;
  currency: string;
  visualizationType: SalaryVisualizationType;
}

export function SalaryWidget({ state, currency, visualizationType }: SalaryWidgetProps) {
  const openImmersive = useSalaryUiStore((store) => store.openImmersive);
  const showLiveAmount = state.workdayPhase === 'working' || state.workdayPhase === 'lunch';

  const handleOpenFullscreen = () => {
    openImmersive();
    void enterNativeFullscreen();
  };

  return (
    <GlassPanel className="p-6 md:p-8">
      <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
        <div className="space-y-4">
          <AnimatedNumber
            value={showLiveAmount ? state.earnedToday : state.workdayPhase === 'after' ? state.earnedToday : 0}
            format={(value) => formatCurrency(value, currency)}
            className="block text-4xl font-semibold tracking-tight text-zinc-50 md:text-6xl"
            aria-label="Заработано сегодня"
          />

          {(state.workdayPhase === 'working' || state.workdayPhase === 'lunch') && (
            <SalaryRate rates={state.rates} currency={currency} />
          )}

          {visualizationType === 'money-jar' && (
            <ProgressGlow
              progress={state.progress}
              label="Прогресс рабочего дня"
              className="max-w-md"
            />
          )}

          <WorkdayStatus state={state} currency={currency} />
        </div>

        <SalaryProgressVisualization
          type={visualizationType}
          progress={state.progress}
          phase={state.workdayPhase}
          rates={state.rates}
          currency={currency}
          className="md:justify-self-end"
        />
      </div>

      <div className="mt-6 border-t border-zinc-800/60 pt-4">
        <button
          type="button"
          onClick={handleOpenFullscreen}
          className="rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-400 backdrop-blur transition hover:border-teal-500/40 hover:text-teal-200"
          aria-label="Открыть на весь экран"
        >
          На весь экран
        </button>
      </div>
    </GlassPanel>
  );
}
