import type { StoreApi } from 'zustand';
import { emptyStreaks } from '../domain/task';
import type { PlayerState, TasksState, ToastState } from './tasks-store.types';

export type TasksSet = StoreApi<TasksState>['setState'];
export type TasksGet = StoreApi<TasksState>['getState'];

export const initialPlayer: PlayerState = {
  level: 1,
  totalXp: 0,
  xp: 0,
  xpToNext: 100,
  coins: 0,
  reservedCoins: 0,
  streaks: emptyStreaks(),
  streakFreezes: 0,
  dailyRerollTokens: 0,
  mysteryChests: 0,
  openedChests: 0,
  shopPurchases: 0,
  claimedMilestones: [],
  achievementIds: [],
};

export function toast(title: string, detail: string, tone: ToastState['tone']): ToastState {
  return { id: Date.now(), title, detail, tone };
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Неизвестная ошибка Firestore.';
}

export function pending(state: TasksState, taskId: string, value: boolean) {
  return value ? [...new Set([...state.pendingTaskIds, taskId])] : state.pendingTaskIds.filter((id) => id !== taskId);
}
