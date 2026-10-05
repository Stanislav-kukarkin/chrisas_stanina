import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@chrisasstanina/firebase';
import { GAME_CONFIG } from '../domain/game-config';
import {
  profileFromTotalXp,
  taskReward,
  validateTransition,
  type BoardPlayerProfile,
  type FamilyTask,
  type NewTaskInput,
  type SprintBoss,
  type TaskDuration,
  type TaskStatus,
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

function appRootPath(familyId: string) {
  return `families/${familyId}/apps/tasks`;
}

function tasksPath(familyId: string) {
  return `${appRootPath(familyId)}/tasks`;
}

function taskPath(familyId: string, taskId: string) {
  return `${tasksPath(familyId)}/${taskId}`;
}

function profilesPath(familyId: string) {
  return `${appRootPath(familyId)}/profiles`;
}

function profilePath(familyId: string, userId: string) {
  return `${profilesPath(familyId)}/${userId}`;
}

function bossPath(familyId: string) {
  return `${appRootPath(familyId)}/bosses/current`;
}

function sprintPath(familyId: string) {
  return `${appRootPath(familyId)}/sprints/current`;
}

function settlementPath(familyId: string, taskId: string) {
  return `${appRootPath(familyId)}/settlements/taskReward_${taskId}_v1`;
}

function activityPath(familyId: string, eventId: string) {
  return `${appRootPath(familyId)}/activity/${eventId}`;
}

function ledgerPath(familyId: string, userId: string, transactionId: string) {
  return `${profilePath(familyId, userId)}/coinTransactions/${transactionId}`;
}

function db(): Firestore {
  return getFirebaseFirestore();
}

function asIso(value: unknown): string | undefined {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function mapTaskData(id: string, data: DocumentData): FamilyTask {
  const status = validStatuses.includes(data.status as TaskStatus) ? data.status as TaskStatus : 'backlog';
  const difficulty = data.difficulty === 'easy' || data.difficulty === 'hard' || data.difficulty === 'epic'
    ? data.difficulty
    : 'normal';
  const estimatedDuration = validDurations.includes(data.estimatedDuration as TaskDuration)
    ? data.estimatedDuration as TaskDuration
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
    difficultyStatus: data.difficultyStatus === 'pending' ? 'pending' : 'agreed',
    estimatedDuration,
    dueLabel: typeof data.dueLabel === 'string' ? data.dueLabel : undefined,
    dueTone: data.dueTone === 'soon' || data.dueTone === 'overdue' ? data.dueTone : 'normal',
    blockerIds: asStringArray(data.blockerIds),
    bonusCoins: typeof data.bonusCoins === 'number' ? Math.max(0, data.bonusCoins) : 0,
    bonusCoinsAuthorId: typeof data.bonusCoinsAuthorId === 'string' ? data.bonusCoinsAuthorId : undefined,
    rolloverCount: typeof data.rolloverCount === 'number' ? Math.max(0, data.rolloverCount) : 0,
    recurring: data.recurring === 'weekly' || data.recurring === 'monthly' ? data.recurring : undefined,
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
    streak: typeof data?.streak === 'number' ? Math.max(0, data.streak) : 0,
  };
}

function mapBoss(data: DocumentData | undefined): SprintBoss {
  return {
    id: 'current',
    name: typeof data?.name === 'string' ? data.name : 'Тыквенный Лентяй',
    hp: typeof data?.hp === 'number' ? Math.max(0, data.hp) : 100,
    maxHp: typeof data?.maxHp === 'number' ? Math.max(1, data.maxHp) : 100,
    potentialDamage: typeof data?.potentialDamage === 'number' ? Math.max(0, data.potentialDamage) : 0,
    sprintNumber: typeof data?.sprintNumber === 'number' ? data.sprintNumber : 1,
    sprintEndsAt: asIso(data?.sprintEndsAt),
  };
}

export async function ensureBoardBootstrap(context: TasksRepositoryContext): Promise<BoardBootstrapResult> {
  const firestore = db();
  const boardRef = doc(firestore, appRootPath(context.familyId));
  const profileRef = doc(firestore, profilePath(context.familyId, context.currentUserId));
  const sprintRef = doc(firestore, sprintPath(context.familyId));
  const bossRef = doc(firestore, bossPath(context.familyId));

  await runTransaction(firestore, async (transaction) => {
    const [boardSnapshot, profileSnapshot, sprintSnapshot, bossSnapshot] = await Promise.all([
      transaction.get(boardRef),
      transaction.get(profileRef),
      transaction.get(sprintRef),
      transaction.get(bossRef),
    ]);
    const now = new Date();
    const endsAt = new Date(now.getTime() + GAME_CONFIG.sprintDays * 86_400_000);

    if (!boardSnapshot.exists()) {
      transaction.set(boardRef, {
        schemaVersion: 1,
        activeSprintId: 'current',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    if (!profileSnapshot.exists()) {
      transaction.set(profileRef, {
        userId: context.currentUserId,
        displayName: context.currentUserName,
        level: 1,
        xp: 0,
        coins: 0,
        reservedCoins: 0,
        streak: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    if (!sprintSnapshot.exists()) {
      transaction.set(sprintRef, {
        id: 'current',
        number: 1,
        status: 'active',
        startedAt: Timestamp.fromDate(now),
        endsAt: Timestamp.fromDate(endsAt),
        bossId: 'current',
        createdAt: serverTimestamp(),
      });
    }
    if (!bossSnapshot.exists()) {
      transaction.set(bossRef, {
        id: 'current',
        name: 'Тыквенный Лентяй',
        archetype: 'lazy',
        season: 'pumpkin',
        quote: 'Я уже почти начал. Ещё пять минут…',
        hp: 100,
        maxHp: 100,
        potentialDamage: 0,
        sprintNumber: 1,
        sprintEndsAt: Timestamp.fromDate(endsAt),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  });

  return { sprintId: 'current' };
}

export async function fetchTasks(familyId: string): Promise<FamilyTask[]> {
  const tasksQuery = query(collection(db(), tasksPath(familyId)), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(tasksQuery);
  return snapshot.docs.map((taskSnapshot) => mapTaskData(taskSnapshot.id, taskSnapshot.data()));
}

export async function fetchPlayerProfile(
  familyId: string,
  userId: string,
): Promise<BoardPlayerProfile> {
  const snapshot = await getDoc(doc(db(), profilePath(familyId, userId)));
  return mapProfile(userId, snapshot.data());
}

export async function fetchBoss(
  familyId: string,
): Promise<SprintBoss> {
  const snapshot = await getDoc(doc(db(), bossPath(familyId)));
  return mapBoss(snapshot.data());
}

function sprintDay(data: DocumentData | undefined): number {
  const startedAt = data?.startedAt instanceof Timestamp ? data.startedAt.toDate().getTime() : Date.now();
  return Math.max(1, Math.floor((Date.now() - startedAt) / 86_400_000) + 1);
}

function bossGrowthForTask(damage: number, day: number) {
  const healRatio = day <= 7 ? GAME_CONFIG.bossFirstWeekHealRatio : GAME_CONFIG.bossSecondWeekHealRatio;
  return {
    maxHp: Math.round(damage * GAME_CONFIG.bossTargetRatio),
    heal: Math.round(damage * healRatio),
  };
}

export async function createTask(context: TasksRepositoryContext, input: NewTaskInput): Promise<string> {
  const firestore = db();
  const taskRef = doc(collection(firestore, tasksPath(context.familyId)));
  const bossRef = doc(firestore, bossPath(context.familyId));
  const sprintRef = doc(firestore, sprintPath(context.familyId));
  const authorProfileRef = doc(firestore, profilePath(context.familyId, context.currentUserId));

  await runTransaction(firestore, async (transaction) => {
    const [bossSnapshot, sprintSnapshot, authorProfileSnapshot] = await Promise.all([
      transaction.get(bossRef),
      transaction.get(sprintRef),
      transaction.get(authorProfileRef),
    ]);
    const inSprint = input.status === 'planned';
    const bonusCoins = Math.max(0, input.bonusCoins);
    const authorProfile = authorProfileSnapshot.data();
    const authorCoins = typeof authorProfile?.coins === 'number' ? Math.max(0, authorProfile.coins) : 0;
    const reservedCoins = typeof authorProfile?.reservedCoins === 'number' ? Math.max(0, authorProfile.reservedCoins) : 0;
    if (bonusCoins > authorCoins) {
      throw new Error(`Для бонуса нужно ${bonusCoins} Coins, а в кошельке ${authorCoins}.`);
    }
    transaction.set(taskRef, {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      status: input.status,
      authorId: context.currentUserId,
      assigneeIds: input.assigneeId ? [input.assigneeId] : [],
      reviewerId: input.reviewerId,
      difficulty: input.difficulty,
      difficultyStatus: 'agreed',
      estimatedDuration: input.estimatedDuration ?? null,
      dueLabel: input.dueLabel?.trim() || null,
      dueTone: 'normal',
      sprintId: inSprint ? 'current' : null,
      blockerIds: [],
      bonusCoins,
      bonusCoinsAuthorId: bonusCoins > 0 ? context.currentUserId : null,
      rolloverCount: 0,
      recurring: input.recurring ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (bonusCoins > 0) {
      transaction.set(authorProfileRef, {
        userId: context.currentUserId,
        displayName: typeof authorProfile?.displayName === 'string' ? authorProfile.displayName : context.currentUserName,
        coins: authorCoins - bonusCoins,
        reservedCoins: reservedCoins + bonusCoins,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      transaction.set(doc(firestore, ledgerPath(context.familyId, context.currentUserId, `bonusReserve_${taskRef.id}`)), {
        userId: context.currentUserId,
        type: 'bonus_reserve',
        amount: -bonusCoins,
        referenceId: taskRef.id,
        createdAt: serverTimestamp(),
      });
    }

    if (inSprint && bossSnapshot.exists()) {
      const damage = GAME_CONFIG.difficulty[input.difficulty].bossDamage;
      const growth = bossGrowthForTask(damage, sprintDay(sprintSnapshot.data()));
      const boss = bossSnapshot.data();
      const previousMax = typeof boss.maxHp === 'number' ? boss.maxHp : 1;
      const previousHp = typeof boss.hp === 'number' ? boss.hp : previousMax;
      transaction.update(bossRef, {
        potentialDamage: (typeof boss.potentialDamage === 'number' ? boss.potentialDamage : 0) + damage,
        maxHp: previousMax + growth.maxHp,
        hp: Math.min(previousMax + growth.maxHp, previousHp + growth.heal),
        updatedAt: serverTimestamp(),
      });
    }
  });
  return taskRef.id;
}

export async function agreeTaskDifficulty(context: TasksRepositoryContext, taskId: string): Promise<void> {
  const firestore = db();
  const taskRef = doc(firestore, taskPath(context.familyId, taskId));
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(taskRef);
    if (!snapshot.exists()) throw new Error('Задача уже удалена.');
    const data = snapshot.data();
    const assignees = asStringArray(data.assigneeIds);
    if (assignees.length > 0 && !assignees.includes(context.currentUserId) && data.authorId !== context.currentUserId) {
      throw new Error('Согласовать сложность может исполнитель или автор.');
    }
    transaction.update(taskRef, { difficultyStatus: 'agreed', updatedAt: serverTimestamp() });
  });
}

export async function claimTask(context: TasksRepositoryContext, taskId: string): Promise<void> {
  const firestore = db();
  const taskRef = doc(firestore, taskPath(context.familyId, taskId));
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(taskRef);
    if (!snapshot.exists()) throw new Error('Задача уже удалена.');
    if (asStringArray(snapshot.data().assigneeIds).length > 0) {
      throw new Error('Эту задачу уже взял другой участник.');
    }
    transaction.update(taskRef, { assigneeIds: [context.currentUserId], updatedAt: serverTimestamp() });
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
    const blockers = blockerSnapshots.map((snapshot) => ({
      ...task,
      id: snapshot.id,
      status: snapshot.exists() && validStatuses.includes(snapshot.data().status as TaskStatus)
        ? snapshot.data().status as TaskStatus
        : 'backlog',
    }));
    const error = validateTransition(task, target, [task, ...blockers]);
    if (error) throw new Error(error);

    if (task.status === 'review' && target === 'done' && task.reviewerId !== context.currentUserId) {
      throw new Error('Подтвердить задачу может только назначенный reviewer.');
    }
    if (task.status === 'planned' && target === 'in_progress' && task.assigneeIds.length > 0 && !task.assigneeIds.includes(context.currentUserId)) {
      throw new Error('Начать задачу может её исполнитель.');
    }

    const settlementRef = doc(firestore, settlementPath(context.familyId, taskId));
    const isCompletion = task.status === 'review' && target === 'done';
    const settlementSnapshot = isCompletion ? await transaction.get(settlementRef) : null;
    const shouldSettle = isCompletion && !settlementSnapshot?.exists();
    const bossRef = doc(firestore, bossPath(context.familyId));
    const sprintRef = doc(firestore, sprintPath(context.familyId));
    const needsBoss = shouldSettle || (task.status === 'backlog' && target === 'planned');
    const bossSnapshot = needsBoss ? await transaction.get(bossRef) : null;
    const sprintSnapshot = task.status === 'backlog' && target === 'planned'
      ? await transaction.get(sprintRef)
      : null;

    const reward = shouldSettle ? taskReward(task) : null;
    const reviewerIsTimely = !task.reviewStartedAt
      || Date.now() - new Date(task.reviewStartedAt).getTime() <= 86_400_000;
    const recipientRewards = new Map<string, { xp: number; coins: number }>();
    if (reward) {
      const baseCoins = GAME_CONFIG.difficulty[task.difficulty].coins;
      task.assigneeIds.forEach((userId, index) => {
        recipientRewards.set(userId, {
          xp: reward.xp,
          coins: baseCoins + (index === 0 ? task.bonusCoins : 0),
        });
      });
      if (reviewerIsTimely) {
        const reviewerReward = recipientRewards.get(task.reviewerId) ?? { xp: 0, coins: 0 };
        recipientRewards.set(task.reviewerId, {
          ...reviewerReward,
          coins: reviewerReward.coins + GAME_CONFIG.reviewerReward,
        });
      }
    }
    const bonusAuthorId = task.bonusCoins > 0 ? task.bonusCoinsAuthorId : undefined;
    const profileIds = [...new Set([
      ...recipientRewards.keys(),
      ...(bonusAuthorId ? [bonusAuthorId] : []),
    ])];
    const profileSnapshots = await Promise.all(profileIds.map((userId) =>
      transaction.get(doc(firestore, profilePath(context.familyId, userId))),
    ));

    const taskUpdate: Record<string, unknown> = { status: target, updatedAt: serverTimestamp() };
    if (task.status === 'backlog' && target === 'planned') taskUpdate.sprintId = 'current';
    if (task.status === 'planned' && target === 'in_progress' && task.assigneeIds.length === 0) {
      taskUpdate.assigneeIds = [context.currentUserId];
    }
    if (target === 'review') taskUpdate.reviewStartedAt = serverTimestamp();
    if (task.status === 'review' && target === 'in_progress') taskUpdate.reviewStartedAt = deleteField();
    if (target === 'done') taskUpdate.completedAt = serverTimestamp();
    if (shouldSettle) {
      taskUpdate.rewardSettledAt = serverTimestamp();
      taskUpdate.bossDamageSettledAt = serverTimestamp();
    }
    transaction.update(taskRef, taskUpdate);

    if (task.status === 'backlog' && target === 'planned' && bossSnapshot?.exists()) {
      const damage = GAME_CONFIG.difficulty[task.difficulty].bossDamage;
      const growth = bossGrowthForTask(damage, sprintDay(sprintSnapshot?.data()));
      const boss = bossSnapshot.data();
      const previousMax = typeof boss.maxHp === 'number' ? boss.maxHp : 1;
      const previousHp = typeof boss.hp === 'number' ? boss.hp : previousMax;
      transaction.update(bossRef, {
        potentialDamage: (typeof boss.potentialDamage === 'number' ? boss.potentialDamage : 0) + damage,
        maxHp: previousMax + growth.maxHp,
        hp: Math.min(previousMax + growth.maxHp, previousHp + growth.heal),
        updatedAt: serverTimestamp(),
      });
    }

    if (reward) {
      profileIds.forEach((userId, index) => {
        const earned = recipientRewards.get(userId) ?? { xp: 0, coins: 0 };
        const snapshot = profileSnapshots[index];
        const raw = snapshot?.data();
        const currentXp = typeof raw?.xp === 'number' ? Math.max(0, raw.xp) : 0;
        const currentCoins = typeof raw?.coins === 'number' ? Math.max(0, raw.coins) : 0;
        const nextXp = currentXp + earned.xp;
        transaction.set(doc(firestore, profilePath(context.familyId, userId)), {
          userId,
          displayName: typeof raw?.displayName === 'string' ? raw.displayName : 'Игрок',
          xp: nextXp,
          level: profileFromTotalXp(nextXp).level,
          coins: currentCoins + earned.coins,
          reservedCoins: Math.max(
            0,
            (typeof raw?.reservedCoins === 'number' ? raw.reservedCoins : 0)
              - (userId === bonusAuthorId ? task.bonusCoins : 0),
          ),
          streak: typeof raw?.streak === 'number' ? raw.streak : 0,
          createdAt: raw?.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
        const isAssignee = task.assigneeIds.includes(userId);
        if (isAssignee) {
          transaction.set(doc(firestore, ledgerPath(context.familyId, userId, `taskReward_${taskId}_v1`)), {
            userId,
            type: 'task_reward',
            amount: GAME_CONFIG.difficulty[task.difficulty].coins,
            referenceId: taskId,
            createdAt: serverTimestamp(),
          });
        }
        if (isAssignee && task.assigneeIds[0] === userId && task.bonusCoins > 0) {
          transaction.set(doc(firestore, ledgerPath(context.familyId, userId, `taskBonus_${taskId}_v1`)), {
            userId,
            type: 'task_bonus',
            amount: task.bonusCoins,
            referenceId: taskId,
            createdAt: serverTimestamp(),
          });
        }
        if (reviewerIsTimely && task.reviewerId === userId) {
          transaction.set(doc(firestore, ledgerPath(context.familyId, userId, `reviewReward_${taskId}_v1`)), {
            userId,
            type: 'review_reward',
            amount: GAME_CONFIG.reviewerReward,
            referenceId: taskId,
            createdAt: serverTimestamp(),
          });
        }
      });
      if (bossSnapshot?.exists()) {
        const currentHp = typeof bossSnapshot.data().hp === 'number' ? bossSnapshot.data().hp : 0;
        transaction.update(bossRef, {
          hp: Math.max(0, currentHp - reward.bossDamage),
          updatedAt: serverTimestamp(),
        });
      }
      transaction.set(settlementRef, {
        type: 'task_completion',
        taskId,
        completionVersion: 1,
        assigneeIds: task.assigneeIds,
        reviewerId: task.reviewerId,
        xp: reward.xp,
        coins: reward.coins,
        bossDamage: reward.bossDamage,
        createdAt: serverTimestamp(),
      });
      transaction.set(doc(firestore, activityPath(context.familyId, `taskCompleted_${taskId}_v1`)), {
        type: 'TASK_COMPLETED',
        taskId,
        taskTitle: task.title,
        actorId: context.currentUserId,
        assigneeIds: task.assigneeIds,
        xp: reward.xp,
        coins: reward.coins,
        bossDamage: reward.bossDamage,
        createdAt: serverTimestamp(),
      });
    }

    return { reward };
  });
}
