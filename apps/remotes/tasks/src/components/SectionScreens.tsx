import { useState, type FormEvent } from 'react';
import { FadeIn } from '@chrisasstanina/ui';
import { achievementProgress } from '../domain/achievements';
import { SYSTEM_SHOP } from '../domain/shop';
import { GAME_CONFIG } from '../domain/game-config';
import { bossDamageForMember, earnedAchievementCount, onTimeTaskCount, settledTasks } from '../domain/stats';
import { deadlineState, STATUS_META, TASK_STATUSES, type FamilyTask } from '../domain/task';
import { useTasksStore, type AppSection } from '../stores/tasks-store';
import { Icon } from './Icon';

export function SectionScreen({ section }: { section: Exclude<AppSection, 'board'> }) {
  const setActiveSection = useTasksStore((state) => state.setActiveSection);
  const titles: Record<typeof section, [string, string]> = {
    history: ['История спринтов', 'Летопись семейных побед и незакрытых дел.'], achievements: ['Достижения', 'Ранги, streak-рекорды и секретные подвиги.'],
    shop: ['Лавка чудес', 'Семейные награды, магические редкости и инвентарь.'], bestiary: ['Бестиарий', 'Все встреченные вами твари домашнего хаоса.'],
    profile: ['Профиль игрока', 'Ваш путь, косметика и семейный рейтинг.'],
  };
  return <FadeIn key={`section-${section}`} className="section-screen"><header className="section-heading"><button type="button" onClick={() => setActiveSection('board')}>← К доске</button><span>СЕМЕЙНАЯ ТАВЕРНА</span><h1>{titles[section][0]}</h1><p>{titles[section][1]}</p></header>
    {section === 'history' && <History />}{section === 'achievements' && <Achievements />}{section === 'shop' && <Shop />}{section === 'bestiary' && <Bestiary />}{section === 'profile' && <Profile />}
  </FadeIn>;
}

function History() {
  const tasks = useTasksStore((state) => state.tasks); const sprintNumber = useTasksStore((state) => state.sprintNumber);
  const sprintEndsAt = useTasksStore((state) => state.sprintEndsAt); const activeSprintId = useTasksStore((state) => state.activeSprintId);
  const history = useTasksStore((state) => state.sprintHistory); const members = useTasksStore((state) => state.members);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());
  const sprintTasks = tasks.filter((task) => task.sprintId === activeSprintId || task.sprintId === 'current');
  const completed = sprintTasks.filter((task) => task.status === 'done').length;
  const progress = sprintTasks.length > 0 ? Math.round(completed / sprintTasks.length * 100) : 0;
  const endDate = sprintEndsAt ? new Date(sprintEndsAt) : null; const daysLeft = endDate ? Math.max(0, Math.ceil((endDate.getTime() - openedAt) / 86_400_000)) : 0;
  const selected = history.find((sprint) => sprint.id === selectedId);
  if (selected) return <SprintArchive sprint={selected} members={members} onBack={() => setSelectedId(null)} />;
  return <div className="sprint-history"><article className="featured-sprint"><div><small>ТЕКУЩИЙ</small><h2>Спринт #{sprintNumber}</h2><p>{endDate ? `До ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(endDate)}` : 'Дата не задана'}</p></div><span><b>{daysLeft}</b> дней</span><i><b style={{ width: `${progress}%` }} /></i><strong>{completed} / {sprintTasks.length} задач</strong></article>
    {history.map((sprint) => { const champion = members.find((member) => member.id === sprint.championId); return <article key={sprint.id}><span>{sprint.bossDefeated ? '🏆' : '🛡'}</span><div><small>ЗАВЕРШЁН</small><h2>Спринт #{sprint.number}</h2><p>{sprint.completedTasks}/{sprint.totalTasks} задач · вовремя {sprint.onTimeRate}% · перенесено {sprint.rolledOverTasks}</p></div><strong>{sprint.bossDefeated ? `${sprint.boss?.icon ?? '👹'} Босс побеждён` : 'Босс устоял'}{champion && <small>👑 {champion.name}</small>}<button type="button" onClick={() => setSelectedId(sprint.id)}>Открыть</button></strong></article>; })}
    {history.length === 0 && <p className="section-empty-note">Завершённых спринтов пока нет.</p>}</div>;
}

function SprintArchive({ sprint, members, onBack }: { sprint: ReturnType<typeof useTasksStore.getState>['sprintHistory'][number]; members: ReturnType<typeof useTasksStore.getState>['members']; onBack: () => void }) {
  const tasks = sprint.tasks ?? [];
  const champion = members.find((member) => member.id === sprint.championId);
  return <div className="sprint-archive">
    <button type="button" className="archive-back" onClick={onBack}>← Ко всем спринтам</button>
    <section className="sprint-result-card"><div><small>SPRINT #{sprint.number} COMPLETE</small><h2>{sprint.bossDefeated ? 'Победа семьи' : 'Босс устоял'}</h2><p>{sprint.completedTasks} из {sprint.totalTasks} задач · {sprint.onTimeRate}% вовремя · {sprint.rolledOverTasks} перенесено</p></div><div><span>{sprint.boss?.icon ?? '👹'}</span><strong>{sprint.boss?.name ?? 'Неизвестный босс'}</strong><small>{sprint.bossDefeated ? 'ПОБЕЖДЁН' : 'НЕ ПОБЕЖДЁН'}</small></div></section>
    <section className="archive-leaderboard"><h3>Итоги участников</h3>{(sprint.results ?? []).map((result, index) => <article key={result.userId}><b>{index + 1}</b><span>{members.find((member) => member.id === result.userId)?.name ?? 'Участник'}</span><em>{result.xp} XP · {result.completedTasks} задач · {result.bossDamage} DMG</em>{result.userId === sprint.championId && <strong title="Чемпион спринта">👑 {champion?.name ?? 'Чемпион'}</strong>}</article>)}</section>
    <div className="archive-kanban" aria-label={`Архивная доска спринта ${sprint.number}`}>{TASK_STATUSES.map((status) => <section key={status}><header><span>{STATUS_META[status].icon}</span><b>{STATUS_META[status].label}</b><em>{tasks.filter((task) => task.status === status).length}</em></header><div>{tasks.filter((task) => task.status === status).map((task) => <ArchiveTask key={task.id} task={task} members={members} />)}</div></section>)}</div>
  </div>;
}

function ArchiveTask({ task, members }: { task: FamilyTask; members: ReturnType<typeof useTasksStore.getState>['members'] }) {
  const reward = GAME_CONFIG.difficulty[task.difficulty];
  const due = deadlineState(task);
  return <article className={`archive-task difficulty-${task.difficulty}`}><small>{reward.stars} {reward.shortLabel}</small><h4>{task.title}</h4><p>{task.assigneeIds.map((id) => members.find((member) => member.id === id)?.name ?? 'Участник').join(', ') || 'Свободная задача'}</p><div><span>+{reward.xp} XP</span><span>{reward.bossDamage} DMG</span>{due.label && <span>{due.label}</span>}</div></article>;
}

function Achievements() {
  const tasks = useTasksStore((state) => state.tasks); const profiles = useTasksStore((state) => state.profiles);
  const player = useTasksStore((state) => state.player); const history = useTasksStore((state) => state.sprintHistory);
  const currentUserId = useTasksStore((state) => state.currentUserId);
  const profile = profiles.find((item) => item.userId === currentUserId) ?? { userId: currentUserId, displayName: 'Игрок', ...player };
  const progress = achievementProgress({ tasks, profile, history, userId: currentUserId });
  return <div className="achievement-grid expanded">{progress.map(({ definition, value, unlocked }) => { const hidden = definition.secret && !unlocked; return <article key={definition.id} className={`achievement-card ${definition.rarity} ${unlocked ? 'unlocked' : ''}`}><span>{hidden ? '?' : definition.icon}</span><div><small>{definition.rank ? `${definition.rank} · ` : ''}{definition.rarity}</small><h2>{hidden ? '????' : definition.name}</h2><p>{hidden ? 'Секретное достижение' : definition.description}</p>{!hidden && <><i><b style={{ width: `${Math.min(100, value / definition.target * 100)}%` }} /></i><em>{Math.min(value, definition.target)} / {definition.target} · +{definition.rewardCoins} ◈</em></>}</div></article>; })}</div>;
}

function Shop() {
  const [tab, setTab] = useState<'family' | 'system' | 'inventory'>('family'); const [creating, setCreating] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const player = useTasksStore((state) => state.player); const rewards = useTasksStore((state) => state.familyRewards); const inventory = useTasksStore((state) => state.inventory); const rewardRequests = useTasksStore((state) => state.rewardRequests); const members = useTasksStore((state) => state.members);
  const pending = useTasksStore((state) => state.shopPending); const canEdit = useTasksStore((state) => state.canEdit);
  const buySystemItem = useTasksStore((state) => state.buySystemItem); const buyFamilyReward = useTasksStore((state) => state.buyFamilyReward);
  const createFamilyReward = useTasksStore((state) => state.createFamilyReward); const redeemInventoryItem = useTasksStore((state) => state.redeemInventoryItem); const equipProfileItem = useTasksStore((state) => state.equipProfileItem); const openChest = useTasksStore((state) => state.openChest);
  const resolveRewardRequest = useTasksStore((state) => state.resolveRewardRequest);
  async function submitReward(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); await createFamilyReward({ title: String(data.get('title') ?? ''), description: String(data.get('description') ?? ''), price: Number(data.get('price') ?? 1), quantity: Number(data.get('quantity') ?? 0) || undefined, cooldownHours: Number(data.get('cooldownHours') ?? 0) || undefined }); setCreating(false); }
  return <><div className="shop-wallet"><Icon name="coins" size={22} /><span>Ваш кошелёк</span><strong>{player.coins} ◈</strong></div><div className="section-tabs" role="tablist"><button type="button" className={tab === 'family' ? 'active' : ''} onClick={() => setTab('family')}>🎁 Семейные награды</button><button type="button" className={tab === 'system' ? 'active' : ''} onClick={() => setTab('system')}>🧙 Магическая лавка</button><button type="button" className={tab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')}>🎒 Инвентарь</button></div>
    {tab === 'family' && <><button className="create-reward-button" type="button" disabled={!canEdit} onClick={() => setCreating((value) => !value)}>+ Создать семейную награду</button>{creating && <form className="reward-form" onSubmit={submitReward}><input name="title" required maxLength={80} placeholder="Например, выбрать фильм" /><input name="description" placeholder="Описание" /><input name="price" required type="number" min="1" max="10000" placeholder="Цена" /><input name="quantity" type="number" min="1" placeholder="Количество (необязательно)" /><input name="cooldownHours" type="number" min="1" placeholder="Cooldown, часов" /><button disabled={pending}>Добавить</button></form>}{rewardRequests.length > 0 && <section className="reward-requests"><h2>Запросы на использование</h2>{rewardRequests.map((request) => <article key={request.id}><div><strong>{members.find((member) => member.id === request.requesterId)?.name ?? 'Участник'}</strong><span>хочет использовать «{request.title}»</span></div><button type="button" disabled={pending} onClick={() => void resolveRewardRequest(request.id, 'approved')}>Подтвердить</button><button type="button" disabled={pending} className="secondary" onClick={() => void resolveRewardRequest(request.id, 'rejected')}>Отклонить</button></article>)}</section>}<div className="shop-grid">{rewards.map((item) => <article key={item.id}><span>🎁</span><small>СЕМЕЙНАЯ НАГРАДА</small><h2>{item.title}</h2><p>{item.description}</p><em>{item.quantity == null ? 'Без ограничений' : `Осталось: ${item.quantity}`}{item.cooldownHours ? ` · раз в ${item.cooldownHours} ч.` : ''}</em><button type="button" disabled={pending || player.coins < item.price || item.quantity === 0} onClick={() => void buyFamilyReward(item.id)}>{item.price} ◈</button></article>)}</div>{rewards.length === 0 && <p className="section-empty-note">Создайте первую семейную награду.</p>}</>}
    {tab === 'system' && <div className="shop-grid">{SYSTEM_SHOP.map((item) => <article key={item.id} className={item.rarity}><span>{item.icon}</span><small>{item.rarity.toUpperCase()}</small><h2>{item.name}</h2><p>{item.description}</p><button type="button" disabled={pending || player.coins < item.price} onClick={() => void buySystemItem(item.id)}>{item.price} ◈</button></article>)}</div>}
    {tab === 'inventory' && <div className="inventory-grid"><article><span>🧊</span><b>Streak Freeze</b><em>×{player.streakFreezes}</em></article><article><span>🎲</span><b>Daily Reroll</b><em>×{player.dailyRerollTokens}</em></article><article className={player.mysteryChests > 0 ? 'chest-ready' : ''}><span>🎁</span><b>Mystery Chest</b><em>×{player.mysteryChests}</em>{player.mysteryChests > 0 && <button type="button" disabled={pending} onClick={() => void openChest()}>Открыть</button>}</article>{inventory.filter((item) => item.quantity > 0).map((item) => { const days = item.expiresAt ? Math.max(0, Math.ceil((new Date(item.expiresAt).getTime() - openedAt) / 86_400_000)) : null; return <article key={item.id} className={days === 0 ? 'expired' : ''}><span>{item.icon}</span><b>{item.name}</b><em>{item.permanent ? 'Навсегда' : days != null ? `Осталось ${days} дн.` : `×${item.quantity}`}</em>{item.kind !== 'badge' && days !== 0 && <button type="button" disabled={pending} onClick={() => void (item.kind === 'family_reward' ? redeemInventoryItem(item.id) : equipProfileItem(item.id))}>{item.kind === 'family_reward' ? 'Использовать' : 'Экипировать'}</button>}</article>; })}</div>}</>;
}

function Bestiary() {
  const bossName = useTasksStore((state) => state.bossName); const bossHp = useTasksStore((state) => state.bossHp); const bossMaxHp = useTasksStore((state) => state.bossMaxHp);
  const bossIcon = useTasksStore((state) => state.bossIcon); const bossDescription = useTasksStore((state) => state.bossDescription); const bossQuote = useTasksStore((state) => state.bossQuote); const history = useTasksStore((state) => state.sprintHistory);
  const tasks = useTasksStore((state) => state.tasks); const activeSprintId = useTasksStore((state) => state.activeSprintId); const sprintNumber = useTasksStore((state) => state.sprintNumber); const bossFinalHitUserId = useTasksStore((state) => state.bossFinalHitUserId);
  const currentUserId = useTasksStore((state) => state.currentUserId); const members = useTasksStore((state) => state.members); const [selectedId, setSelectedId] = useState<string | null>(null);
  const defeatedCount = history.filter((sprint) => sprint.bossDefeated).length;
  const selectedHistory = history.find((sprint) => sprint.id === selectedId);
  const currentTasks = tasks.filter((task) => task.sprintId === activeSprintId || task.sprintId === 'current');
  const currentResults = members.map((member) => ({ userId: member.id, bossDamage: Math.round(bossDamageForMember(currentTasks, member.id)) })).filter((result) => result.bossDamage > 0).sort((left, right) => right.bossDamage - left.bossDamage);
  const selectedResults = selectedId === 'current' ? currentResults : selectedHistory?.results ?? [];
  const selectedBoss = selectedId === 'current'
    ? { name: bossName, icon: bossIcon, description: bossDescription, quote: bossQuote, maxHp: bossMaxHp, finalHitUserId: bossFinalHitUserId }
    : selectedHistory?.boss;
  const selectedNumber = selectedId === 'current' ? sprintNumber : selectedHistory?.number;
  const selectedWon = selectedId === 'current' ? bossHp === 0 : selectedHistory?.bossDefeated === true;
  const selectedTotalDamage = selectedId === 'current' ? Math.max(0, bossMaxHp - bossHp) : selectedResults.reduce((sum, result) => sum + result.bossDamage, 0);
  const selectedPersonalDamage = selectedResults.find((result) => result.userId === currentUserId)?.bossDamage ?? 0;
  const topHunter = members.find((member) => member.id === [...selectedResults].sort((left, right) => right.bossDamage - left.bossDamage)[0]?.userId);
  const finalHunter = members.find((member) => member.id === selectedBoss?.finalHitUserId);
  return <div className="bestiary-wrap"><p className="bestiary-count">Побеждено: <b>{defeatedCount}</b></p>{selectedBoss && <section className="bestiary-detail"><button type="button" aria-label="Закрыть подробности" onClick={() => setSelectedId(null)}>×</button><div className="bestiary-detail-art">{selectedBoss.icon}</div><div><small>СПРИНТ #{selectedNumber} · {selectedWon ? 'ПОБЕЖДЁН' : selectedId === 'current' ? 'В БОЮ' : 'УСТОЯЛ'}</small><h2>{selectedBoss.name}</h2><p>{selectedBoss.description}</p><blockquote>«{selectedBoss.quote}»</blockquote><div className="bestiary-facts"><span><small>Личный урон</small><b>{selectedPersonalDamage} DMG</b></span><span><small>Общий урон</small><b>{selectedTotalDamage} DMG</b></span><span><small>Top Damage</small><b>{topHunter?.name ?? '—'}</b></span><span><small>Final Hit</small><b>{finalHunter?.name ?? '—'}</b></span><span><small>Награды</small><b>{selectedWon ? `+${GAME_CONFIG.bossVictoryCoins} ◈ · Boss Chest` : '—'}</b></span></div></div></section>}<div className="bestiary-grid"><article className={bossHp === 0 ? 'won' : 'active'}><span>{bossIcon}</span><div><small>{bossHp === 0 ? 'ПОБЕЖДЁН' : 'В БОЮ'}</small><h2>{bossName}</h2><p>{bossDescription}</p><em>{bossHp} / {bossMaxHp} HP · текущий босс</em><button type="button" onClick={() => setSelectedId('current')}>Подробнее</button></div></article>{history.filter((sprint) => sprint.boss).map((sprint) => <article key={sprint.id} className={sprint.bossDefeated ? 'won' : 'lost'}><span>{sprint.boss!.icon}</span><div><small>{sprint.bossDefeated ? 'ПОБЕЖДЁН' : 'УСТОЯЛ'}</small><h2>{sprint.boss!.name}</h2><p>{sprint.boss!.description}</p><em>Спринт #{sprint.number} · {sprint.boss!.maxHp} HP</em><button type="button" onClick={() => setSelectedId(sprint.id)}>Подробнее</button></div></article>)}</div></div>;
}

function Profile() {
  const [period, setPeriod] = useState<'sprint' | 'month' | 'all'>('all'); const tasks = useTasksStore((state) => state.tasks); const members = useTasksStore((state) => state.members);
  const [openedAt] = useState(() => Date.now());
  const profiles = useTasksStore((state) => state.profiles); const currentUserId = useTasksStore((state) => state.currentUserId); const player = useTasksStore((state) => state.player); const inventory = useTasksStore((state) => state.inventory); const coinTransactions = useTasksStore((state) => state.coinTransactions);
  const history = useTasksStore((state) => state.sprintHistory); const activeSprintId = useTasksStore((state) => state.activeSprintId); const currentMember = members.find((member) => member.id === currentUserId) ?? members[0];
  const completed = settledTasks(tasks).filter((task) => task.assigneeIds.includes(currentUserId)).length; const onTime = onTimeTaskCount(tasks.filter((task) => task.assigneeIds.includes(currentUserId)));
  const awards = earnedAchievementCount(tasks, player.streaks.task.count, player.achievementIds.length); const reviews = tasks.filter((task) => task.reviewerId === currentUserId && task.rewardSettledAt).length;
  const sprintWins = history.filter((sprint) => sprint.championId === currentUserId).length; const bossKills = history.filter((sprint) => sprint.bossDefeated && sprint.participantIds?.includes(currentUserId)).length;
  const progress = player.xpToNext > 0 ? player.xp / player.xpToNext * 100 : 0; const title = player.activeTitle || (onTime >= 25 ? 'Повелитель дедлайнов' : 'Новый искатель');
  const periodTasks = tasks.filter((task) => { if (!task.rewardSettledAt) return false; if (period === 'sprint') return task.sprintId === activeSprintId || task.sprintId === 'current'; if (period === 'month') return task.completedAt && new Date(task.completedAt).getMonth() === new Date().getMonth(); return true; });
  const leaderboard = profiles.map((profile) => { const memberTasks = period === 'all' ? [] : periodTasks.filter((task) => task.assigneeIds.includes(profile.userId)); return { profile, score: period === 'all' ? profile.totalXp : memberTasks.reduce((sum, task) => sum + ({ easy: 10, normal: 25, hard: 50, epic: 100 }[task.difficulty]), 0), tasks: period === 'all' ? 0 : memberTasks.length }; }).sort((left, right) => right.score - left.score);
  const badges = inventory.filter((item) => item.kind === 'badge' && item.quantity > 0 && (!item.expiresAt || new Date(item.expiresAt).getTime() > openedAt));
  const bestStreak = Math.max(...Object.values(player.streaks).map((streak) => streak.count));
  return <><div className={`profile-panel effect-${player.activeEffect ?? 'none'} background-${player.activeBackground ?? 'none'}`}><div className="profile-hero"><div className={`profile-avatar frame-${player.activeFrame ?? 'none'}`} style={{ background: currentMember?.color }}><span>{player.avatarOverride || currentMember?.initials || '•'}</span></div><small>✦ {title.toLocaleUpperCase('ru-RU')}</small><h2>{(currentMember?.name ?? 'Игрок').toLocaleUpperCase('ru-RU')}</h2><b>LEVEL {player.level}</b><i><span style={{ width: `${progress}%` }} /></i><p>{player.xp} / {player.xpToNext} XP</p>{badges.length > 0 && <div className="profile-badges" aria-label="Значки профиля">{badges.map((badge) => <span key={badge.id} title={badge.name}>{badge.icon}</span>)}</div>}<div><span>🔥 <b>{player.streaks.task.count}</b><small>TASK STREAK</small></span><span>◈ <b>{player.coins}</b><small>COINS</small></span><span>🏆 <b>{awards}</b><small>НАГРАДЫ</small></span></div></div><div className="profile-stats"><h3>Статистика таверны</h3><div><span><small>Задач выполнено</small><b>{completed}</b></span><span><small>Вовремя</small><b>{completed ? Math.round(onTime / completed * 100) : 0}%</b></span><span><small>Boss Damage</small><b>{Math.round(bossDamageForMember(tasks, currentUserId))}</b></span><span><small>Boss Kills</small><b>{bossKills}</b></span><span><small>Лучший Streak</small><b>{bestStreak}</b></span><span><small>Reviews</small><b>{reviews}</b></span><span><small>Sprint Wins</small><b>{sprintWins}</b></span></div></div></div>
    <section className="leaderboard"><header><div><small>СЕМЕЙНЫЙ РЕЙТИНГ</small><h2>Leaderboard</h2></div><div className="section-tabs"><button className={period === 'sprint' ? 'active' : ''} onClick={() => setPeriod('sprint')}>Спринт</button><button className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>Месяц</button><button className={period === 'all' ? 'active' : ''} onClick={() => setPeriod('all')}>Всё время</button></div></header>{leaderboard.map(({ profile, score, tasks: count }, index) => { const member = members.find((item) => item.id === profile.userId); return <article key={profile.userId} className={profile.userId === currentUserId ? 'me' : ''}><b>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}</b><span className={`avatar frame-${profile.activeFrame ?? 'none'}`} style={{ background: member?.color }}>{profile.avatarOverride || member?.initials || '•'}</span><div><strong>{member?.name ?? profile.displayName}</strong><small>{score} XP{period !== 'all' ? ` · ${count} задач` : ''}</small></div><em>◈ {profile.coins}</em>{history[0]?.championId === profile.userId && <i title="Чемпион спринта">👑</i>}</article>; })}</section>
    <CoinLedger transactions={coinTransactions} /></>;
}

const ledgerLabels: Record<string, string> = {
  task_reward: 'Награда за задачу', task_bonus: 'Бонус автора', reviewer_reward: 'Награда за проверку',
  daily_reward: 'Daily-награда', boss_reward: 'Победа над боссом', level_reward: 'Награда за уровень',
  achievement_reward: 'Достижение', shop_purchase: 'Покупка в лавке', rollover_penalty: 'Перенос задачи',
  deadline_penalty: 'Просрочка дедлайна', duplicate_conversion: 'Компенсация за дубликат',
  bonus_reserve: 'Резерв бонуса', bonus_release: 'Возврат бонуса', daily_reroll: 'Daily reroll',
};

function CoinLedger({ transactions }: { transactions: ReturnType<typeof useTasksStore.getState>['coinTransactions'] }) {
  return <section className="coin-ledger"><header><div><small>ПРОЗРАЧНАЯ ЭКОНОМИКА</small><h2>История Coins</h2></div><strong>Последние {transactions.length}</strong></header>
    {transactions.length === 0 ? <p>Операций пока нет.</p> : <div>{transactions.map((transaction) => <article key={transaction.id}><span className={transaction.amount >= 0 ? 'positive' : 'negative'}>{transaction.amount >= 0 ? '+' : ''}{transaction.amount} ◈</span><div><b>{ledgerLabels[transaction.type] ?? transaction.type}</b><small>{transaction.createdAt ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(transaction.createdAt)) : 'Только что'}</small></div></article>)}</div>}
  </section>;
}
