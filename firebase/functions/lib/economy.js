"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAILY_DEFINITIONS = exports.SYSTEM_SHOP = exports.ECONOMY = void 0;
exports.numberValue = numberValue;
exports.stringArray = stringArray;
exports.dateKey = dateKey;
exports.deadlinePenalty = deadlinePenalty;
exports.xpRequiredForLevel = xpRequiredForLevel;
exports.levelFromTotalXp = levelFromTotalXp;
exports.mysteryReward = mysteryReward;
exports.dailyDefinitionIds = dailyDefinitionIds;
exports.dailyProgress = dailyProgress;
exports.ECONOMY = {
    reviewerReward: 1,
    dailyRerollCost: 5,
    dailyChestCoins: 8,
    duplicateConversionCoins: 50,
    difficulty: {
        easy: { xp: 10, coins: 2, bossDamage: 10 },
        normal: { xp: 25, coins: 5, bossDamage: 20 },
        hard: { xp: 50, coins: 10, bossDamage: 30 },
        epic: { xp: 100, coins: 20, bossDamage: 50 },
    },
    deadlinePenalties: { oneToTwoDays: 1, threeToFiveDays: 2, sixPlusDays: 3 },
};
exports.SYSTEM_SHOP = [
    { id: 'freeze', kind: 'streak_freeze', name: 'Streak Freeze', icon: '🧊', price: 80, rarity: 'common' },
    { id: 'reroll', kind: 'daily_reroll', name: 'Daily Reroll', icon: '🎲', price: 45, rarity: 'common' },
    { id: 'avatar_dragon', kind: 'avatar', name: 'Дракончик', icon: '🐲', price: 140, rarity: 'rare', value: '🐲' },
    { id: 'frame_fire', kind: 'frame', name: 'Огненная рамка', icon: '🔥', price: 240, rarity: 'epic', value: 'fire' },
    { id: 'frame_frost', kind: 'frame', name: 'Ледяная рамка', icon: '❄️', price: 240, rarity: 'epic', value: 'frost' },
    { id: 'background_tavern', kind: 'background', name: 'Зал трофеев', icon: '🏰', price: 260, rarity: 'epic', value: 'tavern' },
    { id: 'title_keeper', kind: 'title', name: 'Хранитель очага', icon: '🏷️', price: 180, rarity: 'rare', value: 'Хранитель очага' },
    { id: 'badge_seasonal', kind: 'badge', name: 'Знак сезона', icon: '🔰', price: 300, rarity: 'legendary', value: 'seasonal', durationDays: 30 },
    { id: 'effect_sparks', kind: 'effect', name: 'Искры героя', icon: '✨', price: 320, rarity: 'legendary', value: 'sparks' },
    { id: 'mystery', kind: 'mystery_chest', name: 'Таинственный сундук', icon: '🎁', price: 180, rarity: 'epic' },
];
function numberValue(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function stringArray(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}
function dateKey(value = new Date()) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function deadlinePenalty(dueDate, completedAt = new Date()) {
    if (!dueDate)
        return 0;
    const due = typeof dueDate === 'object' && dueDate !== null && 'toDate' in dueDate
        ? dueDate.toDate()
        : new Date(String(dueDate));
    if (Number.isNaN(due.getTime()))
        return 0;
    const start = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const days = Math.floor((start(completedAt) - start(due)) / 86_400_000);
    if (days <= 0)
        return 0;
    if (days <= 2)
        return exports.ECONOMY.deadlinePenalties.oneToTwoDays;
    if (days <= 5)
        return exports.ECONOMY.deadlinePenalties.threeToFiveDays;
    return exports.ECONOMY.deadlinePenalties.sixPlusDays;
}
function xpRequiredForLevel(level) {
    if (level <= 1)
        return 100;
    const earlyCurve = 100 * 1.5 ** Math.min(level - 1, 6);
    const lateLevels = Math.max(0, level - 7);
    return Math.round(earlyCurve + lateLevels * 180 + lateLevels ** 1.35 * 28);
}
function levelFromTotalXp(totalXp) {
    let level = 1;
    let remainder = Math.max(0, totalXp);
    while (remainder >= xpRequiredForLevel(level) && level < 10_000) {
        remainder -= xpRequiredForLevel(level);
        level += 1;
    }
    return level;
}
function hash(seed) {
    let value = 2_166_136_261;
    for (const character of seed)
        value = Math.imul(value ^ character.charCodeAt(0), 16_777_619);
    return value >>> 0;
}
function mysteryReward(seed) {
    const roll = hash(seed) % 100;
    const rarity = roll < 70 ? 'common' : roll < 92 ? 'rare' : roll < 99 ? 'epic' : 'legendary';
    const candidates = exports.SYSTEM_SHOP.filter((item) => item.kind !== 'mystery_chest' && item.rarity === rarity);
    return candidates[hash(`${seed}:reward`) % candidates.length];
}
exports.DAILY_DEFINITIONS = [
    { id: 'complete_one', target: 1, rewardCoins: 3 },
    { id: 'earn_xp', target: 50, rewardCoins: 5 },
    { id: 'on_time', target: 1, rewardCoins: 5 },
    { id: 'review_one', target: 1, rewardCoins: 3 },
    { id: 'hard_one', target: 1, rewardCoins: 6 },
    { id: 'complete_two', target: 2, rewardCoins: 5 },
];
function dailyDefinitionIds(day, rerollCount) {
    if (rerollCount === 0)
        return exports.DAILY_DEFINITIONS.slice(0, 3).map(({ id }) => id);
    const seed = [...day].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const start = (seed + rerollCount) % exports.DAILY_DEFINITIONS.length;
    return [0, 1, 2].map((offset) => exports.DAILY_DEFINITIONS[(start + offset) % exports.DAILY_DEFINITIONS.length].id);
}
function dailyProgress(questId, tasks, userId, day) {
    const completed = tasks.filter((task) => {
        const completedAt = task.completedAt && typeof task.completedAt === 'object' && 'toDate' in task.completedAt
            ? task.completedAt.toDate()
            : task.completedAt ? new Date(String(task.completedAt)) : null;
        return stringArray(task.assigneeIds).includes(userId) && completedAt && dateKey(completedAt) === day;
    });
    if (questId === 'complete_one' || questId === 'complete_two')
        return completed.length;
    if (questId === 'earn_xp')
        return completed.reduce((sum, task) => {
            const taskDifficulty = typeof task.difficulty === 'string' && task.difficulty in exports.ECONOMY.difficulty
                ? task.difficulty
                : 'normal';
            return sum + exports.ECONOMY.difficulty[taskDifficulty].xp;
        }, 0);
    if (questId === 'hard_one')
        return completed.filter((task) => task.difficulty === 'hard' || task.difficulty === 'epic').length;
    if (questId === 'on_time')
        return completed.filter((task) => deadlinePenalty(task.dueDate, task.completedAt && typeof task.completedAt === 'object' && 'toDate' in task.completedAt ? task.completedAt.toDate() : new Date(String(task.completedAt))) === 0).length;
    if (questId === 'review_one')
        return tasks.filter((task) => {
            const completedAt = task.completedAt && typeof task.completedAt === 'object' && 'toDate' in task.completedAt
                ? task.completedAt.toDate()
                : task.completedAt ? new Date(String(task.completedAt)) : null;
            return task.reviewerId === userId && completedAt && dateKey(completedAt) === day;
        }).length;
    return 0;
}
//# sourceMappingURL=economy.js.map