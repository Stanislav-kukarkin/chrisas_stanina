import { validateTransition, type TaskStatus } from '../../domain/task';
import {
  acceptRemoteTaskTransfer,
  agreeRemoteTaskDifficulty,
  claimRemoteTask,
  createRemoteTask,
  declineRemoteTaskDifficulty,
  deleteRemoteTask,
  leaveRemoteTask,
  moveRemoteTask,
  proposeRemoteTaskDifficulty,
  rejectRemoteTaskTransfer,
  updateRemoteTask,
} from '../../services/tasks-service';
import { errorMessage, pending, toast, type TasksGet, type TasksSet } from '../tasks-store.helpers';
import type { TasksState } from '../tasks-store.types';

type TaskActions = Pick<TasksState,
  | 'moveTask' | 'agreeDifficulty' | 'proposeDifficulty' | 'declineDifficulty' | 'takeTask'
  | 'acceptTransfer' | 'rejectTransfer' | 'leaveTask' | 'createTask' | 'updateTask' | 'deleteTask'>;

export function createTaskActions(set: TasksSet, get: TasksGet): TaskActions {
  return {
    moveTask: async (taskId, target) => {
      const state = get();
      const task = state.tasks.find((candidate) => candidate.id === taskId);
      if (!task) return false;
      if (!state.canEdit || state.syncState !== 'live') {
        set({ toast: toast('Только просмотр', 'Для изменений нужен доступ на редактирование.', 'warning') });
        return false;
      }
      const error = validateTransition(task, target, state.tasks);
      if (error) {
        set({ toast: toast('Переход недоступен', error, 'warning') });
        return false;
      }
      set({ pendingTaskIds: pending(state, taskId, true) });
      try {
        const result = await moveRemoteTask(taskId, target);
        const copy: Partial<Record<TaskStatus, string>> = {
          planned: 'Задача добавлена в спринт', in_progress: 'Работа начата', review: 'Задача отправлена на проверку',
        };
        set({
          pendingTaskIds: pending(get(), taskId, false),
          toast: result.reward
            ? toast('Задача подтверждена!', `+${result.reward.xp} XP · +${result.reward.coins} Coins · −${result.reward.bossDamage} HP`, 'success')
            : toast(copy[target] ?? 'Статус обновлён', task.title, 'neutral'),
        });
        return true;
      } catch (errorValue) {
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Не удалось обновить задачу', errorMessage(errorValue), 'warning') });
        return false;
      }
    },
    agreeDifficulty: async (taskId) => {
      set({ pendingTaskIds: pending(get(), taskId, true) });
      try {
        await agreeRemoteTaskDifficulty(taskId);
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Сложность согласована', 'Награда и обязательство зафиксированы.', 'success') });
      } catch (errorValue) {
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Не удалось согласовать', errorMessage(errorValue), 'warning') });
      }
    },
    proposeDifficulty: async (taskId, taskDifficulty) => {
      set({ pendingTaskIds: pending(get(), taskId, true) });
      try {
        await proposeRemoteTaskDifficulty(taskId, taskDifficulty);
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Предложение отправлено', 'Вторая сторона должна подтвердить сложность.', 'neutral') });
      } catch (errorValue) {
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Не удалось предложить сложность', errorMessage(errorValue), 'warning') });
      }
    },
    declineDifficulty: async (taskId) => {
      set({ pendingTaskIds: pending(get(), taskId, true) });
      try {
        await declineRemoteTaskDifficulty(taskId);
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Назначение отклонено', 'Задача возвращена в Backlog.', 'neutral') });
      } catch (errorValue) {
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Не удалось отказаться', errorMessage(errorValue), 'warning') });
      }
    },
    takeTask: async (taskId) => {
      set({ pendingTaskIds: pending(get(), taskId, true) });
      try {
        await claimRemoteTask(taskId);
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Задача ваша', 'Теперь подтвердите её сложность.', 'neutral') });
      } catch (errorValue) {
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Не удалось взять задачу', errorMessage(errorValue), 'warning') });
      }
    },
    acceptTransfer: async (taskId) => {
      set({ pendingTaskIds: pending(get(), taskId, true) });
      try {
        await acceptRemoteTaskTransfer(taskId);
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Передача подтверждена', 'Новый состав исполнителей сохранён без штрафа.', 'success') });
      } catch (errorValue) {
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Не удалось подтвердить передачу', errorMessage(errorValue), 'warning') });
      }
    },
    rejectTransfer: async (taskId) => {
      set({ pendingTaskIds: pending(get(), taskId, true) });
      try {
        await rejectRemoteTaskTransfer(taskId);
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Передача отклонена', 'Текущие исполнители не изменились.', 'neutral') });
      } catch (errorValue) {
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Не удалось отклонить передачу', errorMessage(errorValue), 'warning') });
      }
    },
    leaveTask: async (taskId) => {
      set({ pendingTaskIds: pending(get(), taskId, true) });
      try {
        await leaveRemoteTask(taskId);
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Вы отказались от задачи', 'Coins не списывались; событие сохранено в ленте.', 'neutral') });
      } catch (errorValue) {
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Не удалось отказаться', errorMessage(errorValue), 'warning') });
      }
    },
    createTask: async (input) => {
      if (!get().canEdit) throw new Error('У вас есть только доступ на просмотр.');
      try {
        await createRemoteTask(input);
        set({ createModalOpen: false, editingTaskId: null, toast: toast('Задача создана', 'Исполнителям осталось согласовать сложность.', 'success') });
      } catch (errorValue) {
        set({ toast: toast('Не удалось создать задачу', errorMessage(errorValue), 'warning') });
        throw errorValue;
      }
    },
    updateTask: async (taskId, input) => {
      try {
        await updateRemoteTask(taskId, input);
        set({ createModalOpen: false, editingTaskId: null, toast: toast('Задача обновлена', input.title, 'success') });
      } catch (errorValue) {
        set({ toast: toast('Не удалось обновить задачу', errorMessage(errorValue), 'warning') });
        throw errorValue;
      }
    },
    deleteTask: async (taskId) => {
      set({ pendingTaskIds: pending(get(), taskId, true) });
      try {
        await deleteRemoteTask(taskId);
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Задача удалена', 'Резерв бонуса возвращён автору.', 'neutral') });
      } catch (errorValue) {
        set({ pendingTaskIds: pending(get(), taskId, false), toast: toast('Не удалось удалить задачу', errorMessage(errorValue), 'warning') });
      }
    },
  };
}
