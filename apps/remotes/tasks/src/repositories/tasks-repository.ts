import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@chrisasstanina/firebase';
import { buildDailyState, dailyDefinitionIds, dailyRerollPrice } from '../domain/daily';
import { achievementProgress } from '../domain/achievements';
import { generateBoss } from '../domain/boss-generator';
import { GAME_CONFIG, type TaskDifficulty } from '../domain/game-config';
import { SYSTEM_SHOP, mysteryReward } from '../domain/shop';
import { activityFromGamificationEvent, gamificationEventId } from '../domain/gamification-events';
import {
  dateKey,
  bossMaxHpForPotentialDamage,
  deadlinePenalty,
  emptyStreaks,
  nextRecurrenceDate,
  profileFromTotalXp,
  rolloverPenaltyForTask,
  taskReward,
  updateStreak,
  validateTransition,
  type BoardPlayerProfile,
  type ActivityEvent,
  type CoinTransaction,
  type DailyState,
  type FamilyTask,
  type FamilyReward,
  type InventoryItem,
  type NewTaskInput,
  type PlayerStreaks,
  type RecurrenceFrequency,
  type RewardRequest,
  type SprintBoss,
  type SprintHistoryItem,
  type TaskDuration,
  type TaskStatus,
  type UpdateTaskInput,
} from '../domain/task';

export interface TasksRepositoryContext {
  familyId: string;
  currentUserId: string;
  currentUserName: string;
}

export interface BoardBootstrapResult {
  sprintId: string;
}

const validStatuses: TaskStatus[] = ['backlog', 'planned', 'in_progress', 'review', 'done'];
const validDurations: TaskDuration[] = ['5m', '30m', '1_2h', 'large'];
const validDifficulties: TaskDifficulty[] = ['easy', 'normal', 'hard', 'epic'];

function appRootPath(familyId: string) { return `families/${familyId}/apps/tasks`; }
function tasksPath(familyId: string) { return `${appRootPath(familyId)}/tasks`; }
function taskPath(familyId: string, taskId: string) { return `${tasksPath(familyId)}/${taskId}`; }
function profilesPath(familyId: string) { return `${appRootPath(familyId)}/profiles`; }
function profilePath(familyId: string, userId: string) { return `${profilesPath(familyId)}/${userId}`; }
function bossPath(familyId: string) { return `${appRootPath(familyId)}/bosses/current`; }
function sprintPath(familyId: string) { return `${appRootPath(familyId)}/sprints/current`; }
function sprintHistoryPath(familyId: string) { return `${appRootPath(familyId)}/sprintHistory`; }
function recurrencePath(familyId: string) { return `${appRootPath(familyId)}/recurrenceTemplates`; }
function settlementPath(familyId: string, taskId: string) { return `${appRootPath(familyId)}/settlements/taskReward_${taskId}_v1`; }
function activityPath(familyId: string, eventId: string) { return `${appRootPath(familyId)}/activity/${eventId}`; }
function ledgerPath(familyId: string, userId: string, transactionId: string) {
  return `${profilePath(familyId, userId)}/coinTransactions/${transactionId}`;
}
function dailyPath(familyId: string, day: string, userId: string) {
  return `${appRootPath(familyId)}/daily/${day}/players/${userId}`;
}
function inventoryPath(familyId: string, userId: string) { return `${profilePath(familyId, userId)}/inventory`; }
function familyRewardsPath(familyId: string) { return `${appRootPath(familyId)}/familyRewards`; }
function rewardRequestsPath(familyId: string) { return `${appRootPath(familyId)}/rewardRequests`; }
function familyRewardPurchasesPath(familyId: string) { return `${appRootPath(familyId)}/familyRewardPurchases`; }

function db(): Firestore { return getFirebaseFirestore(); }

function asIso(value: unknown): string | undefined {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function asStreaks(data: DocumentData | undefined): PlayerStreaks {
  const empty = emptyStreaks();
  const legacy = typeof data?.streak === 'number' ? Math.max(0, data.streak) : 0;
  const raw = data?.streaks && typeof data.streaks === 'object' ? data.streaks as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(empty).map(([key, fallback]) => {
    const value = raw[key] && typeof raw[key] === 'object' ? raw[key] as Record<string, unknown> : {};
    return [key, {
      count: typeof value.count === 'number' ? Math.max(0, value.count) : key === 'task' ? legacy : fallback.count,
      ...(typeof value.lastDate === 'string' ? { lastDate: value.lastDate } : {}),
    }];
  })) as PlayerStreaks;
}

function mapTaskData(id: string, data: DocumentData): FamilyTask {
  const status = validStatuses.includes(data.status as TaskStatus) ? data.status as TaskStatus : 'backlog';
  const difficulty = validDifficulties.includes(data.difficulty as TaskDifficulty) ? data.difficulty as TaskDifficulty : 'normal';
  const estimatedDuration = validDurations.includes(data.estimatedDuration as TaskDuration)
    ? data.estimatedDuration as TaskDuration
    : undefined;
  const legacyDueDate = typeof data.dueLabel === 'string' && /^\d{4}-\d{2}-\d{2}/.test(data.dueLabel)
    ? data.dueLabel
    : undefined;
  const recurrence = data.recurrence === 'weekly' || data.recurrence === 'monthly'
    ? data.recurrence
    : data.recurring === 'weekly' || data.recurring === 'monthly'
      ? data.recurring
      : undefined;
  return {
    id,
    title: String(data.title ?? ''),
    description: typeof data.description === 'string' ? data.description : undefined,
    status,
    authorId: String(data.authorId ?? ''),
    assigneeIds: asStringArray(data.assigneeIds),
    reviewerId: String(data.reviewerId ?? ''),
    difficulty,
    difficultyStatus: data.difficultyStatus === 'agreed' || data.difficultyStatus === 'declined'
      ? data.difficultyStatus
      : 'pending',
    difficultyProposedById: typeof data.difficultyProposedById === 'string' ? data.difficultyProposedById : undefined,
    pendingAssigneeIds: asStringArray(data.pendingAssigneeIds),
    transferRequestedById: typeof data.transferRequestedById === 'string' ? data.transferRequestedById : undefined,
    transferRequestedAt: asIso(data.transferRequestedAt),
    estimatedDuration,
    dueDate: asIso(data.dueDate) ?? legacyDueDate,
    blockerIds: asStringArray(data.blockerIds),
    bonusCoins: typeof data.bonusCoins === 'number' ? Math.max(0, data.bonusCoins) : 0,
    bonusCoinsAuthorId: typeof data.bonusCoinsAuthorId === 'string' ? data.bonusCoinsAuthorId : undefined,
    bonusReservedAt: asIso(data.bonusReservedAt),
    bossPlannedAt: asIso(data.bossPlannedAt),
    rolloverCount: typeof data.rolloverCount === 'number' ? Math.max(0, data.rolloverCount) : 0,
    recurrence,
    recurrenceTemplateId: typeof data.recurrenceTemplateId === 'string' ? data.recurrenceTemplateId : undefined,
    recurrenceDateKey: typeof data.recurrenceDateKey === 'string' ? data.recurrenceDateKey : undefined,
    sprintId: typeof data.sprintId === 'string' ? data.sprintId : undefined,
    rewardSettledAt: asIso(data.rewardSettledAt),
    bossDamageSettledAt: asIso(data.bossDamageSettledAt),
    reviewStartedAt: asIso(data.reviewStartedAt),
    completedAt: asIso(data.completedAt),
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
  };
}

function mapProfile(userId: string, data: DocumentData | undefined): BoardPlayerProfile {
  const totalXp = typeof data?.xp === 'number' ? Math.max(0, data.xp) : 0;
  const progress = profileFromTotalXp(totalXp);
  return {
    userId,
    displayName: typeof data?.displayName === 'string' && data.displayName ? data.displayName : 'Игрок',
    level: progress.level,
    totalXp,
    xp: progress.xp,
    xpToNext: progress.xpToNext,
    coins: typeof data?.coins === 'number' ? Math.max(0, data.coins) : 0,
    reservedCoins: typeof data?.reservedCoins === 'number' ? Math.max(0, data.reservedCoins) : 0,
    streaks: asStreaks(data),
    streakFreezes: typeof data?.streakFreezes === 'number' ? Math.max(0, data.streakFreezes) : 0,
    dailyRerollTokens: typeof data?.dailyRerollTokens === 'number' ? Math.max(0, data.dailyRerollTokens) : 0,
    mysteryChests: typeof data?.mysteryChests === 'number' ? Math.max(0, data.mysteryChests) : 0,
    openedChests: typeof data?.openedChests === 'number' ? Math.max(0, data.openedChests) : 0,
    shopPurchases: typeof data?.shopPurchases === 'number' ? Math.max(0, data.shopPurchases) : 0,
    claimedMilestones: Array.isArray(data?.claimedMilestones)
      ? data.claimedMilestones.filter((level: unknown): level is number => typeof level === 'number')
      : [],
    achievementIds: asStringArray(data?.achievementIds),
    activeTitle: typeof data?.activeTitle === 'string' ? data.activeTitle : undefined,
    activeFrame: typeof data?.activeFrame === 'string' ? data.activeFrame : undefined,
    activeEffect: typeof data?.activeEffect === 'string' ? data.activeEffect : undefined,
    activeBackground: typeof data?.activeBackground === 'string' ? data.activeBackground : undefined,
    avatarOverride: typeof data?.avatarOverride === 'string' ? data.avatarOverride : undefined,
  };
}

function mapBoss(data: DocumentData | undefined): SprintBoss {
  const generated = generateBoss('legacy', String(data?.sprintId ?? 'sprint-1'));
  return {
    id: 'current',
    name: typeof data?.name === 'string' ? data.name : 'Тыквенный Лентяй',
    hp: typeof data?.hp === 'number' ? Math.max(0, data.hp) : 1,
    maxHp: typeof data?.maxHp === 'number' ? Math.max(1, data.maxHp) : 1,
    potentialDamage: typeof data?.potentialDamage === 'number' ? Math.max(0, data.potentialDamage) : 0,
    sprintNumber: typeof data?.sprintNumber === 'number' ? data.sprintNumber : 1,
    sprintId: typeof data?.sprintId === 'string' ? data.sprintId : 'sprint-1',
    sprintEndsAt: asIso(data?.sprintEndsAt),
    archetype: typeof data?.archetype === 'string' ? data.archetype : generated.archetype,
    season: typeof data?.season === 'string' ? data.season : generated.season,
    description: typeof data?.description === 'string' ? data.description : generated.description,
    quote: typeof data?.quote === 'string' ? data.quote : generated.quote,
    visualTraits: asStringArray(data?.visualTraits),
    icon: typeof data?.icon === 'string' ? data.icon : generated.icon,
    finalHitUserId: typeof data?.finalHitUserId === 'string' ? data.finalHitUserId : undefined,
    finalHitTaskId: typeof data?.finalHitTaskId === 'string' ? data.finalHitTaskId : undefined,
  };
}

function timestampOrNull(value: string | undefined) {
  return value ? Timestamp.fromDate(new Date(value)) : null;
}

function sprintDay(data: DocumentData | undefined): number {
  const startedAt = data?.startedAt instanceof Timestamp ? data.startedAt.toDate().getTime() : Date.now();
  return Math.max(1, Math.floor((Date.now() - startedAt) / 86_400_000) + 1);
}

function bossGrowthForTask(damage: number, day: number) {
  const healRatio = day <= 7 ? GAME_CONFIG.bossFirstWeekHealRatio : GAME_CONFIG.bossSecondWeekHealRatio;
  return { heal: Math.round(damage * healRatio) };
}

function parseLegacyDueLabel(label: string, now = new Date()): Date | null {
  const normalized = label.trim().toLocaleLowerCase('ru-RU');
  const result = new Date(now);
  result.setHours(12, 0, 0, 0);
  if (normalized === 'сегодня') return result;
  if (normalized === 'завтра') { result.setDate(result.getDate() + 1); return result; }
  const overdue = normalized.match(/просрочено\s+(\d+)\s+д/);
  if (overdue) { result.setDate(result.getDate() - Number(overdue[1])); return result; }
  const monthNames = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const shortDate = normalized.match(/^(\d{1,2})\s+([а-яё]+)/);
  if (!shortDate) return null;
  const month = monthNames.findIndex((name) => shortDate[2].startsWith(name));
  if (month < 0) return null;
  result.setMonth(month, Number(shortDate[1]));
  if (result.getTime() < now.getTime() - 180 * 86_400_000) result.setFullYear(result.getFullYear() + 1);
  return result;
}

async function migrateLegacyTasks(familyId: string) {
  const firestore = db();
  const snapshot = await getDocs(collection(firestore, tasksPath(familyId)));
  const batch = writeBatch(firestore);
  let writes = 0;
  snapshot.docs.forEach((taskSnapshot) => {
    const data = taskSnapshot.data();
    const update: DocumentData = {};
    if (!(data.dueDate instanceof Timestamp) && typeof data.dueLabel === 'string') {
      const parsed = parseLegacyDueLabel(data.dueLabel);
      if (parsed) update.dueDate = Timestamp.fromDate(parsed);
      update.dueLabel = deleteField();
      update.dueTone = deleteField();
    }
    if (!data.recurrence && (data.recurring === 'weekly' || data.recurring === 'monthly')) {
      update.recurrence = data.recurring;
      update.recurring = deleteField();
    }
    if (Object.keys(update).length > 0) {
      update.updatedAt = serverTimestamp();
      batch.update(taskSnapshot.ref, update);
      writes += 1;
    }
  });
  if (writes > 0) await batch.commit();
}

function taskDocument(
  input: NewTaskInput,
  context: TasksRepositoryContext,
  sprintId?: string,
  recurrenceTemplateId?: string,
  nextSprintId?: string,
) {
  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: input.status,
    authorId: context.currentUserId,
    assigneeIds: [...new Set(input.assigneeIds)],
    reviewerId: input.reviewerId,
    difficulty: input.difficulty,
    difficultyStatus: 'pending',
    difficultyProposedById: context.currentUserId,
    estimatedDuration: input.estimatedDuration ?? null,
    dueDate: timestampOrNull(input.dueDate),
    sprintId: input.status === 'planned'
      ? input.sprintTarget === 'next' ? nextSprintId ?? sprintId ?? null : sprintId ?? null
      : null,
    blockerIds: [...new Set(input.blockerIds)],
    bonusCoins: Math.max(0, input.bonusCoins),
    bonusCoinsAuthorId: input.bonusCoins > 0 ? context.currentUserId : null,
    rolloverCount: 0,
    recurrence: input.recurrence ?? null,
    recurrenceTemplateId: recurrenceTemplateId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function rolloverTaskDocument(task: FamilyTask, sprintId: string): DocumentData {
  return {
    title: task.title.trim().slice(0, 180) || 'Без названия',
    description: task.description?.trim() || null,
    status: 'planned',
    authorId: task.authorId,
    assigneeIds: [...new Set(task.assigneeIds)],
    reviewerId: task.reviewerId,
    difficulty: task.difficulty,
    difficultyStatus: task.difficultyStatus,
    difficultyProposedById: task.difficultyProposedById ?? null,
    pendingAssigneeIds: [...new Set(task.pendingAssigneeIds ?? [])],
    transferRequestedById: task.transferRequestedById ?? null,
    transferRequestedAt: timestampOrNull(task.transferRequestedAt),
    estimatedDuration: task.estimatedDuration ?? null,
    dueDate: timestampOrNull(task.dueDate),
    sprintId,
    blockerIds: [...new Set(task.blockerIds)].slice(0, 20),
    bonusCoins: Math.min(100, Math.max(0, task.bonusCoins)),
    bonusCoinsAuthorId: task.bonusCoinsAuthorId ?? null,
    bonusReservedAt: timestampOrNull(task.bonusReservedAt),
    bossPlannedAt: serverTimestamp(),
    rolloverCount: task.rolloverCount + 1,
    recurrence: task.recurrence ?? null,
    recurrenceTemplateId: task.recurrenceTemplateId ?? null,
    recurrenceDateKey: task.recurrenceDateKey ?? null,
    rewardSettledAt: timestampOrNull(task.rewardSettledAt),
    bossDamageSettledAt: timestampOrNull(task.bossDamageSettledAt),
    reviewStartedAt: null,
    completedAt: timestampOrNull(task.completedAt),
    createdAt: timestampOrNull(task.createdAt) ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function historyTaskSnapshot(task: FamilyTask): DocumentData {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    authorId: task.authorId,
    assigneeIds: task.assigneeIds,
    reviewerId: task.reviewerId,
    difficulty: task.difficulty,
    difficultyStatus: task.difficultyStatus,
    difficultyProposedById: task.difficultyProposedById ?? null,
    estimatedDuration: task.estimatedDuration ?? null,
    dueDate: task.dueDate ?? null,
    blockerIds: task.blockerIds,
    bonusCoins: task.bonusCoins,
    bonusCoinsAuthorId: task.bonusCoinsAuthorId ?? null,
    rolloverCount: task.rolloverCount,
    recurrence: task.recurrence ?? null,
    recurrenceTemplateId: task.recurrenceTemplateId ?? null,
    recurrenceDateKey: task.recurrenceDateKey ?? null,
    sprintId: task.sprintId ?? null,
    rewardSettledAt: task.rewardSettledAt ?? null,
    bossDamageSettledAt: task.bossDamageSettledAt ?? null,
    reviewStartedAt: task.reviewStartedAt ?? null,
    completedAt: task.completedAt ?? null,
    createdAt: task.createdAt ?? null,
    updatedAt: task.updatedAt ?? null,
  };
}

export async function ensureBoardBootstrap(context: TasksRepositoryContext): Promise<BoardBootstrapResult> {
  const firestore = db();
  const boardRef = doc(firestore, appRootPath(context.familyId));
  const profileRef = doc(firestore, profilePath(context.familyId, context.currentUserId));
  const sprintRef = doc(firestore, sprintPath(context.familyId));
  const bossRef = doc(firestore, bossPath(context.familyId));
  let sprintId = 'sprint-1';
  await runTransaction(firestore, async (transaction) => {
    const [boardSnapshot, profileSnapshot, sprintSnapshot, bossSnapshot] = await Promise.all([
      transaction.get(boardRef), transaction.get(profileRef), transaction.get(sprintRef), transaction.get(bossRef),
    ]);
    const now = new Date();
    const endsAt = new Date(now.getTime() + GAME_CONFIG.sprintDays * 86_400_000);
    const sprintNumber = typeof sprintSnapshot.data()?.number === 'number' ? sprintSnapshot.data()!.number : 1;
    const storedSprintId = typeof sprintSnapshot.data()?.id === 'string' ? sprintSnapshot.data()!.id : '';
    sprintId = !storedSprintId || storedSprintId === 'current' ? `sprint-${sprintNumber}` : storedSprintId;
    if (!boardSnapshot.exists()) transaction.set(boardRef, {
      schemaVersion: 2, activeSprintId: sprintId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    else if (boardSnapshot.data().schemaVersion !== 2 || boardSnapshot.data().activeSprintId !== sprintId) {
      transaction.set(boardRef, { schemaVersion: 2, activeSprintId: sprintId, updatedAt: serverTimestamp() }, { merge: true });
    }
    if (!profileSnapshot.exists()) transaction.set(profileRef, {
      userId: context.currentUserId,
      displayName: context.currentUserName,
      level: 1,
      xp: 0,
      coins: 0,
      reservedCoins: 0,
      streaks: emptyStreaks(),
      streakFreezes: 0,
      dailyRerollTokens: 0,
      mysteryChests: 0,
      openedChests: 0,
      shopPurchases: 0,
      claimedMilestones: [],
      achievementIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (!sprintSnapshot.exists()) transaction.set(sprintRef, {
      id: sprintId, number: 1, status: 'active', startedAt: Timestamp.fromDate(now),
      endsAt: Timestamp.fromDate(endsAt), bossId: 'current', createdAt: serverTimestamp(),
    });
    else if (storedSprintId !== sprintId) transaction.set(sprintRef, { id: sprintId }, { merge: true });
    const generatedBoss = generateBoss(context.familyId, sprintId, now);
    if (!bossSnapshot.exists()) transaction.set(bossRef, {
      id: 'current', ...generatedBoss, hp: 1, maxHp: 1, potentialDamage: 0,
      sprintNumber: 1, sprintId, sprintEndsAt: Timestamp.fromDate(endsAt),
      economyVersion: 2, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    else if (bossSnapshot.data()?.sprintId !== sprintId || typeof bossSnapshot.data()?.description !== 'string') {
      transaction.set(bossRef, {
        sprintId,
        ...(typeof bossSnapshot.data()?.description === 'string' ? {} : generatedBoss),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  });
  return { sprintId };
}

async function reconcileBossModel(context: TasksRepositoryContext) {
  const firestore = db();
  const [bossSnapshot, sprintSnapshot, tasksSnapshot] = await Promise.all([
    getDoc(doc(firestore, bossPath(context.familyId))),
    getDoc(doc(firestore, sprintPath(context.familyId))),
    getDocs(collection(firestore, tasksPath(context.familyId))),
  ]);
  if (!bossSnapshot.exists() || bossSnapshot.data().economyVersion === 2) return;
  const activeSprintId = String(sprintSnapshot.data()?.id ?? 'sprint-1');
  const currentTasks = tasksSnapshot.docs
    .map((snapshot) => mapTaskData(snapshot.id, snapshot.data()))
    .filter((task) => task.sprintId === activeSprintId || task.sprintId === 'current');
  const planned = currentTasks.filter((task) => task.difficultyStatus === 'agreed');
  const potentialDamage = planned.reduce((sum, task) => sum + taskReward(task).bossDamage, 0);
  const maxHp = bossMaxHpForPotentialDamage(potentialDamage);
  const settledDamage = planned
    .filter((task) => Boolean(task.bossDamageSettledAt))
    .reduce((sum, task) => sum + taskReward(task).bossDamage, 0);
  await runTransaction(firestore, async (transaction) => {
    const freshBoss = await transaction.get(doc(firestore, bossPath(context.familyId)));
    if (!freshBoss.exists() || freshBoss.data().economyVersion === 2) return;
    transaction.update(freshBoss.ref, {
      potentialDamage,
      maxHp,
      hp: Math.max(0, maxHp - settledDamage),
      economyVersion: 2,
      updatedAt: serverTimestamp(),
    });
  });
}

async function reconcileExpiredSprint(context: TasksRepositoryContext) {
  const firestore = db();
  const sprintRef = doc(firestore, sprintPath(context.familyId));
  const sprintSnapshot = await getDoc(sprintRef);
  if (!sprintSnapshot.exists()) return;
  const sprint = sprintSnapshot.data();
  const endsAt = sprint.endsAt instanceof Timestamp ? sprint.endsAt.toDate() : null;
  if (!endsAt || endsAt.getTime() > Date.now()) return;
  const currentId = typeof sprint.id === 'string' ? sprint.id : `sprint-${Number(sprint.number ?? 1)}`;
  const currentNumber = typeof sprint.number === 'number' ? sprint.number : 1;
  const nextNumber = currentNumber + 1;
  const nextId = `sprint-${nextNumber}`;
  const tasksSnapshot = await getDocs(collection(firestore, tasksPath(context.familyId)));
  const sprintTasks = tasksSnapshot.docs
    .map((snapshot) => ({ ref: snapshot.ref, task: mapTaskData(snapshot.id, snapshot.data()) }))
    .filter(({ task }) => task.sprintId === currentId || task.sprintId === 'current');
  const unfinished = sprintTasks.filter(({ task }) => task.status !== 'done');
  const participantIds = [...new Set(sprintTasks.filter(({ task }) => task.bossDamageSettledAt).flatMap(({ task }) => task.assigneeIds))];
  const profileIds = [...new Set([...unfinished.flatMap(({ task }) => task.assigneeIds), ...participantIds])];
  const results = participantIds.map((userId) => {
    const completedForPlayer = sprintTasks.filter(({ task }) => task.rewardSettledAt && task.assigneeIds.includes(userId));
    return {
      userId,
      xp: completedForPlayer.reduce((sum, { task }) => sum + taskReward(task).xp, 0),
      completedTasks: completedForPlayer.length,
      bossDamage: Math.round(completedForPlayer.reduce((sum, { task }) => sum + taskReward(task).bossDamage / Math.max(1, task.assigneeIds.length), 0)),
    };
  }).sort((left, right) => right.xp - left.xp || right.completedTasks - left.completedTasks);
  const topDamageId = [...results].sort((left, right) => right.bossDamage - left.bossDamage)[0]?.userId;
  const profileRefs = profileIds.map((id) => doc(firestore, profilePath(context.familyId, id)));
  const historyRef = doc(firestore, `${sprintHistoryPath(context.familyId)}/${currentId}`);
  const bossRef = doc(firestore, bossPath(context.familyId));
  const boardRef = doc(firestore, appRootPath(context.familyId));
  await runTransaction(firestore, async (transaction) => {
    const [freshSprint, historySnapshot, bossSnapshot, ...profileSnapshots] = await Promise.all([
      transaction.get(sprintRef), transaction.get(historyRef), transaction.get(bossRef),
      ...profileRefs.map((reference) => transaction.get(reference)),
    ]);
    if (!freshSprint.exists() || historySnapshot.exists()) return;
    const freshEndsAt = freshSprint.data().endsAt instanceof Timestamp ? freshSprint.data().endsAt.toDate() : null;
    if (!freshEndsAt || freshEndsAt.getTime() > Date.now()) return;
    const now = new Date();
    const nextEndsAt = new Date(now.getTime() + GAME_CONFIG.sprintDays * 86_400_000);
    const preplannedNext = tasksSnapshot.docs
      .map((snapshot) => ({ ref: snapshot.ref, task: mapTaskData(snapshot.id, snapshot.data()) }))
      .filter(({ task }) => task.sprintId === nextId && task.status !== 'done');
    const nextSprintTasks = [...unfinished, ...preplannedNext];
    const nextPotentialDamage = nextSprintTasks.reduce(
      (sum, item) => sum + (item.task.difficultyStatus === 'agreed' ? GAME_CONFIG.difficulty[item.task.difficulty].bossDamage : 0),
      0,
    );
    const nextBossHp = bossMaxHpForPotentialDamage(nextPotentialDamage);
    const bossDefeated = bossSnapshot.exists() && Number(bossSnapshot.data().hp ?? 1) <= 0;
    const nextBoss = generateBoss(context.familyId, nextId, now);
    const penalties = new Map<string, number>();
    unfinished.forEach(({ ref, task }) => {
      transaction.set(ref, rolloverTaskDocument(task, nextId));
      task.assigneeIds.forEach((userId) => penalties.set(
        userId,
        (penalties.get(userId) ?? 0) + rolloverPenaltyForTask(task),
      ));
    });
    profileSnapshots.forEach((snapshot, index) => {
      const userId = profileIds[index];
      const amount = penalties.get(userId) ?? 0;
      const coins = typeof snapshot.data()?.coins === 'number' ? Math.max(0, snapshot.data()!.coins) : 0;
      const victoryReward = bossDefeated && participantIds.includes(userId) ? GAME_CONFIG.bossVictoryCoins : 0;
      const streaks = asStreaks(snapshot.data());
      if (victoryReward > 0) streaks.boss = updateStreak(streaks.boss, new Date());
      else if (participantIds.includes(userId)) streaks.boss = { count: 0 };
      transaction.set(profileRefs[index], {
        coins: Math.max(0, coins - amount + victoryReward),
        mysteryChests: Number(snapshot.data()?.mysteryChests ?? 0) + (victoryReward > 0 ? 1 : 0),
        streaks, updatedAt: serverTimestamp(),
      }, { merge: true });
      if (amount > 0) transaction.set(doc(firestore, ledgerPath(context.familyId, userId, `rollover_${currentId}`)), {
        userId, type: 'rollover_penalty', amount: -Math.min(coins, amount), referenceId: currentId, createdAt: serverTimestamp(),
      });
      if (victoryReward > 0) transaction.set(doc(firestore, ledgerPath(context.familyId, userId, `bossVictory_${currentId}`)), {
        userId, type: 'boss_reward', amount: victoryReward, referenceId: currentId, createdAt: serverTimestamp(),
      });
    });
    if (bossDefeated && topDamageId) transaction.set(
      doc(firestore, `${inventoryPath(context.familyId, topDamageId)}/boss_top_damage_${currentId}`),
      { kind: 'title', name: `Лучший охотник спринта #${currentNumber}`, icon: '🏹', quantity: 1, value: 'Лучший охотник', permanent: true, sourceId: currentId, createdAt: serverTimestamp() },
      { merge: true },
    );
    const finalHitUserId = bossSnapshot.exists() && typeof bossSnapshot.data().finalHitUserId === 'string'
      ? bossSnapshot.data().finalHitUserId as string
      : undefined;
    if (bossDefeated && finalHitUserId) transaction.set(
      doc(firestore, `${inventoryPath(context.familyId, finalHitUserId)}/boss_final_hit_${currentId}`),
      { kind: 'title', name: `Добивающий спринта #${currentNumber}`, icon: '⚡', quantity: 1, value: 'Добивающий', permanent: true, sourceId: currentId, createdAt: serverTimestamp() },
      { merge: true },
    );
    transaction.set(historyRef, {
      id: currentId,
      number: currentNumber,
      startedAt: freshSprint.data().startedAt ?? null,
      endedAt: serverTimestamp(),
      completedTasks: sprintTasks.length - unfinished.length,
      totalTasks: sprintTasks.length,
      rolledOverTasks: unfinished.length,
      onTimeRate: (() => {
        const completed = sprintTasks.filter(({ task }) => task.status === 'done');
        if (completed.length === 0) return 0;
        const onTime = completed.filter(({ task }) => deadlinePenalty(task, task.completedAt ? new Date(task.completedAt) : new Date()) === 0).length;
        return Math.round(onTime / completed.length * 100);
      })(),
      tasks: sprintTasks.map(({ task }) => historyTaskSnapshot(task)),
      bossDefeated,
      participantIds,
      championId: results[0]?.userId ?? null,
      results,
      boss: bossSnapshot.exists() ? {
        name: bossSnapshot.data().name ?? 'Неизвестный босс',
        archetype: bossSnapshot.data().archetype ?? 'unknown', season: bossSnapshot.data().season ?? 'unknown',
        description: bossSnapshot.data().description ?? '', quote: bossSnapshot.data().quote ?? '',
        visualTraits: bossSnapshot.data().visualTraits ?? [], icon: bossSnapshot.data().icon ?? '👹',
        maxHp: Number(bossSnapshot.data().maxHp ?? 1),
        finalHitUserId: bossSnapshot.data().finalHitUserId ?? null,
        finalHitTaskId: bossSnapshot.data().finalHitTaskId ?? null,
      } : null,
      createdAt: serverTimestamp(),
    });
    transaction.set(sprintRef, {
      id: nextId, number: nextNumber, status: 'active', startedAt: Timestamp.fromDate(now),
      endsAt: Timestamp.fromDate(nextEndsAt), bossId: 'current', createdAt: serverTimestamp(),
    });
    transaction.set(bossRef, {
      id: 'current', ...nextBoss, hp: nextBossHp, maxHp: nextBossHp, potentialDamage: nextPotentialDamage,
      sprintNumber: nextNumber, sprintId: nextId, sprintEndsAt: Timestamp.fromDate(nextEndsAt),
      economyVersion: 2, finalHitUserId: deleteField(), finalHitTaskId: deleteField(), updatedAt: serverTimestamp(),
    }, { merge: true });
    transaction.set(boardRef, { activeSprintId: nextId, updatedAt: serverTimestamp() }, { merge: true });
  });
}

async function reconcileRecurringTasks(context: TasksRepositoryContext) {
  const firestore = db();
  const [templatesSnapshot, tasksSnapshot, sprintSnapshot] = await Promise.all([
    getDocs(collection(firestore, recurrencePath(context.familyId))),
    getDocs(collection(firestore, tasksPath(context.familyId))),
    getDoc(doc(firestore, sprintPath(context.familyId))),
  ]);
  const now = new Date();
  const activeSprintId = typeof sprintSnapshot.data()?.id === 'string' ? sprintSnapshot.data()!.id : 'sprint-1';
  const tasks = tasksSnapshot.docs.map((snapshot) => mapTaskData(snapshot.id, snapshot.data()));
  const batch = writeBatch(firestore);
  let writes = 0;
  templatesSnapshot.docs.forEach((templateSnapshot) => {
    const data = templateSnapshot.data();
    if (data.active === false || !(data.nextDueAt instanceof Timestamp)) return;
    let nextDueAt = data.nextDueAt.toDate();
    if (nextDueAt.getTime() > now.getTime()) return;
    const hasOpenDebt = tasks.some((task) => task.recurrenceTemplateId === templateSnapshot.id && task.status !== 'done');
    const instanceKey = dateKey(nextDueAt);
    if (!hasOpenDebt) {
      const instanceRef = doc(firestore, taskPath(context.familyId, `${templateSnapshot.id}_${instanceKey}`));
      batch.set(instanceRef, {
        title: String(data.title ?? ''), description: data.description ?? null, status: 'planned',
        authorId: String(data.authorId ?? ''), assigneeIds: asStringArray(data.assigneeIds),
        reviewerId: String(data.reviewerId ?? ''), difficulty: validDifficulties.includes(data.difficulty) ? data.difficulty : 'normal',
        difficultyStatus: 'pending', difficultyProposedById: String(data.authorId ?? ''),
        estimatedDuration: data.estimatedDuration ?? null, dueDate: Timestamp.fromDate(nextDueAt),
        blockerIds: asStringArray(data.blockerIds), bonusCoins: Number(data.bonusCoins ?? 0),
        bonusCoinsAuthorId: Number(data.bonusCoins ?? 0) > 0 ? String(data.authorId ?? '') : null,
        rolloverCount: 0, recurrence: data.frequency, recurrenceTemplateId: templateSnapshot.id,
        recurrenceDateKey: instanceKey, sprintId: activeSprintId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      writes += 1;
    }
    const frequency: RecurrenceFrequency = data.frequency === 'monthly' ? 'monthly' : 'weekly';
    do nextDueAt = nextRecurrenceDate(nextDueAt, frequency); while (nextDueAt.getTime() <= now.getTime());
    batch.update(templateSnapshot.ref, { nextDueAt: Timestamp.fromDate(nextDueAt), updatedAt: serverTimestamp() });
    writes += 1;
  });
  if (writes > 0) await batch.commit();
}

async function reconcileDailyFreeze(context: TasksRepositoryContext) {
  const firestore = db();
  const profileRef = doc(firestore, profilePath(context.familyId, context.currentUserId));
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    if (!snapshot.exists()) return;
    const profile = mapProfile(context.currentUserId, snapshot.data());
    const lastDate = profile.streaks.daily.lastDate;
    if (!lastDate || profile.streaks.daily.count === 0) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const previous = new Date(`${lastDate}T00:00:00`);
    const gap = Math.round((today.getTime() - previous.getTime()) / 86_400_000);
    if (gap <= 1) return;
    const missedDays = gap - 1;
    const streaks = profile.streaks;
    if (profile.streakFreezes >= missedDays) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      streaks.daily = { ...streaks.daily, lastDate: dateKey(yesterday) };
      transaction.update(profileRef, {
        streaks, streakFreezes: profile.streakFreezes - missedDays, updatedAt: serverTimestamp(),
      });
    } else {
      streaks.daily = { count: 0 };
      transaction.update(profileRef, { streaks, streakFreezes: 0, updatedAt: serverTimestamp() });
    }
  });
}

async function reconcileAchievements(context: TasksRepositoryContext) {
  const firestore = db();
  const [tasksSnapshot, profileSnapshot, history] = await Promise.all([
    getDocs(collection(firestore, tasksPath(context.familyId))),
    getDoc(doc(firestore, profilePath(context.familyId, context.currentUserId))),
    fetchSprintHistory(context.familyId),
  ]);
  if (!profileSnapshot.exists()) return;
  const profile = mapProfile(context.currentUserId, profileSnapshot.data());
  const tasks = tasksSnapshot.docs.map((item) => mapTaskData(item.id, item.data()));
  const unlocked = achievementProgress({ tasks, profile, history, userId: context.currentUserId })
    .filter((item) => item.unlocked && !profile.achievementIds.includes(item.definition.id));
  if (unlocked.length === 0) return;
  const profileRef = doc(firestore, profilePath(context.familyId, context.currentUserId));
  await runTransaction(firestore, async (transaction) => {
    const fresh = await transaction.get(profileRef);
    if (!fresh.exists()) return;
    const freshProfile = mapProfile(context.currentUserId, fresh.data());
    const newlyUnlocked = unlocked.filter((item) => !freshProfile.achievementIds.includes(item.definition.id));
    if (newlyUnlocked.length === 0) return;
    const rewardCoins = newlyUnlocked.reduce((sum, item) => sum + item.definition.rewardCoins, 0);
    const rewardXp = newlyUnlocked.reduce((sum, item) => sum + item.definition.rewardXp, 0);
    const rewardChests = newlyUnlocked.reduce((sum, item) => sum + (item.definition.rewardChests ?? 0), 0);
    const totalXp = freshProfile.totalXp + rewardXp;
    transaction.update(profileRef, {
      achievementIds: [...freshProfile.achievementIds, ...newlyUnlocked.map((item) => item.definition.id)],
      coins: freshProfile.coins + rewardCoins,
      mysteryChests: freshProfile.mysteryChests + rewardChests,
      xp: totalXp,
      level: profileFromTotalXp(totalXp).level,
      updatedAt: serverTimestamp(),
    });
    newlyUnlocked.forEach(({ definition }) => {
      transaction.set(doc(firestore, activityPath(context.familyId, `achievement_${context.currentUserId}_${definition.id}`)), {
        type: 'achievement', title: definition.name, userIds: [context.currentUserId], createdAt: serverTimestamp(),
      });
      if (definition.rewardCoins > 0) transaction.set(doc(firestore, ledgerPath(context.familyId, context.currentUserId, `achievement_${definition.id}`)), {
        userId: context.currentUserId, type: 'achievement_reward', amount: definition.rewardCoins,
        referenceId: definition.id, createdAt: serverTimestamp(),
      });
      if (definition.rewardTitle) transaction.set(
        doc(firestore, `${inventoryPath(context.familyId, context.currentUserId)}/achievement_title_${definition.id}`),
        { kind: 'title', name: definition.rewardTitle, icon: '🏷️', quantity: 1, value: definition.rewardTitle, permanent: true, sourceId: definition.id, createdAt: serverTimestamp() },
        { merge: true },
      );
      if (definition.rewardFrame) transaction.set(
        doc(firestore, `${inventoryPath(context.familyId, context.currentUserId)}/achievement_frame_${definition.id}`),
        { kind: 'frame', name: definition.name, icon: '🖼️', quantity: 1, value: definition.rewardFrame, permanent: true, sourceId: definition.id, createdAt: serverTimestamp() },
        { merge: true },
      );
    });
  });
}

async function reconcileLevelMilestones(context: TasksRepositoryContext) {
  const firestore = db();
  const profileRef = doc(firestore, profilePath(context.familyId, context.currentUserId));
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    if (!snapshot.exists()) return;
    const profile = mapProfile(context.currentUserId, snapshot.data());
    const milestones = GAME_CONFIG.levelMilestones.filter(
      (milestone) => milestone.level <= profile.level && !profile.claimedMilestones.includes(milestone.level),
    );
    if (milestones.length === 0) return;
    const coins = milestones.reduce((sum, milestone) => sum + (milestone.coins ?? 0), 0);
    const chests = milestones.reduce((sum, milestone) => sum + (milestone.chests ?? 0), 0);
    transaction.update(profileRef, {
      claimedMilestones: [...profile.claimedMilestones, ...milestones.map((milestone) => milestone.level)].sort((left, right) => left - right),
      coins: profile.coins + coins,
      mysteryChests: profile.mysteryChests + chests,
      updatedAt: serverTimestamp(),
    });
    milestones.forEach((milestone) => {
      transaction.set(doc(firestore, activityPath(context.familyId, `levelMilestone_${context.currentUserId}_${milestone.level}`)), {
        type: 'level_milestone', title: `Уровень ${milestone.level}`, userIds: [context.currentUserId], createdAt: serverTimestamp(),
      });
      if (milestone.coins) transaction.set(doc(firestore, ledgerPath(context.familyId, context.currentUserId, `levelMilestone_${milestone.level}`)), {
        userId: context.currentUserId, type: 'level_milestone', amount: milestone.coins,
        referenceId: String(milestone.level), createdAt: serverTimestamp(),
      });
      if (milestone.title) transaction.set(
        doc(firestore, `${inventoryPath(context.familyId, context.currentUserId)}/milestone_title_${milestone.level}`),
        { kind: 'title', name: milestone.title, icon: '🏷️', quantity: 1, value: milestone.title, permanent: true, sourceId: `level-${milestone.level}`, createdAt: serverTimestamp() },
        { merge: true },
      );
      if (milestone.frame) transaction.set(
        doc(firestore, `${inventoryPath(context.familyId, context.currentUserId)}/milestone_frame_${milestone.level}`),
        { kind: 'frame', name: `Рамка уровня ${milestone.level}`, icon: '🖼️', quantity: 1, value: milestone.frame, permanent: true, sourceId: `level-${milestone.level}`, createdAt: serverTimestamp() },
        { merge: true },
      );
    });
  });
}

export async function reconcileBoard(context: TasksRepositoryContext) {
  const step = async (label: string, operation: () => Promise<unknown>) => {
    try {
      await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${label}: ${message}`, { cause: error });
    }
  };
  await step('Подготовка доски', () => ensureBoardBootstrap(context));
  await step('Миграция старых задач', () => migrateLegacyTasks(context.familyId));
  await step('Обновление босса', () => reconcileBossModel(context));
  await step('Завершение спринта', () => reconcileExpiredSprint(context));
  await step('Повторяющиеся задачи', () => reconcileRecurringTasks(context));
  await step('Streak freeze', () => reconcileDailyFreeze(context));
  await step('Достижения', () => reconcileAchievements(context));
  await step('Награды за уровни', () => reconcileLevelMilestones(context));
}

export async function fetchTasks(familyId: string): Promise<FamilyTask[]> {
  const firestore = db();
  const [snapshot, sprintSnapshot] = await Promise.all([
    getDocs(query(collection(firestore, tasksPath(familyId)), orderBy('createdAt', 'desc'))),
    getDoc(doc(firestore, sprintPath(familyId))),
  ]);
  const activeSprintId = typeof sprintSnapshot.data()?.id === 'string' ? sprintSnapshot.data()!.id : 'sprint-1';
  const sprintNumber = typeof sprintSnapshot.data()?.number === 'number' ? sprintSnapshot.data()!.number : 1;
  const nextSprintId = `sprint-${sprintNumber + 1}`;
  return snapshot.docs
    .map((taskSnapshot) => mapTaskData(taskSnapshot.id, taskSnapshot.data()))
    .filter((task) => task.status === 'backlog' || !task.sprintId || task.sprintId === 'current' || task.sprintId === activeSprintId || task.sprintId === nextSprintId);
}

export async function fetchPlayerProfile(familyId: string, userId: string): Promise<BoardPlayerProfile> {
  const snapshot = await getDoc(doc(db(), profilePath(familyId, userId)));
  return mapProfile(userId, snapshot.data());
}

export async function fetchBoss(familyId: string): Promise<SprintBoss> {
  const snapshot = await getDoc(doc(db(), bossPath(familyId)));
  return mapBoss(snapshot.data());
}

export async function fetchSprintHistory(familyId: string): Promise<SprintHistoryItem[]> {
  const snapshot = await getDocs(query(collection(db(), sprintHistoryPath(familyId)), orderBy('number', 'desc')));
  return snapshot.docs.map((item) => ({
    id: item.id,
    number: Number(item.data().number ?? 0),
    startedAt: asIso(item.data().startedAt),
    endedAt: asIso(item.data().endedAt),
    completedTasks: Number(item.data().completedTasks ?? 0),
    totalTasks: Number(item.data().totalTasks ?? 0),
    rolledOverTasks: Number(item.data().rolledOverTasks ?? 0),
    onTimeRate: Number(item.data().onTimeRate ?? 0),
    bossDefeated: item.data().bossDefeated === true,
    participantIds: asStringArray(item.data().participantIds),
    championId: typeof item.data().championId === 'string' ? item.data().championId : undefined,
    results: Array.isArray(item.data().results) ? item.data().results.map((result: DocumentData) => ({
      userId: String(result.userId ?? ''), xp: Number(result.xp ?? 0),
      completedTasks: Number(result.completedTasks ?? 0), bossDamage: Number(result.bossDamage ?? 0),
    })) : [],
    boss: item.data().boss && typeof item.data().boss === 'object' ? {
      name: String(item.data().boss.name ?? 'Неизвестный босс'),
      archetype: String(item.data().boss.archetype ?? 'unknown'), season: String(item.data().boss.season ?? 'unknown'),
      description: String(item.data().boss.description ?? ''), quote: String(item.data().boss.quote ?? ''),
      visualTraits: asStringArray(item.data().boss.visualTraits), icon: String(item.data().boss.icon ?? '👹'),
      maxHp: Number(item.data().boss.maxHp ?? 1),
      finalHitUserId: typeof item.data().boss.finalHitUserId === 'string' ? item.data().boss.finalHitUserId : undefined,
      finalHitTaskId: typeof item.data().boss.finalHitTaskId === 'string' ? item.data().boss.finalHitTaskId : undefined,
    } : undefined,
    tasks: Array.isArray(item.data().tasks)
      ? item.data().tasks.map((task: DocumentData) => mapTaskData(String(task.id ?? ''), task))
      : [],
  }));
}

export async function fetchAllPlayerProfiles(familyId: string): Promise<BoardPlayerProfile[]> {
  const snapshot = await getDocs(collection(db(), profilesPath(familyId)));
  return snapshot.docs.map((item) => mapProfile(item.id, item.data()));
}

export async function fetchActivity(familyId: string): Promise<ActivityEvent[]> {
  const snapshot = await getDocs(query(collection(db(), `${appRootPath(familyId)}/activity`), orderBy('createdAt', 'desc')));
  const cutoff = Date.now() - 3 * 86_400_000;
  return snapshot.docs.map((item) => ({
    id: item.id,
    type: String(item.data().type ?? 'event'),
    title: String(item.data().title ?? ''),
    userIds: asStringArray(item.data().userIds),
    bossDamage: typeof item.data().bossDamage === 'number' ? item.data().bossDamage : undefined,
    createdAt: asIso(item.data().createdAt),
  })).filter((item) => !item.createdAt || new Date(item.createdAt).getTime() >= cutoff).slice(0, 30);
}

export async function fetchCoinTransactions(familyId: string, userId: string): Promise<CoinTransaction[]> {
  const snapshot = await getDocs(query(
    collection(db(), `${profilePath(familyId, userId)}/coinTransactions`),
    orderBy('createdAt', 'desc'),
    limit(50),
  ));
  return snapshot.docs.map((item) => ({
    id: item.id,
    userId: String(item.data().userId ?? userId),
    type: String(item.data().type ?? 'transaction'),
    amount: Number(item.data().amount ?? 0),
    referenceId: typeof item.data().referenceId === 'string' ? item.data().referenceId : undefined,
    createdAt: asIso(item.data().createdAt),
  }));
}

export async function fetchFamilyRewards(familyId: string): Promise<FamilyReward[]> {
  const snapshot = await getDocs(collection(db(), familyRewardsPath(familyId)));
  return snapshot.docs.map((item) => ({
    id: item.id,
    creatorId: String(item.data().creatorId ?? ''),
    title: String(item.data().title ?? ''),
    description: typeof item.data().description === 'string' ? item.data().description : undefined,
    price: Number(item.data().price ?? 0),
    quantity: typeof item.data().quantity === 'number' ? item.data().quantity : undefined,
    cooldownHours: typeof item.data().cooldownHours === 'number' ? item.data().cooldownHours : undefined,
    isActive: item.data().isActive !== false,
  })).filter((item) => item.isActive);
}

export async function fetchRewardRequests(familyId: string, userId: string): Promise<RewardRequest[]> {
  const snapshot = await getDocs(collection(db(), rewardRequestsPath(familyId)));
  return snapshot.docs.map((item) => ({
    id: item.id,
    inventoryId: String(item.data().inventoryId ?? ''),
    rewardId: typeof item.data().rewardId === 'string' ? item.data().rewardId : undefined,
    requesterId: String(item.data().requesterId ?? ''),
    creatorId: String(item.data().creatorId ?? ''),
    title: String(item.data().title ?? 'Семейная награда'),
    status: item.data().status === 'approved' || item.data().status === 'rejected' ? item.data().status : 'pending',
    createdAt: asIso(item.data().createdAt),
  })).filter((item) => item.creatorId === userId && item.status === 'pending');
}

export async function fetchInventory(familyId: string, userId: string): Promise<InventoryItem[]> {
  const snapshot = await getDocs(collection(db(), inventoryPath(familyId, userId)));
  return snapshot.docs.map((item) => ({
    id: item.id, kind: String(item.data().kind ?? ''), name: String(item.data().name ?? ''),
    icon: String(item.data().icon ?? '🎁'), quantity: Number(item.data().quantity ?? 1),
    value: typeof item.data().value === 'string' ? item.data().value : undefined,
    sourceId: typeof item.data().sourceId === 'string' ? item.data().sourceId : undefined,
    permanent: item.data().permanent === true,
    expiresAt: asIso(item.data().expiresAt),
  }));
}

export async function fetchDailyState(familyId: string, userId: string, tasks: FamilyTask[]): Promise<DailyState> {
  const day = dateKey();
  const snapshot = await getDoc(doc(db(), dailyPath(familyId, day, userId)));
  return buildDailyState(tasks, userId, snapshot.data());
}

export async function createTask(context: TasksRepositoryContext, input: NewTaskInput): Promise<string> {
  const firestore = db();
  const taskRef = doc(collection(firestore, tasksPath(context.familyId)));
  const sprintRef = doc(firestore, sprintPath(context.familyId));
  const recurrenceRef = input.recurrence ? doc(collection(firestore, recurrencePath(context.familyId))) : null;
  await runTransaction(firestore, async (transaction) => {
    const sprintSnapshot = await transaction.get(sprintRef);
    const sprintId = typeof sprintSnapshot.data()?.id === 'string' ? sprintSnapshot.data()!.id : 'sprint-1';
    const sprintNumber = typeof sprintSnapshot.data()?.number === 'number' ? sprintSnapshot.data()!.number : 1;
    transaction.set(taskRef, taskDocument(input, context, sprintId, recurrenceRef?.id, `sprint-${sprintNumber + 1}`));
    if (recurrenceRef && input.recurrence) {
      const firstDue = input.dueDate ? new Date(input.dueDate) : new Date();
      transaction.set(recurrenceRef, {
        title: input.title.trim(), description: input.description?.trim() || null, authorId: context.currentUserId,
        assigneeIds: [...new Set(input.assigneeIds)], reviewerId: input.reviewerId, difficulty: input.difficulty,
        estimatedDuration: input.estimatedDuration ?? null, blockerIds: [...new Set(input.blockerIds)],
        bonusCoins: Math.max(0, input.bonusCoins), frequency: input.recurrence,
        nextDueAt: Timestamp.fromDate(nextRecurrenceDate(firstDue, input.recurrence)), active: true,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
  });
  return taskRef.id;
}

export async function updateTask(context: TasksRepositoryContext, taskId: string, input: UpdateTaskInput): Promise<void> {
  const firestore = db();
  const taskRef = doc(firestore, taskPath(context.familyId, taskId));
  const newTemplateRef = input.recurrence ? doc(collection(firestore, recurrencePath(context.familyId))) : null;
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(taskRef);
    if (!snapshot.exists()) throw new Error('Задача уже удалена.');
    const task = mapTaskData(snapshot.id, snapshot.data());
    if (task.authorId !== context.currentUserId) throw new Error('Редактировать задачу может только автор.');
    if (
      (task.bonusReservedAt || task.bossPlannedAt) &&
      (task.bonusCoins !== input.bonusCoins || task.difficulty !== input.difficulty)
    ) {
      throw new Error('После согласования нельзя менять сложность или бонус.');
    }
    if (input.blockerIds.includes(taskId)) throw new Error('Задача не может блокировать сама себя.');
    const assignmentChanged = [...task.assigneeIds].sort().join('|') !== [...input.assigneeIds].sort().join('|');
    const difficultyChanged = task.difficulty !== input.difficulty;
    const requiresTransferConsent = assignmentChanged && task.difficultyStatus === 'agreed';
    transaction.update(taskRef, {
      title: input.title.trim(), description: input.description?.trim() || null,
      assigneeIds: requiresTransferConsent ? task.assigneeIds : [...new Set(input.assigneeIds)], reviewerId: input.reviewerId,
      difficulty: input.difficulty,
      difficultyStatus: !requiresTransferConsent && (assignmentChanged || difficultyChanged) ? 'pending' : task.difficultyStatus,
      difficultyProposedById: !requiresTransferConsent && (assignmentChanged || difficultyChanged) ? context.currentUserId : task.difficultyProposedById ?? null,
      pendingAssigneeIds: requiresTransferConsent ? [...new Set(input.assigneeIds)] : deleteField(),
      transferRequestedById: requiresTransferConsent ? context.currentUserId : deleteField(),
      transferRequestedAt: requiresTransferConsent ? serverTimestamp() : deleteField(),
      estimatedDuration: input.estimatedDuration ?? null, dueDate: timestampOrNull(input.dueDate),
      blockerIds: [...new Set(input.blockerIds)], bonusCoins: Math.max(0, input.bonusCoins),
      recurrence: input.recurrence ?? null,
      ...(!task.recurrenceTemplateId && input.recurrence ? { recurrenceTemplateId: newTemplateRef!.id } : {}),
      updatedAt: serverTimestamp(),
    });
    if (task.recurrenceTemplateId) {
      const templateRef = doc(firestore, `${recurrencePath(context.familyId)}/${task.recurrenceTemplateId}`);
      transaction.set(templateRef, {
        title: input.title.trim(), description: input.description?.trim() || null,
        assigneeIds: [...new Set(input.assigneeIds)], reviewerId: input.reviewerId,
        difficulty: input.difficulty, estimatedDuration: input.estimatedDuration ?? null,
        blockerIds: [...new Set(input.blockerIds)], bonusCoins: Math.max(0, input.bonusCoins),
        frequency: input.recurrence ?? task.recurrence ?? 'weekly', active: Boolean(input.recurrence), updatedAt: serverTimestamp(),
      }, { merge: true });
    } else if (newTemplateRef && input.recurrence) {
      const firstDue = input.dueDate ? new Date(input.dueDate) : new Date();
      transaction.set(newTemplateRef, {
        title: input.title.trim(), description: input.description?.trim() || null, authorId: task.authorId,
        assigneeIds: [...new Set(input.assigneeIds)], reviewerId: input.reviewerId,
        difficulty: input.difficulty, estimatedDuration: input.estimatedDuration ?? null,
        blockerIds: [...new Set(input.blockerIds)], bonusCoins: Math.max(0, input.bonusCoins),
        frequency: input.recurrence, nextDueAt: Timestamp.fromDate(nextRecurrenceDate(firstDue, input.recurrence)),
        active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
  });
}

export async function deleteTask(context: TasksRepositoryContext, taskId: string): Promise<void> {
  const firestore = db();
  const taskRef = doc(firestore, taskPath(context.familyId, taskId));
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(taskRef);
    if (!snapshot.exists()) return;
    const task = mapTaskData(snapshot.id, snapshot.data());
    if (task.authorId !== context.currentUserId) throw new Error('Удалить задачу может только автор.');
    if (task.status === 'done') throw new Error('Завершённую задачу нельзя удалить.');
    const authorRef = doc(firestore, profilePath(context.familyId, task.authorId));
    const authorSnapshot = task.bonusReservedAt ? await transaction.get(authorRef) : null;
    if (task.bonusReservedAt && authorSnapshot) {
      const data = authorSnapshot.data();
      const coins = Number(data?.coins ?? 0);
      const reserved = Number(data?.reservedCoins ?? 0);
      transaction.set(authorRef, {
        coins: coins + task.bonusCoins, reservedCoins: Math.max(0, reserved - task.bonusCoins), updatedAt: serverTimestamp(),
      }, { merge: true });
      transaction.set(doc(firestore, ledgerPath(context.familyId, task.authorId, `bonusRelease_${taskId}`)), {
        userId: task.authorId, type: 'bonus_release', amount: task.bonusCoins, referenceId: taskId, createdAt: serverTimestamp(),
      });
    }
    if (task.recurrenceTemplateId) transaction.set(
      doc(firestore, `${recurrencePath(context.familyId)}/${task.recurrenceTemplateId}`),
      { active: false, updatedAt: serverTimestamp() },
      { merge: true },
    );
    transaction.delete(taskRef);
  });
}

async function reserveBonusIfNeeded(
  transaction: Parameters<Parameters<typeof runTransaction>[1]>[0],
  firestore: Firestore,
  context: TasksRepositoryContext,
  task: FamilyTask,
) {
  if (task.bonusCoins <= 0 || task.bonusReservedAt) return;
  const authorRef = doc(firestore, profilePath(context.familyId, task.authorId));
  const authorSnapshot = await transaction.get(authorRef);
  const data = authorSnapshot.data();
  const coins = Number(data?.coins ?? 0);
  const reserved = Number(data?.reservedCoins ?? 0);
  if (coins < task.bonusCoins) throw new Error(`У автора недостаточно Coins для бонуса ${task.bonusCoins}.`);
  transaction.set(authorRef, {
    coins: coins - task.bonusCoins, reservedCoins: reserved + task.bonusCoins, updatedAt: serverTimestamp(),
  }, { merge: true });
  transaction.set(doc(firestore, ledgerPath(context.familyId, task.authorId, `bonusReserve_${task.id}`)), {
    userId: task.authorId, type: 'bonus_reserve', amount: -task.bonusCoins, referenceId: task.id, createdAt: serverTimestamp(),
  });
}

export async function agreeTaskDifficulty(context: TasksRepositoryContext, taskId: string): Promise<void> {
  const firestore = db();
  const taskRef = doc(firestore, taskPath(context.familyId, taskId));
  const bossRef = doc(firestore, bossPath(context.familyId));
  const sprintRef = doc(firestore, sprintPath(context.familyId));
  await runTransaction(firestore, async (transaction) => {
    const [snapshot, bossSnapshot, sprintSnapshot] = await Promise.all([
      transaction.get(taskRef), transaction.get(bossRef), transaction.get(sprintRef),
    ]);
    if (!snapshot.exists()) throw new Error('Задача уже удалена.');
    const task = mapTaskData(snapshot.id, snapshot.data());
    const isAssignee = task.assigneeIds.includes(context.currentUserId);
    const isAuthor = task.authorId === context.currentUserId;
    if (!isAssignee && !isAuthor) throw new Error('Согласовать сложность может исполнитель или автор.');
    if (task.difficultyProposedById === context.currentUserId && !(isAuthor && isAssignee)) {
      throw new Error('Предложение должен подтвердить другой участник.');
    }
    await reserveBonusIfNeeded(transaction, firestore, context, task);
    const update: DocumentData = { difficultyStatus: 'agreed', updatedAt: serverTimestamp() };
    if (task.bonusCoins > 0 && !task.bonusReservedAt) update.bonusReservedAt = serverTimestamp();
    if (task.status === 'planned' && !task.bossPlannedAt && bossSnapshot.exists()) {
      const damage = GAME_CONFIG.difficulty[task.difficulty].bossDamage;
      const growth = bossGrowthForTask(damage, sprintDay(sprintSnapshot.data()));
      const boss = bossSnapshot.data();
      const previousPotential = Number(boss.potentialDamage ?? 0);
      const nextPotential = previousPotential + damage;
      const nextMaxHp = bossMaxHpForPotentialDamage(nextPotential);
      const previousHp = previousPotential === 0 ? 0 : Number(boss.hp ?? 0);
      transaction.update(bossRef, {
        potentialDamage: nextPotential,
        maxHp: nextMaxHp,
        hp: Math.min(nextMaxHp, previousHp + growth.heal),
        updatedAt: serverTimestamp(),
      });
      update.bossPlannedAt = serverTimestamp();
    }
    transaction.update(taskRef, update);
  });
}

export async function proposeTaskDifficulty(
  context: TasksRepositoryContext,
  taskId: string,
  difficulty: TaskDifficulty,
): Promise<void> {
  const firestore = db();
  const taskRef = doc(firestore, taskPath(context.familyId, taskId));
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(taskRef);
    if (!snapshot.exists()) throw new Error('Задача уже удалена.');
    const task = mapTaskData(snapshot.id, snapshot.data());
    if (task.bonusReservedAt || task.bossPlannedAt) throw new Error('Сложность уже согласована и учтена в экономике.');
    if (task.authorId !== context.currentUserId && !task.assigneeIds.includes(context.currentUserId)) {
      throw new Error('Изменить предложение может автор или исполнитель.');
    }
    transaction.update(taskRef, {
      difficulty, difficultyStatus: 'pending', difficultyProposedById: context.currentUserId, updatedAt: serverTimestamp(),
    });
  });
}

export async function declineTaskDifficulty(context: TasksRepositoryContext, taskId: string): Promise<void> {
  const firestore = db();
  const taskRef = doc(firestore, taskPath(context.familyId, taskId));
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(taskRef);
    if (!snapshot.exists()) throw new Error('Задача уже удалена.');
    const task = mapTaskData(snapshot.id, snapshot.data());
    if (!task.assigneeIds.includes(context.currentUserId)) throw new Error('Отказаться может только назначенный исполнитель.');
    transaction.update(taskRef, {
      assigneeIds: task.assigneeIds.filter((id) => id !== context.currentUserId),
      difficultyStatus: 'declined', difficultyProposedById: context.currentUserId, status: 'backlog',
      sprintId: null, updatedAt: serverTimestamp(),
    });
  });
}

export async function claimTask(context: TasksRepositoryContext, taskId: string): Promise<void> {
  const firestore = db();
  const taskRef = doc(firestore, taskPath(context.familyId, taskId));
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(taskRef);
    if (!snapshot.exists()) throw new Error('Задача уже удалена.');
    if (asStringArray(snapshot.data().assigneeIds).length > 0) throw new Error('Эту задачу уже взял другой участник.');
    transaction.update(taskRef, {
      assigneeIds: [context.currentUserId], difficultyStatus: 'pending',
      difficultyProposedById: String(snapshot.data().authorId ?? ''), updatedAt: serverTimestamp(),
    });
  });
}

export async function acceptTaskTransfer(context: TasksRepositoryContext, taskId: string): Promise<void> {
  const firestore = db();
  const taskRef = doc(firestore, taskPath(context.familyId, taskId));
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(taskRef);
    if (!snapshot.exists()) throw new Error('Задача уже удалена.');
    const task = mapTaskData(snapshot.id, snapshot.data());
    const pendingAssignees = task.pendingAssigneeIds ?? [];
    if (!task.transferRequestedById) throw new Error('Запрос на передачу уже закрыт.');
    const newParticipants = pendingAssignees.filter((id) => !task.assigneeIds.includes(id));
    const canAccept = newParticipants.length > 0
      ? newParticipants.includes(context.currentUserId)
      : task.assigneeIds.includes(context.currentUserId);
    if (!canAccept) throw new Error('Подтвердить передачу должен новый или текущий исполнитель.');
    transaction.update(taskRef, {
      assigneeIds: pendingAssignees,
      pendingAssigneeIds: deleteField(),
      transferRequestedById: deleteField(),
      transferRequestedAt: deleteField(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(doc(firestore, activityPath(context.familyId, `taskTransfer_${taskId}_${Date.now()}`)), {
      type: 'task_transferred', taskId, title: task.title,
      userIds: [...new Set([...task.assigneeIds, ...pendingAssignees])], createdAt: serverTimestamp(),
    });
  });
}

export async function rejectTaskTransfer(context: TasksRepositoryContext, taskId: string): Promise<void> {
  const firestore = db();
  const taskRef = doc(firestore, taskPath(context.familyId, taskId));
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(taskRef);
    if (!snapshot.exists()) throw new Error('Задача уже удалена.');
    const task = mapTaskData(snapshot.id, snapshot.data());
    const involved = new Set([task.authorId, ...task.assigneeIds, ...(task.pendingAssigneeIds ?? [])]);
    if (!task.transferRequestedById || !involved.has(context.currentUserId)) throw new Error('Запрос на передачу недоступен.');
    transaction.update(taskRef, {
      pendingAssigneeIds: deleteField(), transferRequestedById: deleteField(),
      transferRequestedAt: deleteField(), updatedAt: serverTimestamp(),
    });
  });
}

export async function leaveTask(context: TasksRepositoryContext, taskId: string): Promise<void> {
  const firestore = db();
  const taskRef = doc(firestore, taskPath(context.familyId, taskId));
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(taskRef);
    if (!snapshot.exists()) throw new Error('Задача уже удалена.');
    const task = mapTaskData(snapshot.id, snapshot.data());
    if (!task.assigneeIds.includes(context.currentUserId)) throw new Error('Вы не назначены на эту задачу.');
    if (task.status === 'review' || task.status === 'done') throw new Error('Нельзя отказаться во время или после Review.');
    const assigneeIds = task.assigneeIds.filter((id) => id !== context.currentUserId);
    transaction.update(taskRef, {
      assigneeIds,
      ...(assigneeIds.length === 0 ? {
        status: task.status === 'in_progress' ? 'planned' : task.status,
        difficultyStatus: 'pending', difficultyProposedById: task.authorId,
      } : {}),
      updatedAt: serverTimestamp(),
    });
    transaction.set(doc(firestore, activityPath(context.familyId, `taskDeclined_${taskId}_${context.currentUserId}_${Date.now()}`)), {
      type: 'task_declined', taskId, title: task.title, userIds: [context.currentUserId], createdAt: serverTimestamp(),
    });
  });
}

export async function transitionTask(
  context: TasksRepositoryContext,
  taskId: string,
  target: TaskStatus,
): Promise<{ reward: ReturnType<typeof taskReward> | null }> {
  const firestore = db();
  const taskRef = doc(firestore, taskPath(context.familyId, taskId));
  return runTransaction(firestore, async (transaction) => {
    const taskSnapshot = await transaction.get(taskRef);
    if (!taskSnapshot.exists()) throw new Error('Задача уже удалена.');
    const task = mapTaskData(taskSnapshot.id, taskSnapshot.data());
    const blockerRefs = task.blockerIds.map((id) => doc(firestore, taskPath(context.familyId, id)));
    const blockerSnapshots = await Promise.all(blockerRefs.map((reference) => transaction.get(reference)));
    const blockers = blockerSnapshots.map((snapshot) => snapshot.exists()
      ? mapTaskData(snapshot.id, snapshot.data())
      : { ...task, id: snapshot.id, status: 'backlog' as const });
    const error = validateTransition(task, target, [task, ...blockers]);
    if (error) throw new Error(error);
    if (task.status === 'review' && target === 'done' && task.reviewerId !== context.currentUserId) {
      throw new Error('Подтвердить задачу может только назначенный reviewer.');
    }
    if (task.status === 'planned' && target === 'in_progress' && !task.assigneeIds.includes(context.currentUserId)) {
      throw new Error('Начать задачу может только исполнитель.');
    }
    if (task.status === 'in_progress' && target === 'review' && !task.assigneeIds.includes(context.currentUserId)) {
      throw new Error('Отправить на проверку может только исполнитель.');
    }

    const isCompletion = task.status === 'review' && target === 'done';
    const settlementRef = doc(firestore, settlementPath(context.familyId, taskId));
    const bossRef = doc(firestore, bossPath(context.familyId));
    const sprintRef = doc(firestore, sprintPath(context.familyId));
    const [settlementSnapshot, bossSnapshot, sprintSnapshot] = await Promise.all([
      isCompletion ? transaction.get(settlementRef) : Promise.resolve(null),
      isCompletion || (task.status === 'backlog' && target === 'planned') ? transaction.get(bossRef) : Promise.resolve(null),
      (task.status === 'backlog' && target === 'planned') || (task.status === 'planned' && target === 'in_progress')
        ? transaction.get(sprintRef)
        : Promise.resolve(null),
    ]);
    const shouldSettle = isCompletion && !settlementSnapshot?.exists();
    const profileIds = shouldSettle
      ? [...new Set([...task.assigneeIds, task.reviewerId, task.authorId])]
      : [];
    const profileRefs = profileIds.map((id) => doc(firestore, profilePath(context.familyId, id)));
    const profileSnapshots = await Promise.all(profileRefs.map((reference) => transaction.get(reference)));
    const profileData = new Map(profileIds.map((id, index) => [id, profileSnapshots[index].data()]));
    const reward = shouldSettle ? taskReward(task) : null;
    const reviewerIsTimely = !task.reviewStartedAt || Date.now() - new Date(task.reviewStartedAt).getTime() <= 86_400_000;
    const taskUpdate: DocumentData = { status: target, updatedAt: serverTimestamp() };
    if (task.status === 'planned' && target === 'in_progress') {
      const activeSprintId = typeof sprintSnapshot?.data()?.id === 'string' ? sprintSnapshot.data()!.id : 'sprint-1';
      if (task.sprintId && task.sprintId !== activeSprintId && task.sprintId !== 'current') {
        throw new Error('Эта задача запланирована на следующий спринт.');
      }
    }
    if (task.status === 'backlog' && target === 'planned') {
      taskUpdate.sprintId = typeof sprintSnapshot?.data()?.id === 'string' ? sprintSnapshot.data()!.id : 'sprint-1';
      if (task.difficultyStatus === 'agreed' && !task.bossPlannedAt && bossSnapshot?.exists()) {
        const damage = GAME_CONFIG.difficulty[task.difficulty].bossDamage;
        const growth = bossGrowthForTask(damage, sprintDay(sprintSnapshot?.data()));
        const boss = bossSnapshot.data();
        const previousPotential = Number(boss.potentialDamage ?? 0);
        const nextPotential = previousPotential + damage;
        const nextMaxHp = bossMaxHpForPotentialDamage(nextPotential);
        const previousHp = previousPotential === 0 ? 0 : Number(boss.hp ?? 0);
        transaction.update(bossRef, {
          potentialDamage: nextPotential,
          maxHp: nextMaxHp,
          hp: Math.min(nextMaxHp, previousHp + growth.heal),
          updatedAt: serverTimestamp(),
        });
        taskUpdate.bossPlannedAt = serverTimestamp();
      }
    }
    if (target === 'review') taskUpdate.reviewStartedAt = serverTimestamp();
    if (task.status === 'review' && target === 'in_progress') taskUpdate.reviewStartedAt = deleteField();

    if (reward) {
      const penalty = deadlinePenalty(task);
      task.assigneeIds.forEach((userId, index) => {
        const raw = profileData.get(userId);
        const totalXp = Number(raw?.xp ?? 0) + reward.xp;
        const baseCoins = GAME_CONFIG.difficulty[task.difficulty].coins;
        const bonus = index === 0 ? task.bonusCoins : 0;
        const currentCoins = Number(raw?.coins ?? 0);
        const streaks = asStreaks(raw);
        streaks.task = updateStreak(streaks.task, new Date());
        streaks.deadline = penalty === 0 ? updateStreak(streaks.deadline, new Date()) : { count: 0, lastDate: dateKey() };
        transaction.set(doc(firestore, profilePath(context.familyId, userId)), {
          xp: totalXp,
          level: profileFromTotalXp(totalXp).level,
          coins: Math.max(0, currentCoins + baseCoins + bonus - penalty),
          streaks,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        transaction.set(doc(firestore, ledgerPath(context.familyId, userId, `taskReward_${taskId}_v1`)), {
          userId, type: 'task_reward', amount: baseCoins, referenceId: taskId, createdAt: serverTimestamp(),
        });
        if (bonus > 0) transaction.set(doc(firestore, ledgerPath(context.familyId, userId, `taskBonus_${taskId}_v1`)), {
          userId, type: 'task_bonus', amount: bonus, referenceId: taskId, createdAt: serverTimestamp(),
        });
        if (penalty > 0) transaction.set(doc(firestore, ledgerPath(context.familyId, userId, `deadlinePenalty_${taskId}_v1`)), {
          userId, type: 'deadline_penalty', amount: -Math.min(currentCoins + baseCoins + bonus, penalty),
          referenceId: taskId, createdAt: serverTimestamp(),
        });
      });
      const reviewerRaw = profileData.get(task.reviewerId);
      const reviewerStreaks = asStreaks(reviewerRaw);
      const reviewerAssigneeIndex = task.assigneeIds.indexOf(task.reviewerId);
      const reviewerTaskCoins = reviewerAssigneeIndex >= 0
        ? GAME_CONFIG.difficulty[task.difficulty].coins
          + (reviewerAssigneeIndex === 0 ? task.bonusCoins : 0)
          - penalty
        : 0;
      if (reviewerAssigneeIndex >= 0) {
        reviewerStreaks.task = updateStreak(reviewerStreaks.task, new Date());
        reviewerStreaks.deadline = penalty === 0
          ? updateStreak(reviewerStreaks.deadline, new Date())
          : { count: 0, lastDate: dateKey() };
      }
      reviewerStreaks.review = reviewerIsTimely
        ? updateStreak(reviewerStreaks.review, new Date())
        : { count: 0, lastDate: dateKey() };
      const reviewerBonus = reviewerIsTimely ? GAME_CONFIG.reviewerReward : 0;
      transaction.set(doc(firestore, profilePath(context.familyId, task.reviewerId)), {
        coins: Math.max(0, Number(reviewerRaw?.coins ?? 0) + reviewerTaskCoins + reviewerBonus),
        streaks: reviewerStreaks,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      if (reviewerBonus > 0) transaction.set(doc(firestore, ledgerPath(context.familyId, task.reviewerId, `reviewReward_${taskId}_v1`)), {
        userId: task.reviewerId, type: 'reviewer_reward', amount: reviewerBonus, referenceId: taskId, createdAt: serverTimestamp(),
      });
      if (task.bonusReservedAt && task.bonusCoins > 0) {
        const authorRaw = profileData.get(task.authorId);
        transaction.set(doc(firestore, profilePath(context.familyId, task.authorId)), {
          reservedCoins: Math.max(0, Number(authorRaw?.reservedCoins ?? 0) - task.bonusCoins),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      if (bossSnapshot?.exists()) {
        const previousHp = Number(bossSnapshot.data().hp ?? 0);
        const nextHp = Math.max(0, previousHp - reward.bossDamage);
        transaction.update(bossRef, {
          hp: nextHp,
          ...(previousHp > 0 && nextHp === 0 ? {
            finalHitUserId: task.assigneeIds[0] ?? null,
            finalHitTaskId: taskId,
            defeatedAt: serverTimestamp(),
          } : {}),
          updatedAt: serverTimestamp(),
        });
        if (previousHp > 0 && nextHp === 0) transaction.set(
          doc(firestore, activityPath(context.familyId, `bossDefeated_${task.sprintId ?? 'current'}`)),
          { type: 'boss_defeated', taskId, title: task.title, userIds: task.assigneeIds, createdAt: serverTimestamp() },
        );
      }
      transaction.set(settlementRef, {
        taskId, sprintId: task.sprintId ?? null, assigneeIds: task.assigneeIds,
        reviewerId: task.reviewerId, xp: reward.xp, coins: reward.coins,
        deadlinePenalty: penalty, bossDamage: reward.bossDamage, createdAt: serverTimestamp(),
      });
      const completionEvent = {
        type: 'task_completed' as const,
        taskId,
        title: task.title,
        userIds: task.assigneeIds,
        reviewerId: task.reviewerId,
        bossDamage: reward.bossDamage,
      };
      transaction.set(doc(firestore, activityPath(context.familyId, gamificationEventId(completionEvent))), {
        ...activityFromGamificationEvent(completionEvent), createdAt: serverTimestamp(),
      });
      taskUpdate.rewardSettledAt = serverTimestamp();
      taskUpdate.bossDamageSettledAt = serverTimestamp();
      taskUpdate.completedAt = serverTimestamp();
    }
    transaction.update(taskRef, taskUpdate);
    return { reward };
  });
}

export async function claimDailyQuest(context: TasksRepositoryContext, questId: string): Promise<void> {
  const firestore = db();
  const tasks = await fetchTasks(context.familyId);
  const day = dateKey();
  const dailyRef = doc(firestore, dailyPath(context.familyId, day, context.currentUserId));
  const profileRef = doc(firestore, profilePath(context.familyId, context.currentUserId));
  await runTransaction(firestore, async (transaction) => {
    const [dailySnapshot, profileSnapshot] = await Promise.all([transaction.get(dailyRef), transaction.get(profileRef)]);
    const state = buildDailyState(tasks, context.currentUserId, dailySnapshot.data());
    const quest = state.quests.find((item) => item.id === questId);
    if (!quest) throw new Error('Квест больше не активен.');
    if (quest.claimed) return;
    if (quest.progress < quest.target) throw new Error('Квест ещё не выполнен.');
    const claimed = [...state.quests.filter((item) => item.claimed).map((item) => item.id), questId];
    const completesAll = state.quests.every((item) => item.claimed || item.id === questId);
    const chestReward = completesAll && !state.chestClaimed;
    const profile = profileSnapshot.data();
    const streaks = asStreaks(profile);
    if (chestReward) streaks.daily = updateStreak(streaks.daily, new Date());
    transaction.set(profileRef, {
      coins: Number(profile?.coins ?? 0) + quest.rewardCoins,
      streaks,
      mysteryChests: Number(profile?.mysteryChests ?? 0) + (chestReward ? 1 : 0),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    transaction.set(dailyRef, {
      dateKey: day,
      questIds: state.quests.map((item) => item.id),
      claimedQuestIds: claimed,
      rerollCount: state.rerollCount,
      chestClaimed: state.chestClaimed || completesAll,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    transaction.set(doc(firestore, ledgerPath(context.familyId, context.currentUserId, `daily_${day}_${questId}`)), {
      userId: context.currentUserId, type: 'daily_reward', amount: quest.rewardCoins,
      referenceId: `${day}_${questId}`, createdAt: serverTimestamp(),
    });
    if (chestReward) {
      const chestEvent = { type: 'daily_chest' as const, dateKey: day, userId: context.currentUserId };
      transaction.set(doc(firestore, activityPath(context.familyId, gamificationEventId(chestEvent))), {
        ...activityFromGamificationEvent(chestEvent), createdAt: serverTimestamp(),
      });
    }
  });
}

export async function rerollDaily(context: TasksRepositoryContext): Promise<void> {
  const firestore = db();
  const day = dateKey();
  const dailyRef = doc(firestore, dailyPath(context.familyId, day, context.currentUserId));
  const profileRef = doc(firestore, profilePath(context.familyId, context.currentUserId));
  await runTransaction(firestore, async (transaction) => {
    const [dailySnapshot, profileSnapshot] = await Promise.all([transaction.get(dailyRef), transaction.get(profileRef)]);
    const raw = dailySnapshot.data();
    const rerollCount = typeof raw?.rerollCount === 'number' ? raw.rerollCount : 0;
    if (asStringArray(raw?.claimedQuestIds).length > 0) throw new Error('Нельзя менять набор после получения награды.');
    const tokens = Number(profileSnapshot.data()?.dailyRerollTokens ?? 0);
    const cataloguePrice = dailyRerollPrice(rerollCount);
    const useToken = cataloguePrice > 0 && tokens > 0;
    const price = useToken ? 0 : cataloguePrice;
    const coins = Number(profileSnapshot.data()?.coins ?? 0);
    if (price > coins) throw new Error(`Для reroll нужно ${price} Coins.`);
    const nextCount = rerollCount + 1;
    transaction.set(dailyRef, {
      dateKey: day, questIds: dailyDefinitionIds(day, nextCount), claimedQuestIds: [],
      rerollCount: nextCount, chestClaimed: false, updatedAt: serverTimestamp(),
    }, { merge: true });
    if (price > 0 || useToken) {
      transaction.set(profileRef, {
        coins: coins - price,
        ...(useToken ? { dailyRerollTokens: tokens - 1 } : {}),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
    if (price > 0) {
      transaction.set(doc(firestore, ledgerPath(context.familyId, context.currentUserId, `dailyReroll_${day}_${nextCount}`)), {
        userId: context.currentUserId, type: 'daily_reroll', amount: -price,
        referenceId: day, createdAt: serverTimestamp(),
      });
    }
  });
}

export async function purchaseSystemItem(context: TasksRepositoryContext, itemId: string): Promise<string> {
  const item = SYSTEM_SHOP.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error('Товар больше не продаётся.');
  const firestore = db();
  const profileRef = doc(firestore, profilePath(context.familyId, context.currentUserId));
  const purchaseId = `${item.id}_${Date.now()}`;
  const inventoryId = ['avatar', 'frame', 'background', 'title', 'badge', 'effect'].includes(item.kind) ? item.id : '';
  const inventoryRef = inventoryId ? doc(firestore, `${inventoryPath(context.familyId, context.currentUserId)}/${inventoryId}`) : null;
  let result = `${item.icon} ${item.name}`;
  await runTransaction(firestore, async (transaction) => {
    const [profileSnapshot, inventorySnapshot] = await Promise.all([
      transaction.get(profileRef), inventoryRef ? transaction.get(inventoryRef) : Promise.resolve(null),
    ]);
    if (!profileSnapshot.exists()) throw new Error('Профиль ещё не готов.');
    const profile = mapProfile(context.currentUserId, profileSnapshot.data());
    if (profile.coins < item.price) throw new Error(`Нужно ${item.price} Coins.`);
    const duplicate = Boolean(inventorySnapshot?.exists());
    const duplicateCoins = duplicate ? GAME_CONFIG.duplicateConversionCoins : 0;
    const update: DocumentData = {
      coins: profile.coins - item.price + duplicateCoins,
      shopPurchases: profile.shopPurchases + 1,
      updatedAt: serverTimestamp(),
    };
    if (item.kind === 'mystery_chest') update.mysteryChests = profile.mysteryChests + 1;
    if (!duplicate && item.kind === 'streak_freeze') update.streakFreezes = profile.streakFreezes + 1;
    if (!duplicate && item.kind === 'daily_reroll') update.dailyRerollTokens = profile.dailyRerollTokens + 1;
    transaction.update(profileRef, update);
    if (inventoryRef && !duplicate) transaction.set(inventoryRef, {
      kind: item.kind, name: item.name, icon: item.icon, quantity: 1,
      value: item.value ?? null, permanent: !item.durationDays, sourceId: item.id,
      expiresAt: item.durationDays ? Timestamp.fromDate(new Date(Date.now() + item.durationDays * 86_400_000)) : null,
      createdAt: serverTimestamp(),
    });
    transaction.set(doc(firestore, ledgerPath(context.familyId, context.currentUserId, `shop_${purchaseId}`)), {
      userId: context.currentUserId, type: 'shop_purchase', amount: -item.price,
      referenceId: purchaseId, createdAt: serverTimestamp(),
    });
    if (duplicateCoins > 0) {
      result = `Дубликат ${item.name} превращён в ${duplicateCoins} Coins`;
      transaction.set(doc(firestore, ledgerPath(context.familyId, context.currentUserId, `duplicate_${purchaseId}`)), {
        userId: context.currentUserId, type: 'duplicate_conversion', amount: duplicateCoins,
        referenceId: purchaseId, createdAt: serverTimestamp(),
      });
    }
  });
  return result;
}

export async function openMysteryChest(context: TasksRepositoryContext): Promise<string> {
  const firestore = db();
  const profileRef = doc(firestore, profilePath(context.familyId, context.currentUserId));
  let result = '';
  await runTransaction(firestore, async (transaction) => {
    const profileSnapshot = await transaction.get(profileRef);
    if (!profileSnapshot.exists()) throw new Error('Профиль ещё не готов.');
    const profile = mapProfile(context.currentUserId, profileSnapshot.data());
    if (profile.mysteryChests <= 0) throw new Error('В инвентаре нет сундуков.');
    const seed = `${context.familyId}:${context.currentUserId}:chest:${profile.openedChests + 1}`;
    const reward = mysteryReward(seed);
    const inventoryId = ['avatar', 'frame', 'background', 'title', 'badge', 'effect'].includes(reward.kind) ? reward.id : '';
    const inventoryRef = inventoryId ? doc(firestore, `${inventoryPath(context.familyId, context.currentUserId)}/${inventoryId}`) : null;
    const inventorySnapshot = inventoryRef ? await transaction.get(inventoryRef) : null;
    const duplicate = Boolean(inventorySnapshot?.exists());
    const duplicateCoins = duplicate ? GAME_CONFIG.duplicateConversionCoins : 0;
    const update: DocumentData = {
      mysteryChests: profile.mysteryChests - 1,
      openedChests: profile.openedChests + 1,
      coins: profile.coins + duplicateCoins,
      updatedAt: serverTimestamp(),
    };
    if (!duplicate && reward.kind === 'streak_freeze') update.streakFreezes = profile.streakFreezes + 1;
    if (!duplicate && reward.kind === 'daily_reroll') update.dailyRerollTokens = profile.dailyRerollTokens + 1;
    transaction.update(profileRef, update);
    if (inventoryRef && !duplicate) transaction.set(inventoryRef, {
      kind: reward.kind, name: reward.name, icon: reward.icon, quantity: 1,
      value: reward.value ?? null, permanent: !reward.durationDays, sourceId: 'mystery_chest',
      expiresAt: reward.durationDays ? Timestamp.fromDate(new Date(Date.now() + reward.durationDays * 86_400_000)) : null,
      createdAt: serverTimestamp(),
    });
    if (duplicateCoins > 0) transaction.set(
      doc(firestore, ledgerPath(context.familyId, context.currentUserId, `duplicate_chest_${profile.openedChests + 1}`)),
      { userId: context.currentUserId, type: 'duplicate_conversion', amount: duplicateCoins, referenceId: seed, createdAt: serverTimestamp() },
    );
    transaction.set(doc(firestore, activityPath(context.familyId, `chestOpened_${context.currentUserId}_${profile.openedChests + 1}`)), {
      type: 'chest_opened', title: reward.name, userIds: [context.currentUserId], rarity: reward.rarity, createdAt: serverTimestamp(),
    });
    result = duplicate
      ? `${reward.rarity.toUpperCase()}: дубликат ${reward.name} → ${duplicateCoins} Coins`
      : `${reward.rarity.toUpperCase()}: ${reward.icon} ${reward.name}`;
  });
  return result;
}

export async function createFamilyReward(
  context: TasksRepositoryContext,
  input: { title: string; description?: string; price: number; quantity?: number; cooldownHours?: number },
): Promise<void> {
  const reference = doc(collection(db(), familyRewardsPath(context.familyId)));
  const firestore = db();
  await runTransaction(firestore, async (transaction) => {
    transaction.set(reference, {
      creatorId: context.currentUserId, title: input.title.trim(), description: input.description?.trim() || null,
      price: Math.max(1, input.price), quantity: input.quantity ?? null,
      cooldownHours: input.cooldownHours && input.cooldownHours > 0 ? input.cooldownHours : null, isActive: true,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  });
}

export async function purchaseFamilyReward(context: TasksRepositoryContext, rewardId: string): Promise<void> {
  const firestore = db();
  const rewardRef = doc(firestore, `${familyRewardsPath(context.familyId)}/${rewardId}`);
  const profileRef = doc(firestore, profilePath(context.familyId, context.currentUserId));
  const inventoryRef = doc(firestore, `${inventoryPath(context.familyId, context.currentUserId)}/family_${rewardId}`);
  const purchaseRef = doc(firestore, `${familyRewardPurchasesPath(context.familyId)}/${context.currentUserId}_${rewardId}`);
  await runTransaction(firestore, async (transaction) => {
    const [rewardSnapshot, profileSnapshot, inventorySnapshot, purchaseSnapshot] = await Promise.all([
      transaction.get(rewardRef), transaction.get(profileRef), transaction.get(inventoryRef), transaction.get(purchaseRef),
    ]);
    if (!rewardSnapshot.exists() || rewardSnapshot.data().isActive === false) throw new Error('Награда недоступна.');
    const price = Number(rewardSnapshot.data().price ?? 0);
    const quantity = rewardSnapshot.data().quantity;
    const cooldownHours = Number(rewardSnapshot.data().cooldownHours ?? 0);
    const lastPurchasedAt = purchaseSnapshot.data()?.lastPurchasedAt instanceof Timestamp
      ? purchaseSnapshot.data()!.lastPurchasedAt.toDate().getTime()
      : 0;
    if (cooldownHours > 0 && Date.now() - lastPurchasedAt < cooldownHours * 3_600_000) {
      const remaining = Math.ceil((cooldownHours * 3_600_000 - (Date.now() - lastPurchasedAt)) / 3_600_000);
      throw new Error(`Награду можно купить снова через ${remaining} ч.`);
    }
    const coins = Number(profileSnapshot.data()?.coins ?? 0);
    if (coins < price) throw new Error(`Нужно ${price} Coins.`);
    if (typeof quantity === 'number' && quantity <= 0) throw new Error('Награды закончились.');
    transaction.update(profileRef, {
      coins: coins - price,
      shopPurchases: Number(profileSnapshot.data()?.shopPurchases ?? 0) + 1,
      updatedAt: serverTimestamp(),
    });
    if (typeof quantity === 'number') transaction.update(rewardRef, { quantity: quantity - 1, updatedAt: serverTimestamp() });
    transaction.set(inventoryRef, {
      kind: 'family_reward', name: String(rewardSnapshot.data().title ?? 'Награда'), icon: '🎁',
      quantity: Number(inventorySnapshot?.data()?.quantity ?? 0) + 1, sourceId: rewardId,
      creatorId: rewardSnapshot.data().creatorId, updatedAt: serverTimestamp(),
    }, { merge: true });
    transaction.set(purchaseRef, { userId: context.currentUserId, rewardId, lastPurchasedAt: serverTimestamp() });
    transaction.set(doc(firestore, ledgerPath(context.familyId, context.currentUserId, `familyReward_${rewardId}_${Date.now()}`)), {
      userId: context.currentUserId, type: 'shop_purchase', amount: -price,
      referenceId: rewardId, createdAt: serverTimestamp(),
    });
  });
}

export async function resolveRewardRequest(
  context: TasksRepositoryContext,
  requestId: string,
  decision: 'approved' | 'rejected',
): Promise<void> {
  const firestore = db();
  const requestRef = doc(firestore, `${rewardRequestsPath(context.familyId)}/${requestId}`);
  await runTransaction(firestore, async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists() || requestSnapshot.data().status !== 'pending') throw new Error('Запрос уже обработан.');
    const request = requestSnapshot.data();
    if (request.creatorId !== context.currentUserId) throw new Error('Подтвердить награду может только её создатель.');
    const inventoryRef = doc(firestore, `${inventoryPath(context.familyId, String(request.requesterId ?? ''))}/${String(request.inventoryId ?? '')}`);
    const inventorySnapshot = decision === 'rejected' ? await transaction.get(inventoryRef) : null;
    if (decision === 'rejected') transaction.set(inventoryRef, {
      quantity: Number(inventorySnapshot?.data()?.quantity ?? 0) + 1,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    transaction.update(requestRef, { status: decision, resolvedAt: serverTimestamp(), resolvedById: context.currentUserId });
    transaction.set(doc(firestore, activityPath(context.familyId, `rewardRequest_${requestId}_${decision}`)), {
      type: decision === 'approved' ? 'reward_approved' : 'reward_rejected',
      title: String(request.title ?? 'Семейная награда'), userIds: [String(request.requesterId ?? '')], createdAt: serverTimestamp(),
    });
  });
}

export async function redeemInventoryItem(context: TasksRepositoryContext, inventoryId: string): Promise<void> {
  const firestore = db();
  const inventoryRef = doc(firestore, `${inventoryPath(context.familyId, context.currentUserId)}/${inventoryId}`);
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(inventoryRef);
    if (!snapshot.exists() || Number(snapshot.data().quantity ?? 0) <= 0) throw new Error('Предмет закончился.');
    if (snapshot.data().kind !== 'family_reward') throw new Error('Этот предмет экипируется в профиле.');
    const quantity = Number(snapshot.data().quantity ?? 0);
    transaction.update(inventoryRef, { quantity: quantity - 1, updatedAt: serverTimestamp() });
    const requestRef = doc(collection(firestore, `${appRootPath(context.familyId)}/rewardRequests`));
    transaction.set(requestRef, {
      inventoryId, rewardId: snapshot.data().sourceId ?? null, requesterId: context.currentUserId,
      creatorId: snapshot.data().creatorId ?? null, title: snapshot.data().name ?? 'Семейная награда',
      status: 'pending', createdAt: serverTimestamp(),
    });
  });
}

export async function equipProfileItem(context: TasksRepositoryContext, inventoryId: string): Promise<void> {
  const firestore = db();
  const inventoryRef = doc(firestore, `${inventoryPath(context.familyId, context.currentUserId)}/${inventoryId}`);
  const profileRef = doc(firestore, profilePath(context.familyId, context.currentUserId));
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(inventoryRef);
    if (!snapshot.exists()) throw new Error('Предмет не найден в инвентаре.');
    const kind = String(snapshot.data().kind ?? '');
    const expiresAt = snapshot.data().expiresAt instanceof Timestamp ? snapshot.data().expiresAt.toDate().getTime() : null;
    if (expiresAt && expiresAt <= Date.now()) throw new Error('Срок действия предмета закончился.');
    const field = kind === 'avatar' ? 'avatarOverride' : kind === 'frame' ? 'activeFrame' : kind === 'background' ? 'activeBackground' : kind === 'title' ? 'activeTitle' : kind === 'effect' ? 'activeEffect' : '';
    if (!field) throw new Error('Этот предмет нельзя экипировать.');
    transaction.update(profileRef, { [field]: snapshot.data().value ?? snapshot.data().name, updatedAt: serverTimestamp() });
  });
}
