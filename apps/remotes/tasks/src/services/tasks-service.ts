import {
  agreeTaskDifficulty,
  claimTask,
  createTask,
  transitionTask,
  type TasksRepositoryContext,
} from '../repositories/tasks-repository';
import type { NewTaskInput, TaskStatus } from '../domain/task';

interface ServiceContext {
  repository: TasksRepositoryContext;
  canEdit: boolean;
  refresh: () => Promise<void>;
}

let serviceContext: ServiceContext | null = null;

export function configureTasksService(context: ServiceContext | null) {
  serviceContext = context;
}

function context(): ServiceContext {
  if (!serviceContext) throw new Error('Подключение к доске ещё не готово.');
  if (!serviceContext.canEdit) throw new Error('У вас есть только доступ на просмотр.');
  return serviceContext;
}

async function mutateAndRefresh<T>(mutation: (current: ServiceContext) => Promise<T>): Promise<T> {
  const current = context();
  const result = await mutation(current);
  await current.refresh();
  return result;
}

export function createRemoteTask(input: NewTaskInput) {
  return mutateAndRefresh((current) => createTask(current.repository, input));
}

export function moveRemoteTask(taskId: string, target: TaskStatus) {
  return mutateAndRefresh((current) => transitionTask(current.repository, taskId, target));
}

export function agreeRemoteTaskDifficulty(taskId: string) {
  return mutateAndRefresh((current) => agreeTaskDifficulty(current.repository, taskId));
}

export function claimRemoteTask(taskId: string) {
  return mutateAndRefresh((current) => claimTask(current.repository, taskId));
}

