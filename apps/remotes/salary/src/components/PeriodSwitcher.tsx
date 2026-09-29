import { SegmentedControl } from '@chrisasstanina/ui';
import { useSalaryUiStore, type SalaryPeriod } from '../stores/salary-ui-store';

const PERIOD_OPTIONS = [
  { value: 'today' as const, label: 'Сегодня' },
  { value: 'week' as const, label: 'Неделя' },
  { value: 'month' as const, label: 'Месяц' },
];

export function PeriodSwitcher() {
  const period = useSalaryUiStore((store) => store.period);
  const setPeriod = useSalaryUiStore((store) => store.setPeriod);

  return (
    <SegmentedControl<SalaryPeriod>
      value={period}
      options={PERIOD_OPTIONS}
      onChange={setPeriod}
    />
  );
}
