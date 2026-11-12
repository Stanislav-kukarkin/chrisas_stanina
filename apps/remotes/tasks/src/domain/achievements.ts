import type { BoardPlayerProfile, FamilyTask, SprintHistoryItem } from './task';

export type AchievementCategory = 'tasks' | 'streak' | 'deadlines' | 'review' | 'boss' | 'sprint' | 'economy' | 'shop' | 'social' | 'daily' | 'secret' | 'tavern';
export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type AchievementRank = 'bronze' | 'silver' | 'gold' | 'diamond';
export type AchievementMetric =
  | 'completed' | 'onTime' | 'reviews' | 'bosses' | 'coins'
  | 'taskStreak' | 'dailyStreak' | 'deadlineStreak' | 'reviewStreak' | 'bossStreak'
  | 'rollovers' | 'nightTasks' | 'shopPurchases' | 'openedChests' | 'sprintWins'
  | 'bossDamage' | 'finalHits' | 'hardTasks' | 'epicTasks' | 'recurringTasks'
  | 'collaborations' | 'sameDayTasks' | 'oldTasks' | 'bonusTasks' | 'weekendTasks'
  | 'morningTasks' | 'noDeadlineTasks' | 'perfectSprints';

export interface AchievementDefinition {
  id: string;
  family: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  rank?: AchievementRank;
  target: number;
  secret?: boolean;
  rewardCoins: number;
  rewardXp: number;
  rewardTitle?: string;
  rewardFrame?: string;
  rewardChests?: number;
  metric: AchievementMetric;
}

const ranks = [
  { rank: 'bronze', rarity: 'common', rewardCoins: 10, rewardXp: 25 },
  { rank: 'silver', rarity: 'rare', rewardCoins: 25, rewardXp: 75 },
  { rank: 'gold', rarity: 'epic', rewardCoins: 50, rewardXp: 150 },
  { rank: 'diamond', rarity: 'legendary', rewardCoins: 150, rewardXp: 500 },
] as const;

interface RankedFamily {
  family: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  metric: AchievementMetric;
  targets: readonly [number, number, number, number];
}

const rankedFamilies: RankedFamily[] = [
  { family: 'worker', name: 'Работяга', description: 'Завершайте семейные задачи.', icon: '⚔️', category: 'tasks', metric: 'completed', targets: [10, 50, 100, 500] },
  { family: 'deadline', name: 'Гроза дедлайнов', description: 'Закрывайте задачи вовремя.', icon: '⏰', category: 'deadlines', metric: 'onTime', targets: [10, 30, 75, 200] },
  { family: 'reviewer', name: 'Верный вердикт', description: 'Проверяйте задачи без задержки.', icon: '🔍', category: 'review', metric: 'reviews', targets: [5, 25, 75, 200] },
  { family: 'boss_hunter', name: 'Гроза чудовищ', description: 'Участвуйте в победах над боссами.', icon: '👹', category: 'boss', metric: 'bosses', targets: [1, 5, 15, 40] },
  { family: 'merchant', name: 'Завсегдатай лавки', description: 'Покупайте полезные предметы.', icon: '🛒', category: 'shop', metric: 'shopPurchases', targets: [3, 10, 30, 75] },
  { family: 'chest', name: 'Искатель сокровищ', description: 'Открывайте Mystery Chest.', icon: '🎁', category: 'shop', metric: 'openedChests', targets: [1, 10, 30, 75] },
  { family: 'champion', name: 'Чемпион таверны', description: 'Становитесь чемпионом спринта.', icon: '👑', category: 'sprint', metric: 'sprintWins', targets: [1, 3, 10, 25] },
  { family: 'damage', name: 'Сокрушитель', description: 'Наносите урон общему боссу.', icon: '💥', category: 'boss', metric: 'bossDamage', targets: [100, 500, 2_000, 10_000] },
  { family: 'daily_streak', name: 'Ритуал таверны', description: 'Закрывайте все Daily подряд.', icon: '🎯', category: 'daily', metric: 'dailyStreak', targets: [3, 7, 30, 100] },
  { family: 'task_streak', name: 'Неугасимый', description: 'Выполняйте хотя бы одну задачу каждый день.', icon: '🔥', category: 'streak', metric: 'taskStreak', targets: [3, 7, 30, 100] },
  { family: 'deadline_streak', name: 'Точно в срок', description: 'Сохраняйте серию задач без просрочки.', icon: '⌛', category: 'streak', metric: 'deadlineStreak', targets: [3, 10, 30, 100] },
  { family: 'review_streak', name: 'Страж Review', description: 'Проверяйте задачи вовремя сериями.', icon: '🧐', category: 'streak', metric: 'reviewStreak', targets: [3, 10, 30, 100] },
  { family: 'hard_worker', name: 'Крепкий орешек', description: 'Завершайте Hard-задачи.', icon: '⭐⭐⭐', category: 'tasks', metric: 'hardTasks', targets: [3, 15, 40, 100] },
  { family: 'epic_worker', name: 'Эпический размах', description: 'Завершайте Epic-задачи.', icon: '☠️', category: 'tasks', metric: 'epicTasks', targets: [1, 5, 20, 50] },
  { family: 'recurring', name: 'Хранитель ритма', description: 'Закрывайте повторяющиеся задачи.', icon: '🔁', category: 'tasks', metric: 'recurringTasks', targets: [3, 15, 50, 150] },
  { family: 'cooperation', name: 'Семейный подряд', description: 'Завершайте совместные задачи.', icon: '🤝', category: 'social', metric: 'collaborations', targets: [3, 15, 50, 150] },
];

function rankedAchievements(family: RankedFamily): AchievementDefinition[] {
  return ranks.map((rank, index) => ({
    id: `${family.family}_${rank.rank}`,
    family: family.family,
    name: family.name,
    description: family.description,
    icon: family.icon,
    category: family.category,
    metric: family.metric,
    target: family.targets[index],
    rank: rank.rank,
    rarity: rank.rarity,
    rewardCoins: rank.rewardCoins,
    rewardXp: rank.rewardXp,
    ...(rank.rank === 'diamond' ? { rewardChests: 1 } : {}),
  }));
}

const regularExtras: AchievementDefinition[] = [
  { id: 'boss_streak_3', family: 'boss_streak', name: 'Сезон охоты', description: 'Победите трёх боссов подряд.', icon: '🗡️', category: 'boss', rarity: 'rare', target: 3, rewardCoins: 30, rewardXp: 75, metric: 'bossStreak' },
  { id: 'boss_streak_7', family: 'boss_streak', name: 'Ни одного поражения', description: 'Победите семь боссов подряд.', icon: '🏰', category: 'boss', rarity: 'legendary', target: 7, rewardCoins: 100, rewardXp: 250, rewardTitle: 'Непобедимый охотник', metric: 'bossStreak' },
  { id: 'wallet_500', family: 'wallet', name: 'Полный кошель', description: 'Накопите 500 Coins.', icon: '🪙', category: 'economy', rarity: 'rare', target: 500, rewardCoins: 20, rewardXp: 50, metric: 'coins' },
  { id: 'wallet_2500', family: 'wallet', name: 'Казначей семьи', description: 'Накопите 2500 Coins.', icon: '💰', category: 'economy', rarity: 'legendary', target: 2_500, rewardCoins: 100, rewardXp: 250, rewardFrame: 'treasury', metric: 'coins' },
  { id: 'final_hit_1', family: 'final_hit', name: 'Добивающий удар', description: 'Нанесите последний удар боссу.', icon: '⚡', category: 'boss', rarity: 'epic', target: 1, rewardCoins: 30, rewardXp: 100, rewardTitle: 'Добивающий', metric: 'finalHits' },
  { id: 'perfect_sprint_1', family: 'perfect_sprint', name: 'Идеальный спринт', description: 'Завершите спринт без просрочек и переносов.', icon: '💎', category: 'sprint', rarity: 'epic', target: 1, rewardCoins: 50, rewardXp: 150, rewardChests: 1, metric: 'perfectSprints' },
];

const secretSeed: Array<Omit<AchievementDefinition, 'category' | 'rarity' | 'secret' | 'rewardCoins' | 'rewardXp'>> = [
  { id: 'secret_night_1', family: 'night', name: 'А спать кто будет?', description: 'Завершите задачу глубокой ночью.', icon: '🌚', metric: 'nightTasks', target: 1 },
  { id: 'secret_night_10', family: 'night', name: 'Полуночный дозор', description: 'Завершите десять ночных задач.', icon: '🦉', metric: 'nightTasks', target: 10 },
  { id: 'secret_old_1', family: 'old', name: 'Археолог', description: 'Закройте задачу старше месяца.', icon: '🏺', metric: 'oldTasks', target: 1 },
  { id: 'secret_old_5', family: 'old', name: 'Раскопки века', description: 'Закройте пять очень старых задач.', icon: '🦴', metric: 'oldTasks', target: 5 },
  { id: 'secret_rollover_3', family: 'rollover', name: 'Ну наконец-то', description: 'Закройте задачу после трёх переносов.', icon: '🦥', metric: 'rollovers', target: 1 },
  { id: 'secret_rollover_10', family: 'rollover', name: 'Путешественник во времени', description: 'Закройте десять задач после трёх переносов.', icon: '⌛', metric: 'rollovers', target: 10 },
  { id: 'secret_day_5', family: 'one_day', name: 'Это было легендарно', description: 'Закройте пять задач за один день.', icon: '🌪️', metric: 'sameDayTasks', target: 5 },
  { id: 'secret_day_10', family: 'one_day', name: 'Ураган порядка', description: 'Закройте десять задач за один день.', icon: '🌋', metric: 'sameDayTasks', target: 10 },
  { id: 'secret_bonus_5', family: 'bonus', name: 'Охота за наградой', description: 'Закройте пять задач с авторским бонусом.', icon: '💎', metric: 'bonusTasks', target: 5 },
  { id: 'secret_bonus_25', family: 'bonus', name: 'Наёмник таверны', description: 'Закройте 25 задач с авторским бонусом.', icon: '🧿', metric: 'bonusTasks', target: 25 },
  { id: 'secret_weekend_10', family: 'weekend', name: 'Выходных не существует', description: 'Завершите десять задач в выходные.', icon: '🗓️', metric: 'weekendTasks', target: 10 },
  { id: 'secret_weekend_50', family: 'weekend', name: 'Хозяин субботы', description: 'Завершите 50 задач в выходные.', icon: '🏕️', metric: 'weekendTasks', target: 50 },
  { id: 'secret_morning_10', family: 'morning', name: 'Ранняя пташка', description: 'Завершите десять задач до восьми утра.', icon: '🌅', metric: 'morningTasks', target: 10 },
  { id: 'secret_morning_50', family: 'morning', name: 'До первого кофе', description: 'Завершите 50 ранних задач.', icon: '☕', metric: 'morningTasks', target: 50 },
  { id: 'secret_no_deadline_25', family: 'free_spirit', name: 'Свободный художник', description: 'Закройте 25 задач без дедлайна.', icon: '🎨', metric: 'noDeadlineTasks', target: 25 },
  { id: 'secret_final_hit_3', family: 'final_secret', name: 'Охотник', description: 'Нанесите три добивающих удара.', icon: '🏹', metric: 'finalHits', target: 3 },
  { id: 'secret_final_hit_10', family: 'final_secret', name: 'Палач хаоса', description: 'Нанесите десять добивающих ударов.', icon: '🪓', metric: 'finalHits', target: 10 },
  { id: 'secret_coop_25', family: 'coop_secret', name: 'Один за всех', description: 'Завершите 25 совместных задач.', icon: '🫶', metric: 'collaborations', target: 25 },
  { id: 'secret_chest_25', family: 'chest_secret', name: 'Что в коробке?', description: 'Откройте 25 сундуков.', icon: '📦', metric: 'openedChests', target: 25 },
  { id: 'secret_treasurer', family: 'treasurer', name: 'Драконья казна', description: 'Накопите 5000 Coins.', icon: '🐉', metric: 'coins', target: 5_000 },
];

const secretAchievements: AchievementDefinition[] = secretSeed.map((definition, index) => ({
  ...definition,
  category: 'secret',
  rarity: index % 5 === 4 ? 'legendary' : index % 2 === 0 ? 'epic' : 'rare',
  secret: true,
  rewardCoins: index % 5 === 4 ? 100 : 30,
  rewardXp: index % 5 === 4 ? 250 : 75,
  ...(index % 5 === 4 ? { rewardChests: 1 } : {}),
}));

/** 70 visible achievements and 20 secrets, all driven by persisted game facts. */
export const ACHIEVEMENTS: AchievementDefinition[] = [
  ...rankedFamilies.flatMap(rankedAchievements),
  ...regularExtras,
  ...secretAchievements,
];

export interface AchievementContext {
  tasks: FamilyTask[];
  profile: BoardPlayerProfile;
  history: SprintHistoryItem[];
  userId: string;
}

function completedBy(context: AchievementContext) {
  return context.tasks.filter((task) => task.assigneeIds.includes(context.userId) && Boolean(task.rewardSettledAt || task.completedAt));
}

function hourOf(task: FamilyTask) { return task.completedAt ? new Date(task.completedAt).getHours() : -1; }

export function achievementMetric(definition: AchievementDefinition, context: AchievementContext): number {
  const completed = completedBy(context);
  switch (definition.metric) {
    case 'completed': return completed.length;
    case 'onTime': return completed.filter((task) => !task.dueDate || !task.completedAt || new Date(task.completedAt) <= new Date(task.dueDate)).length;
    case 'reviews': return context.tasks.filter((task) => task.reviewerId === context.userId && Boolean(task.rewardSettledAt)).length;
    case 'bosses': return context.history.filter((sprint) => sprint.bossDefeated && sprint.participantIds?.includes(context.userId)).length;
    case 'coins': return context.profile.coins;
    case 'taskStreak': return context.profile.streaks.task.count;
    case 'dailyStreak': return context.profile.streaks.daily.count;
    case 'deadlineStreak': return context.profile.streaks.deadline.count;
    case 'reviewStreak': return context.profile.streaks.review.count;
    case 'bossStreak': return context.profile.streaks.boss.count;
    case 'shopPurchases': return context.profile.shopPurchases;
    case 'openedChests': return context.profile.openedChests;
    case 'sprintWins': return context.history.filter((sprint) => sprint.championId === context.userId).length;
    case 'bossDamage': return Math.round(context.history.reduce((sum, sprint) => sum + (sprint.results?.find((result) => result.userId === context.userId)?.bossDamage ?? 0), 0));
    case 'finalHits': return context.history.filter((sprint) => sprint.boss?.finalHitUserId === context.userId).length;
    case 'hardTasks': return completed.filter((task) => task.difficulty === 'hard').length;
    case 'epicTasks': return completed.filter((task) => task.difficulty === 'epic').length;
    case 'recurringTasks': return completed.filter((task) => Boolean(task.recurrenceTemplateId || task.recurrence)).length;
    case 'collaborations': return completed.filter((task) => task.assigneeIds.length > 1).length;
    case 'rollovers': return completed.filter((task) => task.rolloverCount >= 3).length;
    case 'nightTasks': return completed.filter((task) => { const hour = hourOf(task); return hour >= 23 || (hour >= 0 && hour < 5); }).length;
    case 'morningTasks': return completed.filter((task) => { const hour = hourOf(task); return hour >= 5 && hour < 8; }).length;
    case 'weekendTasks': return completed.filter((task) => task.completedAt && [0, 6].includes(new Date(task.completedAt).getDay())).length;
    case 'noDeadlineTasks': return completed.filter((task) => !task.dueDate).length;
    case 'bonusTasks': return completed.filter((task) => task.bonusCoins > 0).length;
    case 'oldTasks': return completed.filter((task) => task.createdAt && task.completedAt && new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime() >= 30 * 86_400_000).length;
    case 'sameDayTasks': {
      const counts = completed.reduce<Record<string, number>>((result, task) => {
        if (task.completedAt) result[task.completedAt.slice(0, 10)] = (result[task.completedAt.slice(0, 10)] ?? 0) + 1;
        return result;
      }, {});
      return Math.max(0, ...Object.values(counts));
    }
    case 'perfectSprints': return context.history.filter((sprint) => sprint.totalTasks > 0 && sprint.completedTasks === sprint.totalTasks && sprint.rolledOverTasks === 0 && sprint.onTimeRate === 100).length;
  }
}

export function achievementProgress(context: AchievementContext) {
  return ACHIEVEMENTS.map((definition) => {
    const actualValue = achievementMetric(definition, context);
    const persisted = context.profile.achievementIds.includes(definition.id);
    return { definition, value: persisted ? Math.max(actualValue, definition.target) : actualValue, unlocked: persisted || actualValue >= definition.target };
  });
}
