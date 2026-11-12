import {
  agreeTaskDifficulty,
  acceptTaskTransfer,
  claimDailyQuest,
  claimTask,
  createTask,
  createFamilyReward,
  declineTaskDifficulty,
  deleteTask,
  proposeTaskDifficulty,
  reconcileBoard,
  rerollDaily,
  purchaseFamilyReward,
  purchaseSystemItem,
  redeemInventoryItem,
  equipProfileItem,
  leaveTask,
  openMysteryChest,
  rejectTaskTransfer,
  resolveRewardRequest,
  transitionTask,
  updateTask,
  type TasksRepositoryContext,
} from '../repositories/tasks-repository';
import { runTasksCommand, serverTasksCommandsEnabled } from '../repositories/tasks-command-repository';
import type { NewTaskInput, TaskStatus, UpdateTaskInput } from '../domain/task';
import type { TaskDifficulty } from '../domain/game-config';

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
  await reconcileBoard(current.repository);
  await current.refresh();
  return result;
}

export function createRemoteTask(input: NewTaskInput) {
  return mutateAndRefresh((current) => createTask(current.repository, input));
}

export function moveRemoteTask(taskId: string, target: TaskStatus) {
  return mutateAndRefresh((current) => serverTasksCommandsEnabled()
    ? runTasksCommand<{ reward: { xp: number; coins: number; bossDamage: number } | null }>(
      current.repository.familyId,
      { command: 'transitionTask', taskId, target },
    )
    : transitionTask(current.repository, taskId, target));
}

export function agreeRemoteTaskDifficulty(taskId: string) {
  return mutateAndRefresh((current) => serverTasksCommandsEnabled()
    ? runTasksCommand(current.repository.familyId, { command: 'agreeDifficulty', taskId })
    : agreeTaskDifficulty(current.repository, taskId));
}

export function claimRemoteTask(taskId: string) {
  return mutateAndRefresh((current) => claimTask(current.repository, taskId));
}

export function acceptRemoteTaskTransfer(taskId: string) {
  return mutateAndRefresh((current) => acceptTaskTransfer(current.repository, taskId));
}

export function rejectRemoteTaskTransfer(taskId: string) {
  return mutateAndRefresh((current) => rejectTaskTransfer(current.repository, taskId));
}

export function leaveRemoteTask(taskId: string) {
  return mutateAndRefresh((current) => leaveTask(current.repository, taskId));
}

export function updateRemoteTask(taskId: string, input: UpdateTaskInput) {
  return mutateAndRefresh((current) => updateTask(current.repository, taskId, input));
}

export function deleteRemoteTask(taskId: string) {
  return mutateAndRefresh((current) => serverTasksCommandsEnabled()
    ? runTasksCommand(current.repository.familyId, { command: 'deleteTask', taskId })
    : deleteTask(current.repository, taskId));
}

export function proposeRemoteTaskDifficulty(taskId: string, difficulty: TaskDifficulty) {
  return mutateAndRefresh((current) => proposeTaskDifficulty(current.repository, taskId, difficulty));
}

export function declineRemoteTaskDifficulty(taskId: string) {
  return mutateAndRefresh((current) => declineTaskDifficulty(current.repository, taskId));
}

export function claimRemoteDailyQuest(questId: string) {
  return mutateAndRefresh((current) => serverTasksCommandsEnabled()
    ? runTasksCommand(current.repository.familyId, { command: 'claimDaily', questId })
    : claimDailyQuest(current.repository, questId));
}

export function rerollRemoteDaily() {
  return mutateAndRefresh((current) => serverTasksCommandsEnabled()
    ? runTasksCommand(current.repository.familyId, { command: 'rerollDaily' })
    : rerollDaily(current.repository));
}

export function purchaseRemoteSystemItem(itemId: string) {
  return mutateAndRefresh((current) => serverTasksCommandsEnabled()
    ? runTasksCommand<string>(current.repository.familyId, { command: 'purchaseSystemItem', itemId })
    : purchaseSystemItem(current.repository, itemId));
}

export function openRemoteMysteryChest() {
  return mutateAndRefresh((current) => serverTasksCommandsEnabled()
    ? runTasksCommand<string>(current.repository.familyId, { command: 'openMysteryChest' })
    : openMysteryChest(current.repository));
}

export function createRemoteFamilyReward(input: { title: string; description?: string; price: number; quantity?: number; cooldownHours?: number }) {
  return mutateAndRefresh((current) => serverTasksCommandsEnabled()
    ? runTasksCommand(current.repository.familyId, { command: 'createFamilyReward', reward: input })
    : createFamilyReward(current.repository, input));
}

export function resolveRemoteRewardRequest(requestId: string, decision: 'approved' | 'rejected') {
  return mutateAndRefresh((current) => serverTasksCommandsEnabled()
    ? runTasksCommand(current.repository.familyId, { command: 'resolveRewardRequest', requestId, decision })
    : resolveRewardRequest(current.repository, requestId, decision));
}

export function purchaseRemoteFamilyReward(rewardId: string) {
  return mutateAndRefresh((current) => serverTasksCommandsEnabled()
    ? runTasksCommand(current.repository.familyId, { command: 'purchaseFamilyReward', rewardId })
    : purchaseFamilyReward(current.repository, rewardId));
}

export function redeemRemoteInventoryItem(inventoryId: string) {
  return mutateAndRefresh((current) => serverTasksCommandsEnabled()
    ? runTasksCommand(current.repository.familyId, { command: 'redeemInventoryItem', inventoryId })
    : redeemInventoryItem(current.repository, inventoryId));
}

export function equipRemoteProfileItem(inventoryId: string) {
  return mutateAndRefresh((current) => serverTasksCommandsEnabled()
    ? runTasksCommand(current.repository.familyId, { command: 'equipProfileItem', inventoryId })
    : equipProfileItem(current.repository, inventoryId));
}
