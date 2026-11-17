import { useMemo, useState } from 'react';
import { Aurora, BlurText } from '@chrisasstanina/ui';
import { APP_CARDS } from '@/config/apps';
import { AppLauncherCard } from '@/components/home/AppLauncherCard';

export function HomePage() {
  const [query, setQuery] = useState('');

  const visibleApps = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
    if (!normalizedQuery) return APP_CARDS;

    return APP_CARDS.filter((app) =>
      `${app.title} ${app.description}`.toLocaleLowerCase('ru-RU').includes(normalizedQuery),
    );
  }, [query]);

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <Aurora />
      <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-10 pt-8 sm:px-6 sm:pb-16 sm:pt-12 lg:px-8">
        <div className="flex flex-col gap-5 border-b border-white/8 pb-7 sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:pb-9">
          <div className="max-w-2xl">
            <span className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/80">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.9)]" />
              Ваше пространство
            </span>
          <BlurText
            text="Семейный Hub"
              className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-5xl"
          />
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:mt-4 sm:text-base">
              Все семейные инструменты в одном месте — быстро находите нужное и продолжайте с того места, где остановились.
          </p>
          </div>

          <label className="group relative block w-full sm:max-w-sm" aria-label="Найти приложение">
            <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 transition group-focus-within:text-violet-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти приложение"
              className="h-12 w-full rounded-2xl border border-white/10 bg-zinc-900/70 pl-11 pr-10 text-sm text-zinc-100 outline-none backdrop-blur-xl transition placeholder:text-zinc-500 hover:border-white/15 focus:border-violet-400/60 focus:ring-4 focus:ring-violet-500/10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Очистить поиск"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
              >
                ×
              </button>
            )}
          </label>
        </div>

        {visibleApps.length > 0 ? (
          <div className="mt-7 grid w-full grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:mt-9 sm:gap-4 lg:grid-cols-3">
            {visibleApps.map((app, index) => (
              <AppLauncherCard key={app.id} app={app} index={index} />
            ))}
          </div>
        ) : (
          <div className="mt-7 flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center sm:mt-9">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-xl text-zinc-500">⌕</div>
            <h3 className="mt-4 font-medium text-zinc-200">Ничего не нашли</h3>
            <p className="mt-1 text-sm text-zinc-500">Попробуйте другое название приложения.</p>
            <button type="button" onClick={() => setQuery('')} className="mt-4 text-sm font-medium text-violet-300 transition hover:text-violet-200">
              Сбросить поиск
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
