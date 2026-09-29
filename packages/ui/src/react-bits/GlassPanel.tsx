import { type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/cn';

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  index?: number;
  animated?: boolean;
}

export function GlassPanel({ children, className, index = 0, animated = true }: GlassPanelProps) {
  const panelClassName = cn(
    'group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70',
    className,
  );

  if (!animated) {
    return (
      <div className={panelClassName}>
        <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl" />
        </div>
        <div className="relative">{children}</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.06, duration: 0.45 }}
      className={panelClassName}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl" />
      </div>
      <div className="relative">{children}</div>
    </motion.div>
  );
}
