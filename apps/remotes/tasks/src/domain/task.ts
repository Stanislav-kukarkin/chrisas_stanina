import { GAME_CONFIG, type TaskDifficulty } from './game-config';

export type TaskStatus = 'backlog' | 'planned' | 'in_progress' | 'review' | 'done';
export type TaskDuration = '5m' | '30m' | '1_2h' | 'large';
export type RecurrenceFrequency = 'weekly' | 'monthly';
export type DifficultyStatus = 'pending' | 'agreed' | 'declined';
export type StreakKind = 'daily' | 'task' | 'deadline' | 'review' | 'boss';
export type SprintTarget = 'current' | 'next';

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
  difficultyStatus: DifficultyStatus;
  difficultyProposedById?: string;
  pendingAssigneeIds?: string[];
  transferRequestedById?: string;
  transferRequestedAt?: string;
  estimatedDuration?: TaskDuration;
  dueDate?: string;
  blockerIds: string[];
  bonusCoins: number;
  bonusCoinsAuthorId?: string;
  bonusReservedAt?: string;
  bossPlannedAt?: string;
  rolloverCount: number;
  recurrence?: RecurrenceFrequency;
  recurrenceTemplateId?: string;
  recurrenceDateKey?: string;
  sprintId?: string;
  rewardSettledAt?: string;
  bossDamageSettledAt?: string;
  reviewStartedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlayerStreak {
  count: number;
  lastDate?: string;
}

export type PlayerStreaks = Record<StreakKind, PlayerStreak>;

export interface BoardPlayerProfile {
  userId: string;
  displayName: string;
  level: number;
  totalXp: number;
  xp: number;
  xpToNext: number;
  coins: number;
  reservedCoins: number;
  streaks: PlayerStreaks;
  streakFreezes: number;
  dailyRerollTokens: number;
  mysteryChests: number;
  openedChests: number;
  shopPurchases: number;
  claimedMilestones: number[];
  achievementIds: string[];
  activeTitle?: string;
  activeFrame?: string;
  activeEffect?: string;
  activeBackground?: string;
  avatarOverride?: string;
}

export interface SprintBoss {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  potentialDamage: number;
  sprintNumber: number;
  sprintId: string;
  sprintEndsAt?: string;
  archetype: string;
  season: string;
  description: string;
  quote: string;
  visualTraits: string[];
  icon: string;
  finalHitUserId?: string;
  finalHitTaskId?: string;
}

export interface SprintPlayerResult {
  userId: string;
  xp: number;
  completedTasks: number;
  bossDamage: number;
}

export interface SprintHistoryItem {
  id: string;
  number: number;
  startedAt?: string;
  endedAt?: string;
  completedTasks: number;
  totalTasks: number;
  rolledOverTasks: number;
  onTimeRate: number;
  bossDefeated: boolean;
  boss?: Pick<SprintBoss, 'name' | 'archetype' | 'season' | 'description' | 'quote' | 'visualTraits' | 'icon' | 'maxHp' | 'finalHitUserId' | 'finalHitTaskId'>;
  participantIds?: string[];
  championId?: string;
  results?: SprintPlayerResult[];
  tasks?: FamilyTask[];
}

export interface ActivityEvent {
  id: string;
  type: string;
  title: string;
  userIds: string[];
  bossDamage?: number;
  createdAt?: string;
}

export interface CoinTransaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  referenceId?: string;
  createdAt?: string;
}

export interface FamilyReward {
  id: string;
  creatorId: string;
  title: string;
  description?: string;
  price: number;
  quantity?: number;
  cooldownHours?: number;
  isActive: boolean;
}

export interface InventoryItem {
  id: string;
  kind: string;
  name: string;
  icon: string;
  quantity: number;
  value?: string;
  sourceId?: string;
  permanent?: boolean;
  expiresAt?: string;
}

export interface RewardRequest {
  id: string;
  inventoryId: string;
  rewardId?: string;
  requesterId: string;
  creatorId: string;
  title: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
}

export interface RecurrenceTemplate {
  id: string;
  title: string;
  description?: string;
  authorId: string;
  assigneeIds: string[];
  reviewerId: string;
  difficulty: TaskDifficulty;
  estimatedDuration?: TaskDuration;
  blockerIds: string[];
  bonusCoins: number;
  frequency: RecurrenceFrequency;
  nextDueAt: string;
  active: boolean;
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  progress: number;
  rewardCoins: number;
  claimed: boolean;
}

export interface DailyState {
  dateKey: string;
  quests: DailyQuest[];
  rerollCount: number;
  chestClaimed: boolean;
  nextResetAt: string;
}

export interface NewTaskInput {
  title: string;
  description?: string;
  status: Extract<TaskStatus, 'backlog' | 'planned'>;
  assigneeIds: string[];
  reviewerId: string;
  difficulty: TaskDifficulty;
  estimatedDuration?: TaskDuration;
  dueDate?: string;
  blockerIds: string[];
  recurrence?: RecurrenceFrequency;
  bonusCoins: number;
  sprintTarget?: SprintTarget;
}

export type UpdateTaskInput = Omit<NewTaskInput, 'status'>;

export const TASK_STATUSES: TaskStatus[] = ['backlog', 'planned', 'in_progress', 'review', 'done'];

export const STATUS_META: Record<TaskStatus, { label: string; icon: string; accent: string }> = {
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

export function validateTransition(task: FamilyTask, target: TaskStatus, tasks: FamilyTask[]): string | null {
  if (!transitions[task.status].includes(target)) return 'Этот переход недоступен в текущем workflow.';
  if (target === 'in_progress' && task.status === 'planned') {
    if (task.assigneeIds.length === 0) return 'Сначала назначьте исполнителя или возьмите задачу.';
    if (task.difficultyStatus !== 'agreed') return 'Сначала согласуйте сложность задачи.';
    if (unresolvedBlockers(task, tasks).length > 0) return 'Задача пока заблокирована зависимостями.';
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

export function taskReward(task: Pick<FamilyTask, 'difficulty' | 'bonusCoins'>) {
  const base = GAME_CONFIG.difficulty[task.difficulty];
  return { xp: base.xp, coins: base.coins + task.bonusCoins, bossDamage: base.bossDamage };
}

export function bossMaxHpForPotentialDamage(potentialDamage: number): number {
  return Math.max(1, Math.round(Math.max(0, potentialDamage) * GAME_CONFIG.bossTargetRatio));
}

export function rolloverPenaltyForTask(task: Pick<FamilyTask, 'difficulty' | 'status'>): number {
  return task.status === 'review' ? 0 : GAME_CONFIG.rolloverPenalties[task.difficulty];
}

export function settleCompletion(task: FamilyTask, settledAt: string) {
  if (task.rewardSettledAt) return { task, reward: null };
  return {
    task: { ...task, rewardSettledAt: settledAt, bossDamageSettledAt: task.bossDamageSettledAt ?? settledAt },
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

export function dateKey(value: Date | string = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfDay(value: Date | string = new Date()): Date {
  const date = typeof value === 'string' ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function deadlineState(task: Pick<FamilyTask, 'dueDate' | 'status'>, now = new Date()) {
  if (!task.dueDate) return { tone: 'normal' as const, label: '' };
  const due = new Date(task.dueDate);
  const dueDay = startOfDay(due).getTime();
  const today = startOfDay(now).getTime();
  const days = Math.round((dueDay - today) / 86_400_000);
  const formatted = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(due);
  if (task.status !== 'done' && days < 0) return { tone: 'overdue' as const, label: `просрочено ${Math.abs(days)} дн.` };
  if (days === 0) return { tone: 'soon' as const, label: 'сегодня' };
  if (days === 1) return { tone: 'soon' as const, label: 'завтра' };
  return { tone: 'normal' as const, label: formatted };
}

export function deadlinePenalty(task: Pick<FamilyTask, 'dueDate'>, completedAt = new Date()): number {
  if (!task.dueDate) return 0;
  const overdueDays = Math.floor((startOfDay(completedAt).getTime() - startOfDay(task.dueDate).getTime()) / 86_400_000);
  if (overdueDays <= 0) return 0;
  if (overdueDays <= 2) return GAME_CONFIG.deadlinePenalties.oneToTwoDays;
  if (overdueDays <= 5) return GAME_CONFIG.deadlinePenalties.threeToFiveDays;
  return GAME_CONFIG.deadlinePenalties.sixPlusDays;
}

export function nextRecurrenceDate(from: Date | string, frequency: RecurrenceFrequency): Date {
  const next = typeof from === 'string' ? new Date(from) : new Date(from);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

export function updateStreak(streak: PlayerStreak, eventDate: Date | string): PlayerStreak {
  const currentKey = dateKey(eventDate);
  if (streak.lastDate === currentKey) return streak;
  const yesterday = new Date(eventDate);
  yesterday.setDate(yesterday.getDate() - 1);
  return { count: streak.lastDate === dateKey(yesterday) ? streak.count + 1 : 1, lastDate: currentKey };
}

export function emptyStreaks(): PlayerStreaks {
  return {
    daily: { count: 0 },
    task: { count: 0 },
    deadline: { count: 0 },
    review: { count: 0 },
    boss: { count: 0 },
  };
}
