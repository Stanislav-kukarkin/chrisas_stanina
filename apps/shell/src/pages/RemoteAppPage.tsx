import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { useParams } from 'react-router-dom';
import { APP_LABELS, REMOTE_NAMES, type RemoteName } from '@chrisasstanina/shared-federation';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function RemoteLoadError({ appName }: { appName: RemoteName }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-red-400">Не удалось загрузить {APP_LABELS[appName]}.</p>
      <p className="mt-2 text-sm text-zinc-500">
        Перезапустите <code className="text-zinc-400">npm run dev</code> и обновите страницу.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-4 text-sm text-violet-400 hover:text-violet-300"
      >
        Обновить
      </button>
    </div>
  );
}

function lazyRemote(
  appName: RemoteName,
  loader: () => Promise<{ default: ComponentType }>,
): LazyExoticComponent<ComponentType> {
  return lazy(() =>
    loader().catch((error: unknown) => {
      console.error(`[remote:${appName}]`, error);
      return {
        default: () => <RemoteLoadError appName={appName} />,
      };
    }),
  );
}

const RemoteApps = {
  tasks: lazyRemote('tasks', () => import('tasks/App')),
  shopping: lazyRemote('shopping', () => import('shopping/App')),
  recipes: lazyRemote('recipes', () => import('recipes/App')),
  budget: lazyRemote('budget', () => import('budget/App')),
  cashback: lazyRemote('cashback', () => import('cashback/App')),
  salary: lazyRemote('salary', () => import('salary/App')),
} satisfies Record<RemoteName, LazyExoticComponent<ComponentType>>;

function isRemoteName(value: string | undefined): value is RemoteName {
  return value !== undefined && REMOTE_NAMES.includes(value as RemoteName);
}

function RemoteLoader({ appName }: { appName: RemoteName }) {
  const RemoteApp = RemoteApps[appName];

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] flex-1 items-center justify-center text-zinc-400">
          Загрузка {APP_LABELS[appName]}...
        </div>
      }
    >
      <RemoteApp />
    </Suspense>
  );
}

export function RemoteAppPage() {
  const { appName } = useParams<{ appName: string }>();

  if (!isRemoteName(appName)) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-zinc-400">
        Приложение не найдено.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <ErrorBoundary>
        <RemoteLoader appName={appName} />
      </ErrorBoundary>
    </div>
  );
}
