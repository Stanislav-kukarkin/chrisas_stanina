import {
  formatRate,
  getRateFractionDigits,
  type SalaryRates,
} from '@chrisasstanina/salary-flow-core';

interface SalaryRateProps {
  rates: SalaryRates;
  currency: string;
}

export function SalaryRate({ rates, currency }: SalaryRateProps) {
  const secondDigits = getRateFractionDigits(rates.second);
  const minuteDigits = getRateFractionDigits(rates.minute);

  return (
    <div className="space-y-1 text-sm text-teal-300/90">
      <p>+{formatRate(rates.second, currency, 'сек', secondDigits)}</p>
      <p className="text-zinc-400">
        +{formatRate(rates.minute, currency, 'мин', minuteDigits)} ·{' '}
        +{formatRate(rates.hourly, currency, 'ч', 2)}
      </p>
    </div>
  );
}
