export const REMOTE_NAMES = ['tasks', 'shopping', 'recipes', 'budget', 'cashback', 'salary'] as const;

export type RemoteName = (typeof REMOTE_NAMES)[number];

export const REMOTE_PORTS: Record<RemoteName, number> = {
  tasks: 5001,
  shopping: 5002,
  recipes: 5003,
  budget: 5004,
  cashback: 5005,
  salary: 5006,
};

export const APP_LABELS: Record<RemoteName, string> = {
  tasks: 'Задачи',
  shopping: 'Список покупок',
  recipes: 'Рецепты',
  budget: 'Бюджет',
  cashback: 'Кэшбеки',
  salary: 'Salary Flow',
};

export const APP_DESCRIPTIONS: Record<RemoteName, string> = {
  tasks: 'Семейные задачи и дела',
  shopping: 'Общий список покупок',
  recipes: 'Любимые рецепты и меню',
  budget: 'Учёт расходов семьи',
  cashback: 'Распознавание и учёт кэшбеков',
  salary: 'Визуальный трекер заработка в реальном времени',
};

function normalizeBasePath(base = '/'): string {
  if (!base || base === '/') return '/';
  return base.endsWith('/') ? base : `${base}/`;
}

export function getRemoteEntryUrl(name: RemoteName, isDev: boolean): string {
  if (isDev) {
    return `http://localhost:${REMOTE_PORTS[name]}/assets/remoteEntry.js`;
  }
  const shellBase = normalizeBasePath(import.meta.env.BASE_URL);
  const remoteBase = shellBase === '/' ? `/remotes/${name}/` : `${shellBase}remotes/${name}/`;
  return `${remoteBase}assets/remoteEntry.js`;
}
