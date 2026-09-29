import { cn } from '../lib/cn';

interface ProgressGlowProps {
  progress: number;
  className?: string;
  label?: string;
}

export function ProgressGlow({ progress, className, label }: ProgressGlowProps) {
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className="relative h-2 overflow-hidden rounded-full bg-zinc-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        aria-label={label}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-teal-500/80 to-emerald-400/90 transition-[width] duration-500"
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
    </div>
  );
}
