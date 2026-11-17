import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import type { RemoteName } from '@chrisasstanina/shared-federation';
import type { AppCard } from '@/config/apps';

interface AppLauncherCardProps {
  app: AppCard;
  index: number;
}

const APP_STYLES: Record<RemoteName, { accent: string; glow: string }> = {
  tasks: {
    accent: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    glow: 'bg-amber-400/15',
  },
  shopping: {
    accent: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    glow: 'bg-emerald-400/15',
  },
  recipes: {
    accent: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
    glow: 'bg-rose-400/15',
  },
  salary: {
    accent: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300',
    glow: 'bg-cyan-400/15',
  },
  payments: {
    accent: 'border-blue-400/20 bg-blue-400/10 text-blue-300',
    glow: 'bg-blue-400/15',
  },
  'cashback-wallpapers': {
    accent: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
    glow: 'bg-violet-400/15',
  },
  budget: {
    accent: 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-300',
    glow: 'bg-fuchsia-400/15',
  },
  cashback: {
    accent: 'border-pink-400/20 bg-pink-400/10 text-pink-300',
    glow: 'bg-pink-400/15',
  },
};

function AppIcon({ id }: { id: RemoteName }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (id === 'tasks') return <svg {...common}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h5M8.5 18h6" /></svg>;
  if (id === 'shopping') return <svg {...common}><path d="M4 9h16l-1.4 10H5.4L4 9Z" /><path d="m8 9 4-6 4 6M9 13v2M15 13v2" /></svg>;
  if (id === 'recipes') return <svg {...common}><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H12v18H7.5A2.5 2.5 0 0 0 5 22V4.5Z" /><path d="M19 4.5A2.5 2.5 0 0 0 16.5 2H12v18h4.5A2.5 2.5 0 0 1 19 22V4.5Z" /></svg>;
  if (id === 'salary') return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /><path d="m15 5 3-3 3 3M18 2v7" /></svg>;
  if (id === 'payments') return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h3" /></svg>;
  if (id === 'cashback-wallpapers') return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="9" r="1.5" /><path d="m4 17 4.5-4 3 3 2.5-2 6 5M18 2v4M16 4h4" /></svg>;
  if (id === 'budget') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 6v12M15.5 8.5H10a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8.5" /></svg>;
  return <svg {...common}><path d="M20 7H4a2 2 0 0 0-2 2v9h20V9a2 2 0 0 0-2-2Z" /><path d="M16 7V4H8v3M7 13h10" /></svg>;
}

export function AppLauncherCard({ app, index }: AppLauncherCardProps) {
  const style = APP_STYLES[app.id];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.045, duration: 0.36 }}
      className="h-full min-w-0"
    >
      <Link
        to={app.path}
        aria-label={`Открыть ${app.title}`}
        className="group relative flex h-full min-h-40 flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-zinc-900/65 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.16)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/15 hover:bg-zinc-900/90 hover:shadow-[0_24px_70px_rgba(0,0,0,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 sm:min-h-56 sm:p-6"
      >
        <div className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl opacity-30 transition duration-300 group-hover:opacity-70 ${style.glow}`} />

        <div className="relative flex items-start justify-between gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border sm:h-12 sm:w-12 ${style.accent}`}>
            <span className="h-5 w-5 sm:h-6 sm:w-6"><AppIcon id={app.id} /></span>
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-zinc-500 transition duration-300 group-hover:border-violet-400/30 group-hover:bg-violet-400/10 group-hover:text-violet-200 sm:h-9 sm:w-9">
            <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </span>
        </div>

        <div className="relative mt-auto pt-5 sm:pt-8">
          <h3 className="text-sm font-semibold leading-snug text-zinc-100 sm:text-lg">{app.title}</h3>
          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-500 sm:mt-2 sm:text-sm sm:leading-6">{app.description}</p>
        </div>
      </Link>
    </motion.div>
  );
}
