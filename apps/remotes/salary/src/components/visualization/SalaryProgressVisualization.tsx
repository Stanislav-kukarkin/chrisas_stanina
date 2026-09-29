import type {
  SalaryRates,
  SalaryVisualizationType,
  WorkdayPhase,
} from '@chrisasstanina/salary-flow-core';
import { MoneyJarVisualization } from './MoneyJarVisualization';
import { TickerTapeVisualization } from './TickerTapeVisualization';
import { XpBarVisualization } from './XpBarVisualization';

interface SalaryProgressVisualizationProps {
  type?: SalaryVisualizationType;
  progress: number;
  phase: WorkdayPhase;
  rates?: SalaryRates;
  currency?: string;
  className?: string;
}

export function SalaryProgressVisualization({
  type = 'money-jar',
  progress,
  phase,
  rates,
  currency = 'RUB',
  className,
}: SalaryProgressVisualizationProps) {
  switch (type) {
    case 'xp-bar':
      return <XpBarVisualization progress={progress} phase={phase} className={className} />;
    case 'ticker-tape':
      return (
        <TickerTapeVisualization
          progress={progress}
          phase={phase}
          rates={rates ?? { daily: 0, hourly: 0, minute: 0, second: 0 }}
          currency={currency}
          className={className}
        />
      );
    case 'money-jar':
    default:
      return <MoneyJarVisualization progress={progress} phase={phase} className={className} />;
  }
}
