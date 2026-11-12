import { GAME_CONFIG } from './game-config';
import { dateKey, startOfDay, taskReward, type DailyQuest, type DailyState, type FamilyTask } from './task';

interface DailyDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  rewardCoins: number;
  progress: (tasks: FamilyTask[], userId: string, day: string) => number;
}

function completedToday(tasks: FamilyTask[], userId: string, day: string) {
  return tasks.filter((task) => task.assigneeIds.includes(userId) && task.completedAt && dateKey(task.completedAt) === day);
}

const definitions: DailyDefinition[] = [
  {
    id: 'complete_one', title: 'Разминка', description: 'Заверши 1 задачу', icon: '⚔', target: 1, rewardCoins: 3,
    progress: (tasks, userId, day) => completedToday(tasks, userId, day).length,
  },
  {
    id: 'earn_xp', title: 'Рабочий настрой', description: 'Получи 50 XP', icon: '🔥', target: 50, rewardCoins: 5,
    progress: (tasks, userId, day) => completedToday(tasks, userId, day).reduce((sum, task) => sum + taskReward(task).xp, 0),
  },
  {
    id: 'on_time', title: 'Точно в срок', description: 'Заверши задачу без просрочки', icon: '⏱', target: 1, rewardCoins: 5,
    progress: (tasks, userId, day) => completedToday(tasks, userId, day)
      .filter((task) => !task.dueDate || startOfDay(task.completedAt!).getTime() <= startOfDay(task.dueDate).getTime()).length,
  },
  {
    id: 'review_one', title: 'Верный вердикт', description: 'Проверь 1 задачу', icon: '✓', target: 1, rewardCoins: 3,
    progress: (tasks, userId, day) => tasks.filter((task) => task.reviewerId === userId && task.completedAt && dateKey(task.completedAt) === day).length,
  },
  {
    id: 'hard_one', title: 'Тяжёлая артиллерия', description: 'Заверши Hard или Epic', icon: '◆', target: 1, rewardCoins: 6,
    progress: (tasks, userId, day) => completedToday(tasks, userId, day).filter((task) => task.difficulty === 'hard' || task.difficulty === 'epic').length,
  },
  {
    id: 'complete_two', title: 'Двойной удар', description: 'Заверши 2 задачи', icon: '◈', target: 2, rewardCoins: 5,
    progress: (tasks, userId, day) => completedToday(tasks, userId, day).length,
  },
];

function daySeed(day: string) {
  return [...day].reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

export function dailyDefinitionIds(day: string, rerollCount: number): string[] {
  if (rerollCount === 0) return definitions.slice(0, 3).map((definition) => definition.id);
  const start = (daySeed(day) + rerollCount) % definitions.length;
  return [0, 1, 2].map((offset) => definitions[(start + offset) % definitions.length].id);
}

export function buildDailyState(
  tasks: FamilyTask[],
  userId: string,
  raw: { questIds?: unknown; claimedQuestIds?: unknown; rerollCount?: unknown; chestClaimed?: unknown } | undefined,
  now = new Date(),
): DailyState {
  const day = dateKey(now);
  const rerollCount = typeof raw?.rerollCount === 'number' ? Math.max(0, raw.rerollCount) : 0;
  const selectedIds = Array.isArray(raw?.questIds)
    ? raw.questIds.filter((id): id is string => typeof id === 'string')
    : dailyDefinitionIds(day, rerollCount);
  const claimed = new Set(Array.isArray(raw?.claimedQuestIds)
    ? raw.claimedQuestIds.filter((id): id is string => typeof id === 'string')
    : []);
  const quests: DailyQuest[] = selectedIds
    .map((id) => definitions.find((definition) => definition.id === id))
    .filter((definition): definition is DailyDefinition => Boolean(definition))
    .map((definition) => ({
      id: definition.id,
      title: definition.title,
      description: definition.description,
      icon: definition.icon,
      target: definition.target,
      progress: Math.min(definition.target, definition.progress(tasks, userId, day)),
      rewardCoins: definition.rewardCoins,
      claimed: claimed.has(definition.id),
    }));
  const nextReset = startOfDay(now);
  nextReset.setDate(nextReset.getDate() + 1);
  return {
    dateKey: day,
    quests,
    rerollCount,
    chestClaimed: raw?.chestClaimed === true,
    nextResetAt: nextReset.toISOString(),
  };
}

export function dailyRerollPrice(rerollCount: number) {
  return rerollCount === 0 ? 0 : GAME_CONFIG.dailyRerollCost;
}
