import { cn } from '../lib/cn';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentedControlOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  fullWidth?: boolean;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  fullWidth = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-800 bg-zinc-900/80 p-1',
        fullWidth ? 'flex w-full' : 'inline-flex w-fit',
        className,
      )}
      role="tablist"
      aria-label="Переключатель периода"
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition',
              fullWidth && 'flex-1 text-center',
              isActive
                ? 'bg-teal-500/20 text-teal-300 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
