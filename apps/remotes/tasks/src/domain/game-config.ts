export type TaskDifficulty = 'easy' | 'normal' | 'hard' | 'epic';

export interface DifficultyReward {
  xp: number;
  coins: number;
  bossDamage: number;
  label: string;
  shortLabel: string;
  stars: string;
}

export const GAME_CONFIG = {
  sprintDays: 14,
  bossTargetRatio: 0.85,
  bossFirstWeekHealRatio: 0.5,
  bossSecondWeekHealRatio: 0.25,
  reviewerReward: 1,
  difficulty: {
    easy: {
      xp: 10,
      coins: 2,
      bossDamage: 10,
      label: 'Лёгко',
      shortLabel: 'EASY',
      stars: '★',
    },
    normal: {
      xp: 25,
      coins: 5,
      bossDamage: 20,
      label: 'Обычно',
      shortLabel: 'NORMAL',
      stars: '★★',
    },
    hard: {
      xp: 50,
      coins: 10,
      bossDamage: 30,
      label: 'Сложно',
      shortLabel: 'HARD',
      stars: '★★★',
    },
    epic: {
      xp: 100,
      coins: 20,
      bossDamage: 50,
      label: 'Эпик',
      shortLabel: 'EPIC',
      stars: '☠',
    },
  } satisfies Record<TaskDifficulty, DifficultyReward>,
  rolloverPenalties: {
    easy: 2,
    normal: 5,
    hard: 10,
    epic: 20,
  } satisfies Record<TaskDifficulty, number>,
} as const;
