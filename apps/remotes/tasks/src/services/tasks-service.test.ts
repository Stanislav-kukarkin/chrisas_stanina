import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  agreeTaskDifficulty,
  claimTask,
  createTask,
  reconcileBoard,
  transitionTask,
} from '../repositories/tasks-repository';
import { runTasksCommand } from '../repositories/tasks-command-repository';
import {
  agreeRemoteTaskDifficulty,
  claimRemoteTask,
  configureTasksService,
  createRemoteTask,
  moveRemoteTask,
} from './tasks-service';

vi.mock('../repositories/tasks-repository', () => ({
  agreeTaskDifficulty: vi.fn(async () => undefined),
  acceptTaskTransfer: vi.fn(async () => undefined),
  claimTask: vi.fn(async () => undefined),
  createTask: vi.fn(async () => 'task-id'),
  reconcileBoard: vi.fn(async () => undefined),
  updateTask: vi.fn(async () => undefined),
  deleteTask: vi.fn(async () => undefined),
  proposeTaskDifficulty: vi.fn(async () => undefined),
  declineTaskDifficulty: vi.fn(async () => undefined),
  leaveTask: vi.fn(async () => undefined),
  rejectTaskTransfer: vi.fn(async () => undefined),
  claimDailyQuest: vi.fn(async () => undefined),
  rerollDaily: vi.fn(async () => undefined),
  transitionTask: vi.fn(async () => ({ reward: null })),
}));

vi.mock('../repositories/tasks-command-repository', () => ({
  serverTasksCommandsEnabled: vi.fn(() => false),
  runTasksCommand: vi.fn(async (_familyId: string, input: { command: string }) => input.command === 'transitionTask'
    ? { reward: null }
    : undefined),
}));

const repository = {
  familyId: 'family',
  currentUserId: 'user',
  currentUserName: 'Игрок',
};

afterEach(() => {
  configureTasksService(null);
  vi.clearAllMocks();
});

describe('tasks service refresh policy', () => {
  it('reads the board again after every successful action', async () => {
    const refresh = vi.fn(async () => undefined);
    configureTasksService({ repository, canEdit: true, refresh });

    await createRemoteTask({
      title: 'Новая задача',
      status: 'backlog',
      assigneeIds: [],
      reviewerId: 'reviewer',
      difficulty: 'easy',
      blockerIds: [],
      bonusCoins: 0,
    });
    await claimRemoteTask('task-id');
    await agreeRemoteTaskDifficulty('task-id');
    await moveRemoteTask('task-id', 'planned');

    expect(createTask).toHaveBeenCalledOnce();
    expect(claimTask).toHaveBeenCalledOnce();
    expect(agreeTaskDifficulty).toHaveBeenCalledOnce();
    expect(transitionTask).toHaveBeenCalledOnce();
    expect(runTasksCommand).not.toHaveBeenCalled();
    expect(reconcileBoard).toHaveBeenCalledTimes(4);
    expect(refresh).toHaveBeenCalledTimes(4);
  });

  it('does not hide a failed write behind a refresh', async () => {
    const refresh = vi.fn(async () => undefined);
    vi.mocked(claimTask).mockRejectedValueOnce(new Error('write failed'));
    configureTasksService({ repository, canEdit: true, refresh });

    await expect(claimRemoteTask('task-id')).rejects.toThrow('write failed');
    expect(refresh).not.toHaveBeenCalled();
  });
});
