import { describe, expect, it } from 'vitest';
import { DEMO_TASKS } from '../data/demo-data';
import { settleCompletion, taskReward, validateTransition, type FamilyTask } from './task';

function task(id: string): FamilyTask {
  const found = DEMO_TASKS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing fixture ${id}`);
  return found;
}

describe('family task workflow', () => {
  it('allows only semantic status transitions', () => {
    expect(validateTransition(task('task-3'), 'in_progress', DEMO_TASKS)).toBeNull();
    expect(validateTransition(task('task-3'), 'done', DEMO_TASKS)).toMatch(/workflow/);
    expect(validateTransition(task('task-7'), 'in_progress', DEMO_TASKS)).toBeNull();
  });

  it('requires agreed difficulty before starting', () => {
    const pending = { ...task('task-3'), difficultyStatus: 'pending' as const };
    expect(validateTransition(pending, 'in_progress', DEMO_TASKS)).toMatch(/сложность/i);
  });

  it('prevents starting while a blocker is unfinished', () => {
    const blocked = { ...task('task-3'), blockerIds: ['task-7'] };
    expect(validateTransition(blocked, 'in_progress', DEMO_TASKS)).toMatch(/заблокирована/i);
    const completedBlocker = DEMO_TASKS.map((candidate) =>
      candidate.id === 'task-7' ? { ...candidate, status: 'done' as const } : candidate,
    );
    expect(validateTransition(blocked, 'in_progress', completedBlocker)).toBeNull();
  });
});

describe('gamification settlement', () => {
  it.each([
    ['easy', 10, 2, 10],
    ['normal', 25, 5, 20],
    ['hard', 50, 10, 30],
    ['epic', 100, 20, 50],
  ] as const)('keeps %s rewards data-driven', (difficulty, xp, coins, bossDamage) => {
    const reward = taskReward({ ...task('task-3'), difficulty, bonusCoins: 0 });
    expect(reward).toEqual({ xp, coins, bossDamage });
  });

  it('settles rewards and boss damage only once after a reopen', () => {
    const original = { ...task('task-3'), status: 'review' as const };
    const first = settleCompletion(original, 'first');
    expect(first.reward).toEqual({ xp: 50, coins: 25, bossDamage: 30 });
    expect(first.task.rewardSettledAt).toBe('first');
    expect(first.task.bossDamageSettledAt).toBe('first');

    const reopened = { ...first.task, status: 'in_progress' as const };
    const second = settleCompletion(reopened, 'second');
    expect(second.reward).toBeNull();
    expect(second.task.rewardSettledAt).toBe('first');
  });
});

