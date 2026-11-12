import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, achievementProgress } from './achievements';
import { emptyStreaks, type BoardPlayerProfile, type FamilyTask } from './task';

const profile: BoardPlayerProfile = {
  userId: 'player', displayName: 'Игрок', level: 1, totalXp: 0, xp: 0, xpToNext: 100,
  coins: 1200, reservedCoins: 0, streaks: { ...emptyStreaks(), task: { count: 8 } },
    streakFreezes: 0, dailyRerollTokens: 0, mysteryChests: 0, openedChests: 0, shopPurchases: 0, claimedMilestones: [], achievementIds: [],
};

function doneTask(index: number): FamilyTask {
  return {
    id: `task-${index}`, title: 'Дело', status: 'done', authorId: 'player', assigneeIds: ['player'], reviewerId: 'reviewer',
    difficulty: 'easy', difficultyStatus: 'agreed', blockerIds: [], bonusCoins: 0, rolloverCount: 0,
    rewardSettledAt: '2026-10-07T12:00:00.000Z', completedAt: '2026-10-07T12:00:00.000Z', dueDate: '2026-10-07T18:00:00.000Z',
  };
}

describe('achievement catalogue', () => {
  it('contains the specified launch catalogue', () => {
    expect(ACHIEVEMENTS.filter((item) => !item.secret)).toHaveLength(70);
    expect(ACHIEVEMENTS.filter((item) => item.secret)).toHaveLength(20);
    expect(new Set(ACHIEVEMENTS.map((item) => item.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('unlocks ranked, streak and secret achievements from real metrics', () => {
    const result = achievementProgress({ tasks: Array.from({ length: 10 }, (_, index) => doneTask(index)), profile, history: [], userId: 'player' });
    expect(result.find((item) => item.definition.id === 'worker_bronze')?.unlocked).toBe(true);
    expect(result.find((item) => item.definition.id === 'task_streak_silver')?.unlocked).toBe(true);
    expect(result.find((item) => item.definition.id === 'secret_night_1')?.unlocked).toBe(false);
  });
});
