import { Aurora, BlurText, SpotlightCard } from '@chrisasstanina/ui';
import { APP_CARDS } from '@/config/apps';

export function HomePage() {
  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <Aurora />
      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <BlurText
            text="Семейный Hub"
            className="text-4xl font-bold tracking-tight sm:text-6xl"
          />
          <p className="mt-6 text-lg text-zinc-400">
            Приложения для быта, задач, покупок и всего, что помогает нам жить проще.
          </p>
        </div>

        <div className="mt-16 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          {APP_CARDS.map((app, index) => (
            <SpotlightCard
              key={app.id}
              title={app.title}
              description={app.description}
              href={app.path}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
