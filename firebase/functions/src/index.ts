import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore, type DocumentData, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  DAILY_DEFINITIONS,
  ECONOMY,
  SYSTEM_SHOP,
  dailyDefinitionIds,
  dailyProgress,
  dateKey,
  deadlinePenalty,
  levelFromTotalXp,
  mysteryReward,
  numberValue,
  stringArray,
  type Difficulty,
} from './economy.js';

if (getApps().length === 0) initializeApp();

const db = getFirestore();
const REGION = 'europe-west1';
const editableRoles = new Set(['edit']);
const statusTransitions: Record<string, string[]> = {
  backlog: ['planned'],
  planned: ['in_progress'],
  in_progress: ['review'],
  review: ['done', 'in_progress'],
  done: ['in_progress'],
};

type CommandName =
  | 'transitionTask'
  | 'agreeDifficulty'
  | 'deleteTask'
  | 'claimDaily'
  | 'rerollDaily'
  | 'purchaseSystemItem'
  | 'openMysteryChest'
  | 'createFamilyReward'
  | 'purchaseFamilyReward'
  | 'resolveRewardRequest'
  | 'redeemInventoryItem'
  | 'equipProfileItem';

interface CommandPayload {
  familyId: string;
  command: CommandName;
  commandId: string;
  taskId?: string;
  target?: string;
  questId?: string;
  itemId?: string;
  rewardId?: string;
  requestId?: string;
  inventoryId?: string;
  decision?: 'approved' | 'rejected';
  reward?: { title?: string; description?: string; price?: number; quantity?: number; cooldownHours?: number };
}

function root(familyId: string) { return `families/${familyId}/apps/tasks`; }
function taskRef(familyId: string, taskId: string) { return db.doc(`${root(familyId)}/tasks/${taskId}`); }
function profileRef(familyId: string, userId: string) { return db.doc(`${root(familyId)}/profiles/${userId}`); }
function inventoryRef(familyId: string, userId: string, itemId: string) { return db.doc(`${root(familyId)}/profiles/${userId}/inventory/${itemId}`); }
function ledgerRef(familyId: string, userId: string, entryId: string) { return db.doc(`${root(familyId)}/profiles/${userId}/coinTransactions/${entryId}`); }
function commandRef(familyId: string, userId: string, commandId: string) { return db.doc(`${root(familyId)}/commands/${userId}_${commandId}`); }

function text(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new HttpsError('invalid-argument', `Некорректное поле ${field}.`);
  }
  return value.trim();
}

function difficulty(value: unknown): Difficulty {
  return value === 'easy' || value === 'normal' || value === 'hard' || value === 'epic' ? value : 'normal';
}

function timestampDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'string') {
    const result = new Date(value);
    return Number.isNaN(result.getTime()) ? null : result;
  }
  return null;
}

function emptyStreaks() {
  return Object.fromEntries(['daily', 'task', 'deadline', 'review', 'boss'].map((key) => [key, { count: 0 }]));
}

function streaks(data: DocumentData | undefined): Record<string, { count: number; lastDate?: string }> {
  const raw = data?.streaks && typeof data.streaks === 'object' ? data.streaks as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(emptyStreaks()).map(([key, fallback]) => {
    const item = raw[key] && typeof raw[key] === 'object' ? raw[key] as Record<string, unknown> : {};
    return [key, {
      count: typeof item.count === 'number' ? Math.max(0, item.count) : fallback.count,
      ...(typeof item.lastDate === 'string' ? { lastDate: item.lastDate } : {}),
    }];
  }));
}

function advanceStreak(value: { count: number; lastDate?: string }, now: Date) {
  const current = dateKey(now);
  if (value.lastDate === current) return value;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return { count: value.lastDate === dateKey(yesterday) ? value.count + 1 : 1, lastDate: current };
}

async function assertEditor(familyId: string, userId: string): Promise<void> {
  const member = db.doc(`families/${familyId}/members/${userId}`);
  const access = db.doc(`families/${familyId}/appAccess/tasks/members/${userId}`);
  const [memberSnapshot, accessSnapshot] = await Promise.all([member.get(), access.get()]);
  if (!memberSnapshot.exists) throw new HttpsError('permission-denied', 'Вы не состоите в этой семье.');
  const legacy = !('accessVersion' in (memberSnapshot.data() ?? {}));
  if (!legacy && (!accessSnapshot.exists || !editableRoles.has(String(accessSnapshot.data()?.role)))) {
    throw new HttpsError('permission-denied', 'У вас есть только доступ на просмотр.');
  }
}

function rememberCommand(transaction: Transaction, ref: FirebaseFirestore.DocumentReference, command: string, result: unknown = null) {
  transaction.create(ref, { command, result, createdAt: FieldValue.serverTimestamp() });
}

function previousResult(snapshot: FirebaseFirestore.DocumentSnapshot): unknown | undefined {
  return snapshot.exists ? snapshot.data()?.result ?? null : undefined;
}

async function transitionTask(payload: CommandPayload, userId: string) {
  const familyId = payload.familyId;
  const taskId = text(payload.taskId, 'taskId');
  const target = text(payload.target, 'target');
  if (!['backlog', 'planned', 'in_progress', 'review', 'done'].includes(target)) throw new HttpsError('invalid-argument', 'Некорректный статус.');
  return db.runTransaction(async (transaction) => {
    const command = commandRef(familyId, userId, payload.commandId);
    const saved = await transaction.get(command);
    const replay = previousResult(saved);
    if (replay !== undefined) return replay;
    const taskReference = taskRef(familyId, taskId);
    const snapshot = await transaction.get(taskReference);
    if (!snapshot.exists) throw new HttpsError('not-found', 'Задача уже удалена.');
    const task = snapshot.data()!;
    const from = String(task.status ?? 'backlog');
    if (!statusTransitions[from]?.includes(target)) throw new HttpsError('failed-precondition', 'Этот переход недоступен в текущем workflow.');
    const assigneeIds = stringArray(task.assigneeIds);
    if (from === 'planned' && target === 'in_progress') {
      if (!assigneeIds.includes(userId)) throw new HttpsError('permission-denied', 'Начать задачу может только исполнитель.');
      if (task.difficultyStatus !== 'agreed') throw new HttpsError('failed-precondition', 'Сначала согласуйте сложность задачи.');
      for (const blockerId of stringArray(task.blockerIds)) {
        const blocker = await transaction.get(taskRef(familyId, blockerId));
        if (!blocker.exists || blocker.data()?.status !== 'done') throw new HttpsError('failed-precondition', 'Задача пока заблокирована зависимостями.');
      }
    }
    if (from === 'in_progress' && target === 'review' && !assigneeIds.includes(userId)) {
      throw new HttpsError('permission-denied', 'Отправить на проверку может только исполнитель.');
    }
    if (from === 'review' && target === 'done' && task.reviewerId !== userId) {
      throw new HttpsError('permission-denied', 'Подтвердить задачу может только назначенный reviewer.');
    }
    const update: DocumentData = { status: target, updatedAt: FieldValue.serverTimestamp() };
    if (target === 'review') update.reviewStartedAt = FieldValue.serverTimestamp();
    if (from === 'review' && target === 'in_progress') update.reviewStartedAt = FieldValue.delete();
    const sprint = db.doc(`${root(familyId)}/sprints/current`);
    const boss = db.doc(`${root(familyId)}/bosses/current`);
    if (from === 'planned' && target === 'in_progress') {
      const sprintSnapshot = await transaction.get(sprint);
      const activeSprintId = String(sprintSnapshot.data()?.id ?? 'sprint-1');
      if (task.sprintId && task.sprintId !== activeSprintId && task.sprintId !== 'current') {
        throw new HttpsError('failed-precondition', 'Эта задача запланирована на следующий спринт.');
      }
    }
    if (from === 'backlog' && target === 'planned') {
      const [sprintSnapshot, bossSnapshot] = await Promise.all([transaction.get(sprint), transaction.get(boss)]);
      update.sprintId = String(sprintSnapshot.data()?.id ?? 'sprint-1');
      if (task.difficultyStatus === 'agreed' && !task.bossPlannedAt && bossSnapshot.exists) {
        const damage = ECONOMY.difficulty[difficulty(task.difficulty)].bossDamage;
        const potentialDamage = numberValue(bossSnapshot.data()?.potentialDamage) + damage;
        const maxHp = Math.max(1, Math.round(potentialDamage * 0.85));
        const currentHp = numberValue(bossSnapshot.data()?.hp);
        const start = timestampDate(sprintSnapshot.data()?.startedAt);
        const day = start ? Math.max(1, Math.floor((Date.now() - start.getTime()) / 86_400_000) + 1) : 1;
        const heal = Math.round(damage * (day <= 7 ? 0.5 : 0.25));
        transaction.update(boss, { potentialDamage, maxHp, hp: Math.min(maxHp, currentHp + heal), updatedAt: FieldValue.serverTimestamp() });
        update.bossPlannedAt = FieldValue.serverTimestamp();
      }
    }
    let result: unknown = { reward: null };
    if (from === 'review' && target === 'done') {
      const settlement = db.doc(`${root(familyId)}/settlements/taskReward_${taskId}_v1`);
      const [settled, bossSnapshot] = await Promise.all([transaction.get(settlement), transaction.get(boss)]);
      if (!settled.exists) {
        const reward = ECONOMY.difficulty[difficulty(task.difficulty)];
        const bonusCoins = Math.max(0, numberValue(task.bonusCoins));
        const penalty = deadlinePenalty(task.dueDate);
        const profileIds = [...new Set([...assigneeIds, String(task.reviewerId ?? ''), String(task.authorId ?? '')])].filter(Boolean);
        const snapshots = await Promise.all(profileIds.map((id) => transaction.get(profileRef(familyId, id))));
        const profiles = new Map(profileIds.map((id, index) => [id, snapshots[index].data()]));
        assigneeIds.forEach((id, index) => {
          const raw = profiles.get(id);
          const totalXp = numberValue(raw?.xp) + reward.xp;
          const taskBonus = index === 0 ? bonusCoins : 0;
          const currentStreaks = streaks(raw);
          currentStreaks.task = advanceStreak(currentStreaks.task, new Date());
          currentStreaks.deadline = penalty === 0 ? advanceStreak(currentStreaks.deadline, new Date()) : { count: 0, lastDate: dateKey() };
          transaction.set(profileRef(familyId, id), {
            xp: totalXp,
            level: levelFromTotalXp(totalXp),
            coins: Math.max(0, numberValue(raw?.coins) + reward.coins + taskBonus - penalty),
            streaks: currentStreaks,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          transaction.set(ledgerRef(familyId, id, `taskReward_${taskId}_v1`), { userId: id, type: 'task_reward', amount: reward.coins, referenceId: taskId, createdAt: FieldValue.serverTimestamp() });
          if (taskBonus > 0) transaction.set(ledgerRef(familyId, id, `taskBonus_${taskId}_v1`), { userId: id, type: 'task_bonus', amount: taskBonus, referenceId: taskId, createdAt: FieldValue.serverTimestamp() });
          if (penalty > 0) transaction.set(ledgerRef(familyId, id, `deadlinePenalty_${taskId}_v1`), { userId: id, type: 'deadline_penalty', amount: -Math.min(numberValue(raw?.coins) + reward.coins + taskBonus, penalty), referenceId: taskId, createdAt: FieldValue.serverTimestamp() });
        });
        const reviewerId = String(task.reviewerId ?? '');
        const reviewerRaw = profiles.get(reviewerId);
        const reviewerStreaks = streaks(reviewerRaw);
        const reviewerIndex = assigneeIds.indexOf(reviewerId);
        const reviewerTimely = !task.reviewStartedAt || Date.now() - (timestampDate(task.reviewStartedAt)?.getTime() ?? Date.now()) <= 86_400_000;
        reviewerStreaks.review = reviewerTimely ? advanceStreak(reviewerStreaks.review, new Date()) : { count: 0, lastDate: dateKey() };
        const reviewerTaskCoins = reviewerIndex < 0 ? 0 : reward.coins + (reviewerIndex === 0 ? bonusCoins : 0) - penalty;
        const reviewerBonus = reviewerTimely ? ECONOMY.reviewerReward : 0;
        transaction.set(profileRef(familyId, reviewerId), { coins: Math.max(0, numberValue(reviewerRaw?.coins) + reviewerTaskCoins + reviewerBonus), streaks: reviewerStreaks, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        if (reviewerBonus > 0) transaction.set(ledgerRef(familyId, reviewerId, `reviewReward_${taskId}_v1`), { userId: reviewerId, type: 'reviewer_reward', amount: reviewerBonus, referenceId: taskId, createdAt: FieldValue.serverTimestamp() });
        if (task.bonusReservedAt && bonusCoins > 0) {
          const authorId = String(task.authorId ?? '');
          transaction.set(profileRef(familyId, authorId), { reservedCoins: Math.max(0, numberValue(profiles.get(authorId)?.reservedCoins) - bonusCoins), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
        if (bossSnapshot.exists) {
          const oldHp = numberValue(bossSnapshot.data()?.hp);
          const hp = Math.max(0, oldHp - reward.bossDamage);
          transaction.update(boss, { hp, ...(oldHp > 0 && hp === 0 ? { finalHitUserId: assigneeIds[0] ?? null, finalHitTaskId: taskId, defeatedAt: FieldValue.serverTimestamp() } : {}), updatedAt: FieldValue.serverTimestamp() });
          if (oldHp > 0 && hp === 0) transaction.set(db.doc(`${root(familyId)}/activity/bossDefeated_${task.sprintId ?? 'current'}`), { type: 'boss_defeated', taskId, title: task.title, userIds: assigneeIds, createdAt: FieldValue.serverTimestamp() });
        }
        transaction.create(settlement, { taskId, sprintId: task.sprintId ?? null, assigneeIds, reviewerId, xp: reward.xp, coins: reward.coins + bonusCoins, deadlinePenalty: penalty, bossDamage: reward.bossDamage, createdAt: FieldValue.serverTimestamp() });
        transaction.set(db.doc(`${root(familyId)}/activity/taskCompleted_${taskId}_v1`), { type: 'task_completed', taskId, title: task.title, userIds: assigneeIds, reviewerId, bossDamage: reward.bossDamage, createdAt: FieldValue.serverTimestamp() });
        update.rewardSettledAt = FieldValue.serverTimestamp();
        update.bossDamageSettledAt = FieldValue.serverTimestamp();
        update.completedAt = FieldValue.serverTimestamp();
        result = { reward: { ...reward, coins: reward.coins + bonusCoins } };
      }
    }
    transaction.update(taskReference, update);
    rememberCommand(transaction, command, payload.command, result);
    return result;
  });
}

async function agreeDifficulty(payload: CommandPayload, userId: string) {
  const familyId = payload.familyId;
  const taskId = text(payload.taskId, 'taskId');
  return db.runTransaction(async (transaction) => {
    const command = commandRef(familyId, userId, payload.commandId);
    const [saved, taskSnapshot] = await Promise.all([transaction.get(command), transaction.get(taskRef(familyId, taskId))]);
    const replay = previousResult(saved);
    if (replay !== undefined) return replay;
    if (!taskSnapshot.exists) throw new HttpsError('not-found', 'Задача уже удалена.');
    const task = taskSnapshot.data()!;
    const assignees = stringArray(task.assigneeIds);
    const isAuthor = task.authorId === userId;
    if (!isAuthor && !assignees.includes(userId)) throw new HttpsError('permission-denied', 'Согласовать сложность может исполнитель или автор.');
    if (task.difficultyProposedById === userId && !(isAuthor && assignees.includes(userId))) throw new HttpsError('failed-precondition', 'Предложение должен подтвердить другой участник.');
    const bonus = Math.max(0, numberValue(task.bonusCoins));
    const update: DocumentData = { difficultyStatus: 'agreed', updatedAt: FieldValue.serverTimestamp() };
    if (bonus > 0 && !task.bonusReservedAt) {
      const author = profileRef(familyId, String(task.authorId));
      const authorSnapshot = await transaction.get(author);
      const coins = numberValue(authorSnapshot.data()?.coins);
      if (coins < bonus) throw new HttpsError('failed-precondition', `У автора недостаточно Coins для бонуса ${bonus}.`);
      transaction.set(author, { coins: coins - bonus, reservedCoins: numberValue(authorSnapshot.data()?.reservedCoins) + bonus, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(ledgerRef(familyId, String(task.authorId), `bonusReserve_${taskId}`), { userId: task.authorId, type: 'bonus_reserve', amount: -bonus, referenceId: taskId, createdAt: FieldValue.serverTimestamp() });
      update.bonusReservedAt = FieldValue.serverTimestamp();
    }
    transaction.update(taskSnapshot.ref, update);
    rememberCommand(transaction, command, payload.command);
    return null;
  });
}

async function deleteTask(payload: CommandPayload, userId: string) {
  const familyId = payload.familyId;
  const taskId = text(payload.taskId, 'taskId');
  return db.runTransaction(async (transaction) => {
    const command = commandRef(familyId, userId, payload.commandId);
    const [saved, snapshot] = await Promise.all([transaction.get(command), transaction.get(taskRef(familyId, taskId))]);
    if (previousResult(saved) !== undefined) return null;
    if (!snapshot.exists) { rememberCommand(transaction, command, payload.command); return null; }
    const task = snapshot.data()!;
    if (task.authorId !== userId) throw new HttpsError('permission-denied', 'Удалить задачу может только автор.');
    if (task.status === 'done') throw new HttpsError('failed-precondition', 'Завершённую задачу нельзя удалить.');
    const bonus = Math.max(0, numberValue(task.bonusCoins));
    if (task.bonusReservedAt && bonus > 0) {
      const author = profileRef(familyId, userId);
      const authorSnapshot = await transaction.get(author);
      transaction.set(author, { coins: numberValue(authorSnapshot.data()?.coins) + bonus, reservedCoins: Math.max(0, numberValue(authorSnapshot.data()?.reservedCoins) - bonus), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(ledgerRef(familyId, userId, `bonusRelease_${taskId}`), { userId, type: 'bonus_release', amount: bonus, referenceId: taskId, createdAt: FieldValue.serverTimestamp() });
    }
    if (typeof task.recurrenceTemplateId === 'string') transaction.set(db.doc(`${root(familyId)}/recurrenceTemplates/${task.recurrenceTemplateId}`), { active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.delete(snapshot.ref);
    rememberCommand(transaction, command, payload.command);
    return null;
  });
}

async function claimDaily(payload: CommandPayload, userId: string) {
  const familyId = payload.familyId;
  const questId = text(payload.questId, 'questId');
  const day = dateKey();
  const tasks = (await db.collection(`${root(familyId)}/tasks`).get()).docs.map((doc) => doc.data());
  return db.runTransaction(async (transaction) => {
    const command = commandRef(familyId, userId, payload.commandId);
    const daily = db.doc(`${root(familyId)}/daily/${day}/players/${userId}`);
    const profile = profileRef(familyId, userId);
    const [saved, dailySnapshot, profileSnapshot] = await Promise.all([transaction.get(command), transaction.get(daily), transaction.get(profile)]);
    if (previousResult(saved) !== undefined) return null;
    const raw = dailySnapshot.data();
    const rerollCount = numberValue(raw?.rerollCount);
    const questIds = stringArray(raw?.questIds).length ? stringArray(raw?.questIds) : dailyDefinitionIds(day, rerollCount);
    if (!questIds.includes(questId)) throw new HttpsError('failed-precondition', 'Квест больше не активен.');
    const claimed = stringArray(raw?.claimedQuestIds);
    if (claimed.includes(questId)) { rememberCommand(transaction, command, payload.command); return null; }
    const definition = DAILY_DEFINITIONS.find((item) => item.id === questId);
    if (!definition || dailyProgress(questId, tasks, userId, day) < definition.target) throw new HttpsError('failed-precondition', 'Квест ещё не выполнен.');
    const nextClaimed = [...claimed, questId];
    const complete = questIds.every((id) => nextClaimed.includes(id));
    const chest = complete && raw?.chestClaimed !== true;
    const currentStreaks = streaks(profileSnapshot.data());
    if (chest) currentStreaks.daily = advanceStreak(currentStreaks.daily, new Date());
    transaction.set(profile, { coins: numberValue(profileSnapshot.data()?.coins) + definition.rewardCoins, mysteryChests: numberValue(profileSnapshot.data()?.mysteryChests) + (chest ? 1 : 0), streaks: currentStreaks, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(daily, { dateKey: day, questIds, claimedQuestIds: nextClaimed, rerollCount, chestClaimed: raw?.chestClaimed === true || complete, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(ledgerRef(familyId, userId, `daily_${day}_${questId}`), { userId, type: 'daily_reward', amount: definition.rewardCoins, referenceId: `${day}_${questId}`, createdAt: FieldValue.serverTimestamp() });
    rememberCommand(transaction, command, payload.command);
    return null;
  });
}

async function rerollDaily(payload: CommandPayload, userId: string) {
  const familyId = payload.familyId;
  const day = dateKey();
  return db.runTransaction(async (transaction) => {
    const command = commandRef(familyId, userId, payload.commandId);
    const daily = db.doc(`${root(familyId)}/daily/${day}/players/${userId}`);
    const profile = profileRef(familyId, userId);
    const [saved, dailySnapshot, profileSnapshot] = await Promise.all([transaction.get(command), transaction.get(daily), transaction.get(profile)]);
    if (previousResult(saved) !== undefined) return null;
    const raw = dailySnapshot.data();
    if (stringArray(raw?.claimedQuestIds).length) throw new HttpsError('failed-precondition', 'Нельзя менять набор после получения награды.');
    const rerollCount = numberValue(raw?.rerollCount);
    const tokens = numberValue(profileSnapshot.data()?.dailyRerollTokens);
    const cataloguePrice = rerollCount === 0 ? 0 : ECONOMY.dailyRerollCost;
    const useToken = cataloguePrice > 0 && tokens > 0;
    const price = useToken ? 0 : cataloguePrice;
    const coins = numberValue(profileSnapshot.data()?.coins);
    if (coins < price) throw new HttpsError('failed-precondition', `Для reroll нужно ${price} Coins.`);
    const next = rerollCount + 1;
    transaction.set(daily, { dateKey: day, questIds: dailyDefinitionIds(day, next), claimedQuestIds: [], rerollCount: next, chestClaimed: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(profile, { coins: coins - price, ...(useToken ? { dailyRerollTokens: tokens - 1 } : {}), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (price) transaction.set(ledgerRef(familyId, userId, `dailyReroll_${day}_${next}`), { userId, type: 'daily_reroll', amount: -price, referenceId: day, createdAt: FieldValue.serverTimestamp() });
    rememberCommand(transaction, command, payload.command);
    return null;
  });
}

async function purchaseSystemItem(payload: CommandPayload, userId: string) {
  const familyId = payload.familyId;
  const itemId = text(payload.itemId, 'itemId');
  const item = SYSTEM_SHOP.find((candidate) => candidate.id === itemId);
  if (!item) throw new HttpsError('not-found', 'Товар больше не продаётся.');
  return db.runTransaction(async (transaction) => {
    const command = commandRef(familyId, userId, payload.commandId);
    const profile = profileRef(familyId, userId);
    const cosmetic = ['avatar', 'frame', 'background', 'title', 'badge', 'effect'].includes(item.kind);
    const inventory = cosmetic ? inventoryRef(familyId, userId, item.id) : null;
    const [saved, profileSnapshot, inventorySnapshot] = await Promise.all([transaction.get(command), transaction.get(profile), inventory ? transaction.get(inventory) : Promise.resolve(null)]);
    const replay = previousResult(saved);
    if (replay !== undefined) return replay;
    if (!profileSnapshot.exists) throw new HttpsError('failed-precondition', 'Профиль ещё не готов.');
    const coins = numberValue(profileSnapshot.data()?.coins);
    if (coins < item.price) throw new HttpsError('failed-precondition', `Нужно ${item.price} Coins.`);
    const duplicate = Boolean(inventorySnapshot?.exists);
    const conversion = duplicate ? ECONOMY.duplicateConversionCoins : 0;
    const update: DocumentData = { coins: coins - item.price + conversion, shopPurchases: numberValue(profileSnapshot.data()?.shopPurchases) + 1, updatedAt: FieldValue.serverTimestamp() };
    if (item.kind === 'mystery_chest') update.mysteryChests = numberValue(profileSnapshot.data()?.mysteryChests) + 1;
    if (!duplicate && item.kind === 'streak_freeze') update.streakFreezes = numberValue(profileSnapshot.data()?.streakFreezes) + 1;
    if (!duplicate && item.kind === 'daily_reroll') update.dailyRerollTokens = numberValue(profileSnapshot.data()?.dailyRerollTokens) + 1;
    transaction.update(profile, update);
    if (inventory && !duplicate) transaction.create(inventory, { kind: item.kind, name: item.name, icon: item.icon, quantity: 1, value: item.value ?? null, permanent: !item.durationDays, sourceId: item.id, expiresAt: item.durationDays ? Timestamp.fromDate(new Date(Date.now() + item.durationDays * 86_400_000)) : null, createdAt: FieldValue.serverTimestamp() });
    transaction.set(ledgerRef(familyId, userId, `shop_${payload.commandId}`), { userId, type: 'shop_purchase', amount: -item.price, referenceId: payload.commandId, createdAt: FieldValue.serverTimestamp() });
    if (conversion) transaction.set(ledgerRef(familyId, userId, `duplicate_${payload.commandId}`), { userId, type: 'duplicate_conversion', amount: conversion, referenceId: payload.commandId, createdAt: FieldValue.serverTimestamp() });
    const result = duplicate ? `Дубликат ${item.name} превращён в ${conversion} Coins` : `${item.icon} ${item.name}`;
    rememberCommand(transaction, command, payload.command, result);
    return result;
  });
}

async function openMysteryChest(payload: CommandPayload, userId: string) {
  const familyId = payload.familyId;
  return db.runTransaction(async (transaction) => {
    const command = commandRef(familyId, userId, payload.commandId);
    const profile = profileRef(familyId, userId);
    const [saved, profileSnapshot] = await Promise.all([transaction.get(command), transaction.get(profile)]);
    const replay = previousResult(saved);
    if (replay !== undefined) return replay;
    const chests = numberValue(profileSnapshot.data()?.mysteryChests);
    if (chests <= 0) throw new HttpsError('failed-precondition', 'В инвентаре нет сундуков.');
    const opened = numberValue(profileSnapshot.data()?.openedChests);
    const seed = `${familyId}:${userId}:chest:${opened + 1}`;
    const reward = mysteryReward(seed);
    const cosmetic = ['avatar', 'frame', 'background', 'title', 'badge', 'effect'].includes(reward.kind);
    const inventory = cosmetic ? inventoryRef(familyId, userId, reward.id) : null;
    const inventorySnapshot = inventory ? await transaction.get(inventory) : null;
    const duplicate = Boolean(inventorySnapshot?.exists);
    const conversion = duplicate ? ECONOMY.duplicateConversionCoins : 0;
    const update: DocumentData = { mysteryChests: chests - 1, openedChests: opened + 1, coins: numberValue(profileSnapshot.data()?.coins) + conversion, updatedAt: FieldValue.serverTimestamp() };
    if (!duplicate && reward.kind === 'streak_freeze') update.streakFreezes = numberValue(profileSnapshot.data()?.streakFreezes) + 1;
    if (!duplicate && reward.kind === 'daily_reroll') update.dailyRerollTokens = numberValue(profileSnapshot.data()?.dailyRerollTokens) + 1;
    transaction.update(profile, update);
    if (inventory && !duplicate) transaction.create(inventory, { kind: reward.kind, name: reward.name, icon: reward.icon, quantity: 1, value: reward.value ?? null, permanent: !reward.durationDays, sourceId: 'mystery_chest', expiresAt: reward.durationDays ? Timestamp.fromDate(new Date(Date.now() + reward.durationDays * 86_400_000)) : null, createdAt: FieldValue.serverTimestamp() });
    if (conversion) transaction.set(ledgerRef(familyId, userId, `duplicate_chest_${opened + 1}`), { userId, type: 'duplicate_conversion', amount: conversion, referenceId: seed, createdAt: FieldValue.serverTimestamp() });
    transaction.set(db.doc(`${root(familyId)}/activity/chestOpened_${userId}_${opened + 1}`), { type: 'chest_opened', title: reward.name, userIds: [userId], rarity: reward.rarity, createdAt: FieldValue.serverTimestamp() });
    const result = duplicate ? `${reward.rarity.toUpperCase()}: дубликат ${reward.name} → ${conversion} Coins` : `${reward.rarity.toUpperCase()}: ${reward.icon} ${reward.name}`;
    rememberCommand(transaction, command, payload.command, result);
    return result;
  });
}

async function familyRewardCommand(payload: CommandPayload, userId: string) {
  const familyId = payload.familyId;
  if (payload.command === 'createFamilyReward') {
    const input = payload.reward ?? {};
    const title = text(input.title, 'title', 100);
    const price = Math.max(1, Math.floor(numberValue(input.price)));
    const reward = db.collection(`${root(familyId)}/familyRewards`).doc();
    await reward.create({ creatorId: userId, title, description: typeof input.description === 'string' ? input.description.trim().slice(0, 500) || null : null, price, quantity: typeof input.quantity === 'number' ? Math.max(0, Math.floor(input.quantity)) : null, cooldownHours: typeof input.cooldownHours === 'number' && input.cooldownHours > 0 ? input.cooldownHours : null, isActive: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return reward.id;
  }
  if (payload.command === 'purchaseFamilyReward') {
    const rewardId = text(payload.rewardId, 'rewardId');
    return db.runTransaction(async (transaction) => {
      const command = commandRef(familyId, userId, payload.commandId);
      const reward = db.doc(`${root(familyId)}/familyRewards/${rewardId}`);
      const profile = profileRef(familyId, userId);
      const inventory = inventoryRef(familyId, userId, `family_${rewardId}`);
      const purchase = db.doc(`${root(familyId)}/familyRewardPurchases/${userId}_${rewardId}`);
      const [saved, rewardSnapshot, profileSnapshot, inventorySnapshot, purchaseSnapshot] = await Promise.all([transaction.get(command), transaction.get(reward), transaction.get(profile), transaction.get(inventory), transaction.get(purchase)]);
      if (previousResult(saved) !== undefined) return null;
      if (!rewardSnapshot.exists || rewardSnapshot.data()?.isActive === false) throw new HttpsError('not-found', 'Награда недоступна.');
      const data = rewardSnapshot.data()!;
      const price = numberValue(data.price);
      const coins = numberValue(profileSnapshot.data()?.coins);
      if (coins < price) throw new HttpsError('failed-precondition', `Нужно ${price} Coins.`);
      if (typeof data.quantity === 'number' && data.quantity <= 0) throw new HttpsError('failed-precondition', 'Награды закончились.');
      const last = timestampDate(purchaseSnapshot.data()?.lastPurchasedAt)?.getTime() ?? 0;
      const cooldown = numberValue(data.cooldownHours) * 3_600_000;
      if (cooldown && Date.now() - last < cooldown) throw new HttpsError('failed-precondition', `Награду можно купить снова через ${Math.ceil((cooldown - (Date.now() - last)) / 3_600_000)} ч.`);
      transaction.update(profile, { coins: coins - price, shopPurchases: numberValue(profileSnapshot.data()?.shopPurchases) + 1, updatedAt: FieldValue.serverTimestamp() });
      if (typeof data.quantity === 'number') transaction.update(reward, { quantity: data.quantity - 1, updatedAt: FieldValue.serverTimestamp() });
      transaction.set(inventory, { kind: 'family_reward', name: String(data.title ?? 'Награда'), icon: '🎁', quantity: numberValue(inventorySnapshot.data()?.quantity) + 1, sourceId: rewardId, creatorId: data.creatorId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(purchase, { userId, rewardId, lastPurchasedAt: FieldValue.serverTimestamp() });
      transaction.set(ledgerRef(familyId, userId, `familyReward_${payload.commandId}`), { userId, type: 'shop_purchase', amount: -price, referenceId: rewardId, createdAt: FieldValue.serverTimestamp() });
      rememberCommand(transaction, command, payload.command);
      return null;
    });
  }
  if (payload.command === 'redeemInventoryItem') {
    const inventoryId = text(payload.inventoryId, 'inventoryId');
    return db.runTransaction(async (transaction) => {
      const command = commandRef(familyId, userId, payload.commandId);
      const inventory = inventoryRef(familyId, userId, inventoryId);
      const [saved, snapshot] = await Promise.all([transaction.get(command), transaction.get(inventory)]);
      if (previousResult(saved) !== undefined) return null;
      if (!snapshot.exists || numberValue(snapshot.data()?.quantity) <= 0) throw new HttpsError('failed-precondition', 'Предмет закончился.');
      if (snapshot.data()?.kind !== 'family_reward') throw new HttpsError('failed-precondition', 'Этот предмет экипируется в профиле.');
      transaction.update(inventory, { quantity: numberValue(snapshot.data()?.quantity) - 1, updatedAt: FieldValue.serverTimestamp() });
      const request = db.collection(`${root(familyId)}/rewardRequests`).doc();
      transaction.create(request, { inventoryId, rewardId: snapshot.data()?.sourceId ?? null, requesterId: userId, creatorId: snapshot.data()?.creatorId ?? null, title: snapshot.data()?.name ?? 'Семейная награда', status: 'pending', createdAt: FieldValue.serverTimestamp() });
      rememberCommand(transaction, command, payload.command);
      return null;
    });
  }
  if (payload.command === 'resolveRewardRequest') {
    const requestId = text(payload.requestId, 'requestId');
    const decision = payload.decision;
    if (decision !== 'approved' && decision !== 'rejected') throw new HttpsError('invalid-argument', 'Некорректное решение.');
    return db.runTransaction(async (transaction) => {
      const command = commandRef(familyId, userId, payload.commandId);
      const request = db.doc(`${root(familyId)}/rewardRequests/${requestId}`);
      const [saved, snapshot] = await Promise.all([transaction.get(command), transaction.get(request)]);
      if (previousResult(saved) !== undefined) return null;
      if (!snapshot.exists || snapshot.data()?.status !== 'pending') throw new HttpsError('failed-precondition', 'Запрос уже обработан.');
      const data = snapshot.data()!;
      if (data.creatorId !== userId) throw new HttpsError('permission-denied', 'Подтвердить награду может только её создатель.');
      if (decision === 'rejected') {
        const inventory = inventoryRef(familyId, String(data.requesterId ?? ''), String(data.inventoryId ?? ''));
        const item = await transaction.get(inventory);
        transaction.set(inventory, { quantity: numberValue(item.data()?.quantity) + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      transaction.update(request, { status: decision, resolvedAt: FieldValue.serverTimestamp(), resolvedById: userId });
      rememberCommand(transaction, command, payload.command);
      return null;
    });
  }
  throw new HttpsError('invalid-argument', 'Неизвестная команда награды.');
}

async function equipProfileItem(payload: CommandPayload, userId: string) {
  const familyId = payload.familyId;
  const inventoryId = text(payload.inventoryId, 'inventoryId');
  return db.runTransaction(async (transaction) => {
    const command = commandRef(familyId, userId, payload.commandId);
    const inventory = inventoryRef(familyId, userId, inventoryId);
    const [saved, snapshot] = await Promise.all([transaction.get(command), transaction.get(inventory)]);
    if (previousResult(saved) !== undefined) return null;
    if (!snapshot.exists) throw new HttpsError('not-found', 'Предмет не найден в инвентаре.');
    const data = snapshot.data()!;
    const expires = timestampDate(data.expiresAt);
    if (expires && expires.getTime() <= Date.now()) throw new HttpsError('failed-precondition', 'Срок действия предмета закончился.');
    const fields: Record<string, string> = { avatar: 'avatarOverride', frame: 'activeFrame', background: 'activeBackground', title: 'activeTitle', effect: 'activeEffect' };
    const field = fields[String(data.kind ?? '')];
    if (!field) throw new HttpsError('failed-precondition', 'Этот предмет нельзя экипировать.');
    transaction.update(profileRef(familyId, userId), { [field]: data.value ?? data.name, updatedAt: FieldValue.serverTimestamp() });
    rememberCommand(transaction, command, payload.command);
    return null;
  });
}

export const tasksCommand = onCall({ region: REGION, cors: true, enforceAppCheck: false }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Войдите в аккаунт.');
  const payload = request.data as Partial<CommandPayload>;
  const familyId = text(payload.familyId, 'familyId');
  const commandId = text(payload.commandId, 'commandId', 100);
  const command = payload.command;
  if (!command) throw new HttpsError('invalid-argument', 'Команда не указана.');
  const normalized = { ...payload, familyId, commandId, command } as CommandPayload;
  await assertEditor(familyId, request.auth.uid);
  if (command === 'transitionTask') return { result: await transitionTask(normalized, request.auth.uid) };
  if (command === 'agreeDifficulty') return { result: await agreeDifficulty(normalized, request.auth.uid) };
  if (command === 'deleteTask') return { result: await deleteTask(normalized, request.auth.uid) };
  if (command === 'claimDaily') return { result: await claimDaily(normalized, request.auth.uid) };
  if (command === 'rerollDaily') return { result: await rerollDaily(normalized, request.auth.uid) };
  if (command === 'purchaseSystemItem') return { result: await purchaseSystemItem(normalized, request.auth.uid) };
  if (command === 'openMysteryChest') return { result: await openMysteryChest(normalized, request.auth.uid) };
  if (command === 'createFamilyReward' || command === 'purchaseFamilyReward' || command === 'resolveRewardRequest' || command === 'redeemInventoryItem') return { result: await familyRewardCommand(normalized, request.auth.uid) };
  if (command === 'equipProfileItem') return { result: await equipProfileItem(normalized, request.auth.uid) };
  throw new HttpsError('invalid-argument', 'Неизвестная команда.');
});

export { shoppingImport, shoppingResolveImport, parseRecipeUrl } from './recipes-shopping.js';
