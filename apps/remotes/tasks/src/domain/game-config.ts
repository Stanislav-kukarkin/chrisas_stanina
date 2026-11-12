export type TaskDifficulty = 'easy' | 'normal' | 'hard' | 'epic';

export interface DifficultyReward {
  xp: number;
  coins: number;
  bossDamage: number;
  label: string;
  shortLabel: string;
  stars: string;
}

export interface LevelMilestone {
  level: number;
  coins?: number;
  title?: string;
  frame?: string;
  chests?: number;
}

export const GAME_CONFIG = {
  sprintDays: 14,
  bossTargetRatio: 0.85,
  bossFirstWeekHealRatio: 0.5,
  bossSecondWeekHealRatio: 0.25,
  reviewerReward: 1,
  dailyRerollCost: 5,
  dailyChestCoins: 8,
  duplicateConversionCoins: 50,
  bossVictoryCoins: 50,
  levelMilestones: [
    { level: 5, coins: 50 },
    { level: 10, title: 'Опытный завсегдатай' },
    { level: 15, chests: 1 },
    { level: 20, frame: 'milestone-gold' },
    { level: 25, coins: 100 },
  ] satisfies LevelMilestone[],
  difficulty: {
    easy: { xp: 10, coins: 2, bossDamage: 10, label: 'Лёгко', shortLabel: 'EASY', stars: '★' },
    normal: { xp: 25, coins: 5, bossDamage: 20, label: 'Обычно', shortLabel: 'NORMAL', stars: '★★' },
    hard: { xp: 50, coins: 10, bossDamage: 30, label: 'Сложно', shortLabel: 'HARD', stars: '★★★' },
    epic: { xp: 100, coins: 20, bossDamage: 50, label: 'Эпик', shortLabel: 'EPIC', stars: '☠' },
  } satisfies Record<TaskDifficulty, DifficultyReward>,
  rolloverPenalties: {
    easy: 2,
    normal: 5,
    hard: 10,
    epic: 20,
  } satisfies Record<TaskDifficulty, number>,
  deadlinePenalties: {
    oneToTwoDays: 1,
    threeToFiveDays: 2,
    sixPlusDays: 3,
  },
} as const;
