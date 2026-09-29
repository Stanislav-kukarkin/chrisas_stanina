import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { cn } from '../lib/cn';

interface SpotlightCardProps {
  title: string;
  description: string;
  href: string;
  index: number;
}

export function SpotlightCard({ title, description, href, index }: SpotlightCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.08, duration: 0.5 }}
    >
      <Link
        to={href}
        className={cn(
          'group relative block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6',
          'transition duration-300 hover:border-violet-500/50 hover:bg-zinc-900',
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
          <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-violet-500/20 blur-2xl" />
        </div>
        <h3 className="relative text-lg font-semibold text-zinc-100">{title}</h3>
        <p className="relative mt-2 text-sm text-zinc-400">{description}</p>
        <span className="relative mt-4 inline-flex text-sm text-violet-400">Открыть →</span>
      </Link>
    </motion.div>
  );
}
