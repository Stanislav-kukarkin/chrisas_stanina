import { GAME_CONFIG, type TaskDifficulty } from './game-config';

export type TaskStatus = 'backlog' | 'planned' | 'in_progress' | 'review' | 'done';
export type TaskDuration = '5m' | '30m' | '1_2h' | 'large';

export interface FamilyMember {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface FamilyTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  authorId: string;
  assigneeIds: string[];
  reviewerId: string;
  difficulty: TaskDifficulty;
  difficultyStatus: 'pending' | 'agreed';
  estimatedDuration?: TaskDuration;
  dueLabel?: string;
  dueTone?: 'normal' | 'soon' | 'overdue';
  blockerIds: string[];
  bonusCoins: number;
  bonusCoinsAuthorId?: string;
  rolloverCount: number;
  recurring?: 'weekly' | 'monthly';
  sprintId?: string;
  rewardSettledAt?: string;
  bossDamageSettledAt?: string;
  reviewStartedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BoardPlayerProfile {
  userId: string;
  displayName: string;
  level: number;
  totalXp: number;
  xp: number;
  xpToNext: number;
  coins: number;
  reservedCoins: number;
  streak: number;
}

export interface SprintBoss {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  potentialDamage: number;
  sprintNumber: number;
  sprintEndsAt?: string;
}

export interface NewTaskInput {
  title: string;
  description?: string;
  status: Extract<TaskStatus, 'backlog' | 'planned'>;
  assigneeId?: string;
  reviewerId: string;
  difficulty: FamilyTask['difficulty'];
  estimatedDuration?: FamilyTask['estimatedDuration'];
  dueLabel?: string;
  recurring?: FamilyTask['recurring'];
  bonusCoins: number;
}

export const TASK_STATUSES: TaskStatus[] = [
  'backlog',
  'planned',
  'in_progress',
  'review',
  'done',
];

export const STATUS_META: Record<
  TaskStatus,
  { label: string; icon: string; accent: string }
> = {
  backlog: { label: 'BACKLOG', icon: '⊙', accent: 'slate' },
  planned: { label: 'PLANNED', icon: '◈', accent: 'violet' },
  in_progress: { label: 'IN PROGRESS', icon: '◐', accent: 'blue' },
  review: { label: 'REVIEW', icon: '◉', accent: 'amber' },
  done: { label: 'DONE', icon: '✓', accent: 'emerald' },
};

const transitions: Record<TaskStatus, TaskStatus[]> = {
  backlog: ['planned'],
  planned: ['in_progress'],
  in_progress: ['review'],
  review: ['done', 'in_progress'],
  done: ['in_progress'],
};

export function unresolvedBlockers(task: FamilyTask, tasks: FamilyTask[]): FamilyTask[] {
  return task.blockerIds
    .map((id) => tasks.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is FamilyTask => Boolean(candidate && candidate.status !== 'done'));
}

export function validateTransition(
  task: FamilyTask,
  target: TaskStatus,
  tasks: FamilyTask[],
): string | null {
  if (!transitions[task.status].includes(target)) {
    return 'Этот переход недоступен в текущем workflow.';
  }
  if (target === 'in_progress' && task.status === 'planned') {
    if (task.difficultyStatus !== 'agreed') {
      return 'Сначала согласуйте сложность задачи.';
    }
    if (unresolvedBlockers(task, tasks).length > 0) {
      return 'Задача пока заблокирована зависимостями.';
    }
  }
  return null;
}

export function nextPrimaryStatus(task: FamilyTask): TaskStatus | null {
  if (task.status === 'backlog') return 'planned';
  if (task.status === 'planned') return 'in_progress';
  if (task.status === 'in_progress') return 'review';
  if (task.status === 'review') return 'done';
  return null;
}

export function primaryActionLabel(task: FamilyTask): string | null {
  if (task.status === 'backlog') return 'Запланировать';
  if (task.status === 'planned') return 'Начать';
  if (task.status === 'in_progress') return 'На проверку';
  if (task.status === 'review') return 'Подтвердить';
  return null;
}

export function taskReward(task: FamilyTask) {
  const base = GAME_CONFIG.difficulty[task.difficulty];
  return {
    xp: base.xp,
    coins: base.coins + task.bonusCoins,
    bossDamage: base.bossDamage,
  };
}

export function settleCompletion(task: FamilyTask, settledAt: string) {
  if (task.rewardSettledAt) {
    return { task, reward: null };
  }
  return {
    task: {
      ...task,
      rewardSettledAt: settledAt,
      bossDamageSettledAt: task.bossDamageSettledAt ?? settledAt,
    },
    reward: taskReward(task),
  };
}

export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 100;
  const earlyCurve = 100 * 1.5 ** Math.min(level - 1, 6);
  const lateLevels = Math.max(0, level - 7);
  return Math.round(earlyCurve + lateLevels * 180 + lateLevels ** 1.35 * 28);
}

export function profileFromTotalXp(totalXp: number) {
  let level = 1;
  let remainder = Math.max(0, totalXp);
  let threshold = xpRequiredForLevel(level);
  while (remainder >= threshold && level < 10_000) {
    remainder -= threshold;
    level += 1;
    threshold = xpRequiredForLevel(level);
  }
  return { level, xp: remainder, xpToNext: threshold };
}
