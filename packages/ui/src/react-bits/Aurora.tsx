import { cn } from '../lib/cn';

interface AuroraProps {
  className?: string;
}

export function Aurora({ className }: AuroraProps) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute -top-1/2 left-1/2 h-[120%] w-[120%] -translate-x-1/2 animate-[spin_30s_linear_infinite] rounded-full bg-[conic-gradient(from_180deg,transparent_0deg,#8b5cf6_120deg,transparent_240deg)] opacity-20 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.18),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(59,130,246,0.12),transparent_50%)]" />
    </div>
  );
}
