import { describe, expect, it } from 'vitest';
import { buildDailyState, dailyDefinitionIds, dailyRerollPrice } from './daily';
import type { FamilyTask } from './task';

function completedTask(overrides: Partial<FamilyTask> = {}): FamilyTask {
  return {
    id: 'daily-task',
    title: 'Готовая задача',
    status: 'done',
    authorId: 'author',
    assigneeIds: ['player'],
    reviewerId: 'reviewer',
    difficulty: 'hard',
    difficultyStatus: 'agreed',
    blockerIds: [],
    bonusCoins: 0,
    rolloverCount: 0,
    completedAt: '2026-10-06T12:00:00.000Z',
    ...overrides,
  };
}

describe('daily quests', () => {
  it('uses stable quest ids for the same day and reroll', () => {
    expect(dailyDefinitionIds('2026-10-06', 2)).toEqual(dailyDefinitionIds('2026-10-06', 2));
    expect(new Set(dailyDefinitionIds('2026-10-06', 2)).size).toBe(3);
  });

  it('derives progress from completed tasks instead of stored counters', () => {
    const state = buildDailyState(
      [completedTask()],
      'player',
      { questIds: ['complete_one', 'earn_xp', 'hard_one'] },
      new Date('2026-10-06T18:00:00.000Z'),
    );

    expect(state.quests.map((quest) => quest.progress)).toEqual([1, 50, 1]);
    expect(new Date(state.nextResetAt).getTime()).toBeGreaterThan(new Date('2026-10-06T18:00:00.000Z').getTime());
  });

  it('keeps the first reroll free and charges later rerolls', () => {
    expect(dailyRerollPrice(0)).toBe(0);
    expect(dailyRerollPrice(1)).toBeGreaterThan(0);
  });
});
