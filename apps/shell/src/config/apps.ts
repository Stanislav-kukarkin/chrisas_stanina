import {
  APP_DESCRIPTIONS,
  APP_LABELS,
  type RemoteName,
} from '@chrisasstanina/shared-federation';

export interface AppCard {
  id: RemoteName;
  title: string;
  description: string;
  path: string;
}

/** Приложения, которые показываем на главной (остальные — placeholder). */
export const VISIBLE_APP_IDS = ['shopping', 'salary'] as const satisfies readonly RemoteName[];

export const APP_CARDS: AppCard[] = VISIBLE_APP_IDS.map((id) => ({
  id,
  title: APP_LABELS[id],
  description: APP_DESCRIPTIONS[id],
  path: `/apps/${id}`,
}));
