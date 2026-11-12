import { describe, expect, it } from 'vitest';
import {
  deadlinePenalty,
  deadlineState,
  bossMaxHpForPotentialDamage,
  nextRecurrenceDate,
  settleCompletion,
  rolloverPenaltyForTask,
  taskReward,
  updateStreak,
  validateTransition,
  type FamilyTask,
} from './task';

function task(overrides: Partial<FamilyTask> = {}): FamilyTask {
  return {
    id: 'task-1',
    title: 'Задача',
    status: 'planned',
    authorId: 'author',
    assigneeIds: ['assignee'],
    reviewerId: 'reviewer',
    difficulty: 'hard',
    difficultyStatus: 'agreed',
    blockerIds: [],
    bonusCoins: 15,
    rolloverCount: 0,
    ...overrides,
  };
}

describe('family task workflow', () => {
  it('allows only semantic status transitions', () => {
    expect(validateTransition(task(), 'in_progress', [task()])).toBeNull();
    expect(validateTransition(task(), 'done', [task()])).toMatch(/workflow/);
  });

  it('requires an assignee and agreed difficulty before starting', () => {
    expect(validateTransition(task({ assigneeIds: [] }), 'in_progress', [])).toMatch(/исполнителя/i);
    expect(validateTransition(task({ difficultyStatus: 'pending' }), 'in_progress', [])).toMatch(/сложность/i);
  });

  it('prevents starting while a blocker is unfinished', () => {
    const blocked = task({ blockerIds: ['blocker'] });
    const blocker = task({ id: 'blocker', status: 'in_progress' });
    expect(validateTransition(blocked, 'in_progress', [blocked, blocker])).toMatch(/заблокирована/i);
    expect(validateTransition(blocked, 'in_progress', [blocked, { ...blocker, status: 'done' }])).toBeNull();
  });
});

describe('gamification settlement', () => {
  it.each([
    ['easy', 10, 2, 10],
    ['normal', 25, 5, 20],
    ['hard', 50, 10, 30],
    ['epic', 100, 20, 50],
  ] as const)('keeps %s rewards data-driven', (difficulty, xp, coins, bossDamage) => {
    expect(taskReward(task({ difficulty, bonusCoins: 0 }))).toEqual({ xp, coins, bossDamage });
  });

  it('settles rewards and boss damage only once after a reopen', () => {
    const first = settleCompletion(task({ status: 'review' }), 'first');
    expect(first.reward).toEqual({ xp: 50, coins: 25, bossDamage: 30 });
    const second = settleCompletion({ ...first.task, status: 'in_progress' }, 'second');
    expect(second.reward).toBeNull();
    expect(second.task.rewardSettledAt).toBe('first');
  });

  it('derives boss HP from agreed potential damage', () => {
    expect(bossMaxHpForPotentialDamage(100)).toBe(85);
    expect(bossMaxHpForPotentialDamage(0)).toBe(1);
  });

  it('does not penalize an assignee when the task is waiting for review', () => {
    expect(rolloverPenaltyForTask(task({ status: 'review' }))).toBe(0);
    expect(rolloverPenaltyForTask(task({ status: 'in_progress' }))).toBe(10);
  });
});

describe('dates, recurrence and streaks', () => {
  it('derives deadline state and configurable penalty from timestamps', () => {
    const overdue = task({ dueDate: '2026-10-01T12:00:00.000Z' });
    expect(deadlineState(overdue, new Date('2026-10-04T12:00:00.000Z')).tone).toBe('overdue');
    expect(deadlinePenalty(overdue, new Date('2026-10-04T12:00:00.000Z'))).toBe(2);
  });

  it('advances recurrence without accumulating duplicate dates', () => {
    expect(nextRecurrenceDate('2026-10-01T12:00:00.000Z', 'weekly').toISOString()).toBe('2026-10-08T12:00:00.000Z');
    expect(nextRecurrenceDate('2026-10-01T12:00:00.000Z', 'monthly').getMonth()).toBe(10);
  });

  it('increments consecutive streak days once per day', () => {
    const first = updateStreak({ count: 0 }, '2026-10-05T12:00:00.000Z');
    const sameDay = updateStreak(first, '2026-10-05T20:00:00.000Z');
    const nextDay = updateStreak(sameDay, '2026-10-06T12:00:00.000Z');
    expect(sameDay.count).toBe(1);
    expect(nextDay.count).toBe(2);
  });
});
