import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEMO_TASKS, FAMILY_MEMBERS } from '../data/demo-data';
import {
  settleCompletion,
  validateTransition,
  type BoardPlayerProfile,
  type FamilyMember,
  type FamilyTask,
  type NewTaskInput,
  type SprintBoss,
  type TaskStatus,
} from '../domain/task';
import {
  agreeRemoteTaskDifficulty,
  claimRemoteTask,
  createRemoteTask,
  moveRemoteTask,
} from '../services/tasks-service';

export type BoardFilter = 'all' | 'mine' | 'free' | 'today' | 'overdue' | 'blocked' | 'review';
export type AppSection = 'board' | 'history' | 'achievements' | 'shop' | 'bestiary' | 'profile';
export type SyncState = 'demo' | 'loading' | 'live' | 'denied' | 'error';

export interface PlayerState {
  level: number;
  totalXp: number;
  xp: number;
  xpToNext: number;
  coins: number;
  reservedCoins: number;
  streak: number;
}

interface ToastState {
  id: number;
  title: string;
  detail: string;
  tone: 'success' | 'warning' | 'neutral';
}

interface RemoteBoardPayload {
  tasks: FamilyTask[];
  profile: BoardPlayerProfile;
  boss: SprintBoss;
  members: FamilyMember[];
  currentUserId: string;
  canEdit: boolean;
}

interface TasksState {
  tasks: FamilyTask[];
  members: FamilyMember[];
  currentUserId: string;
  player: PlayerState;
  bossHp: number;
  bossMaxHp: number;
  bossName: string;
  sprintNumber: number;
  sprintEndsAt?: string;
  syncState: SyncState;
  syncError: string | null;
  canEdit: boolean;
  pendingTaskIds: string[];
  activeSection: AppSection;
  filter: BoardFilter;
  query: string;
  createModalOpen: boolean;
  toast: ToastState | null;
  setActiveSection: (section: AppSection) => void;
  setFilter: (filter: BoardFilter) => void;
  setQuery: (query: string) => void;
  setCreateModalOpen: (open: boolean) => void;
  dismissToast: () => void;
  setSyncState: (state: SyncState, error?: string) => void;
  hydrateRemoteBoard: (payload: RemoteBoardPayload) => void;
  moveTask: (taskId: string, target: TaskStatus) => Promise<boolean>;
  agreeDifficulty: (taskId: string) => Promise<void>;
  takeTask: (taskId: string) => Promise<void>;
  createTask: (input: NewTaskInput) => Promise<void>;
}

const initialPlayer: PlayerState = {
  level: 17,
  totalXp: 15_740,
  xp: 740,
  xpToNext: 1000,
  coins: 840,
  reservedCoins: 0,
  streak: 14,
};

function toast(title: string, detail: string, tone: ToastState['tone']): ToastState {
  return { id: Date.now(), title, detail, tone };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Неизвестная ошибка Firestore.';
}

function pending(state: TasksState, taskId: string, value: boolean) {
  return value
    ? [...new Set([...state.pendingTaskIds, taskId])]
    : state.pendingTaskIds.filter((id) => id !== taskId);
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: DEMO_TASKS,
      members: FAMILY_MEMBERS,
      currentUserId: 'stas',
      player: initialPlayer,
      bossHp: 630,
      bossMaxHp: 1000,
      bossName: 'Тыквенный Лентяй',
      sprintNumber: 14,
      sprintEndsAt: undefined,
      syncState: 'demo',
      syncError: null,
      canEdit: true,
      pendingTaskIds: [],
      activeSection: 'board',
      filter: 'all',
      query: '',
      createModalOpen: false,
      toast: null,
      setActiveSection: (activeSection) => set({ activeSection }),
      setFilter: (filter) => set({ filter }),
      setQuery: (query) => set({ query }),
      setCreateModalOpen: (createModalOpen) => set({ createModalOpen }),
      dismissToast: () => set({ toast: null }),
      setSyncState: (syncState, syncError) => set({ syncState, syncError: syncError ?? null }),
      hydrateRemoteBoard: ({ tasks, profile, boss, members, currentUserId, canEdit }) => set({
        tasks,
        members: members.length > 0 ? members : [{
          id: currentUserId,
          name: profile.displayName,
          initials: profile.displayName.charAt(0).toLocaleUpperCase('ru-RU') || '•',
          color: '#7c5ce0',
        }],
        currentUserId,
        player: {
          level: profile.level,
          totalXp: profile.totalXp,
          xp: profile.xp,
          xpToNext: profile.xpToNext,
          coins: profile.coins,
          reservedCoins: profile.reservedCoins,
          streak: profile.streak,
        },
        bossHp: boss.hp,
        bossMaxHp: boss.maxHp,
        bossName: boss.name,
        sprintNumber: boss.sprintNumber,
        sprintEndsAt: boss.sprintEndsAt,
        syncState: 'live',
        syncError: null,
        canEdit,
        pendingTaskIds: [],
      }),
      moveTask: async (taskId, target) => {
        const state = get();
        const task = state.tasks.find((candidate) => candidate.id === taskId);
        if (!task) return false;
        if (!state.canEdit) {
          set({ toast: toast('Только просмотр', 'Для изменений нужен доступ на редактирование.', 'warning') });
          return false;
        }
        const error = validateTransition(task, target, state.tasks);
        if (error) {
          set({ toast: toast('Переход недоступен', error, 'warning') });
          return false;
        }

        if (state.syncState === 'live') {
          set({ pendingTaskIds: pending(state, taskId, true) });
          try {
            const result = await moveRemoteTask(taskId, target);
            const sectionCopy: Partial<Record<TaskStatus, string>> = {
              planned: 'Задача добавлена в спринт',
              in_progress: 'Работа начата',
              review: 'Задача отправлена на проверку',
            };
            set({
              pendingTaskIds: pending(get(), taskId, false),
              toast: result.reward
                ? toast('Задача подтверждена!', `+${result.reward.xp} XP · +${result.reward.coins} Coins · −${result.reward.bossDamage} HP боссу`, 'success')
                : toast(sectionCopy[target] ?? 'Статус обновлён', task.title, 'neutral'),
            });
            return true;
          } catch (remoteError) {
            set({
              pendingTaskIds: pending(get(), taskId, false),
              toast: toast('Не удалось обновить задачу', errorMessage(remoteError), 'warning'),
            });
            return false;
          }
        }

        const now = new Date().toISOString();
        const settlement = target === 'done' ? settleCompletion(task, now) : null;
        const reward = settlement?.reward ?? null;
        const nextTask: FamilyTask = { ...(settlement?.task ?? task), status: target };
        const tasks = state.tasks.map((candidate) => (candidate.id === taskId ? nextTask : candidate));
        if (reward) {
          const xp = state.player.xp + reward.xp;
          const levelUps = Math.floor(xp / state.player.xpToNext);
          set({
            tasks,
            bossHp: Math.max(0, state.bossHp - reward.bossDamage),
            player: {
              ...state.player,
              level: state.player.level + levelUps,
              totalXp: state.player.totalXp + reward.xp,
              xp: xp % state.player.xpToNext,
              coins: state.player.coins + reward.coins,
            },
            toast: toast('Задача подтверждена!', `+${reward.xp} XP · +${reward.coins} Coins · −${reward.bossDamage} HP боссу`, 'success'),
          });
          return true;
        }
        const sectionCopy: Partial<Record<TaskStatus, string>> = {
          planned: 'Задача добавлена в спринт',
          in_progress: 'Работа начата',
          review: 'Задача отправлена на проверку',
        };
        set({ tasks, toast: toast(sectionCopy[target] ?? 'Статус обновлён', task.title, 'neutral') });
        return true;
      },
      agreeDifficulty: async (taskId) => {
        const state = get();
        if (state.syncState === 'live') {
          set({ pendingTaskIds: pending(state, taskId, true) });
          try {
            await agreeRemoteTaskDifficulty(taskId);
            set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Сложность согласована', 'Теперь задачу можно начать.', 'success') });
          } catch (remoteError) {
            set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Не удалось согласовать', errorMessage(remoteError), 'warning') });
          }
          return;
        }
        set((current) => ({
          tasks: current.tasks.map((task) => task.id === taskId ? { ...task, difficultyStatus: 'agreed' } : task),
          toast: toast('Сложность согласована', 'Теперь задачу можно взять в спринт.', 'success'),
        }));
      },
      takeTask: async (taskId) => {
        const state = get();
        if (state.syncState === 'live') {
          set({ pendingTaskIds: pending(state, taskId, true) });
          try {
            await claimRemoteTask(taskId);
            set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Задача ваша', 'Она появилась в фильтре «Мои».', 'neutral') });
          } catch (remoteError) {
            set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Не удалось взять задачу', errorMessage(remoteError), 'warning') });
          }
          return;
        }
        set((current) => ({
          tasks: current.tasks.map((task) => task.id === taskId ? { ...task, assigneeIds: [current.currentUserId] } : task),
          toast: toast('Задача ваша', 'Она появилась в фильтре «Мои».', 'neutral'),
        }));
      },
      createTask: async (input) => {
        const state = get();
        if (!state.canEdit) throw new Error('У вас есть только доступ на просмотр.');
        if (state.syncState === 'live') {
          try {
            await createRemoteTask(input);
            set({
              createModalOpen: false,
              toast: toast('Задача создана', input.status === 'planned' ? 'Она уже в текущем спринте.' : 'Идея добавлена в Backlog.', 'success'),
            });
            return;
          } catch (remoteError) {
            set({ toast: toast('Не удалось создать задачу', errorMessage(remoteError), 'warning') });
            throw remoteError;
          }
        }
        set((current) => ({
          tasks: [{
            id: `task-${Date.now()}`,
            title: input.title.trim(),
            description: input.description?.trim() || undefined,
            status: input.status,
            authorId: current.currentUserId,
            assigneeIds: input.assigneeId ? [input.assigneeId] : [],
            reviewerId: input.reviewerId,
            difficulty: input.difficulty,
            difficultyStatus: 'agreed',
            estimatedDuration: input.estimatedDuration,
            dueLabel: input.dueLabel?.trim() || undefined,
            dueTone: 'normal',
            blockerIds: [],
            bonusCoins: input.bonusCoins,
            bonusCoinsAuthorId: input.bonusCoins > 0 ? current.currentUserId : undefined,
            rolloverCount: 0,
            recurring: input.recurring,
          }, ...current.tasks],
          createModalOpen: false,
          toast: toast('Задача создана', input.status === 'planned' ? 'Она уже в текущем спринте.' : 'Идея добавлена в Backlog.', 'success'),
        }));
      },
    }),
    {
      name: 'family-tavern-tasks-v2',
      partialize: (state) => state.syncState === 'demo' ? {
        tasks: state.tasks,
        player: state.player,
        bossHp: state.bossHp,
        bossMaxHp: state.bossMaxHp,
      } : {},
    },
  ),
);
