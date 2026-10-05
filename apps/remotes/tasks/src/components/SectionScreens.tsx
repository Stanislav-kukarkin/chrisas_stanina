import { useState } from 'react';
import {
  bossDamageForMember,
  earnedAchievementCount,
  onTimeTaskCount,
  settledTasks,
} from '../domain/stats';
import { useTasksStore, type AppSection } from '../stores/tasks-store';
import { Icon } from './Icon';

export function SectionScreen({ section }: { section: Exclude<AppSection, 'board'> }) {
  const setActiveSection = useTasksStore((state) => state.setActiveSection);
  const player = useTasksStore((state) => state.player);

  const titles: Record<typeof section, [string, string]> = {
    history: ['История спринтов', 'Летопись семейных побед и незакрытых дел.'],
    achievements: ['Достижения', 'Коллекция подвигов, streak-рекордов и секретов.'],
    shop: ['Лавка чудес', 'Тратьте Coins на семейные награды и магические редкости.'],
    bestiary: ['Бестиарий', 'Все встреченные вами твари домашнего хаоса.'],
    profile: ['Профиль игрока', 'Ваш путь, титулы, косметика и семейная статистика.'],
  };

  return (
    <div className="section-screen">
      <header className="section-heading">
        <button type="button" onClick={() => setActiveSection('board')}>← К доске</button>
        <span>СЕМЕЙНАЯ ТАВЕРНА</span>
        <h1>{titles[section][0]}</h1>
        <p>{titles[section][1]}</p>
      </header>
      {section === 'history' && <History />}
      {section === 'achievements' && <Achievements />}
      {section === 'shop' && <Shop coins={player.coins} />}
      {section === 'bestiary' && <Bestiary />}
      {section === 'profile' && <Profile />}
    </div>
  );
}

function History() {
  const tasks = useTasksStore((state) => state.tasks);
  const sprintNumber = useTasksStore((state) => state.sprintNumber);
  const sprintEndsAt = useTasksStore((state) => state.sprintEndsAt);
  const syncState = useTasksStore((state) => state.syncState);
  const [openedAt] = useState(() => Date.now());
  const sprintTasks = tasks.filter((task) => (
    task.sprintId === 'current' || (syncState === 'demo' && task.status !== 'backlog')
  ));
  const completed = sprintTasks.filter((task) => task.status === 'done').length;
  const progress = sprintTasks.length > 0 ? Math.round((completed / sprintTasks.length) * 100) : 0;
  const endDate = sprintEndsAt ? new Date(sprintEndsAt) : null;
  const daysLeft = endDate
    ? Math.max(0, Math.ceil((endDate.getTime() - openedAt) / 86_400_000))
    : 0;
  const endLabel = endDate
    ? `До ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(endDate)}`
    : 'Дата окончания не задана';

  return (
    <div className="sprint-history">
      <article className="featured-sprint">
        <div><small>ТЕКУЩИЙ</small><h2>Спринт #{sprintNumber}</h2><p>{endLabel}</p></div>
        <span><b>{daysLeft}</b> дней</span>
        <i><b style={{ width: `${progress}%` }} /></i>
        <strong>{completed} / {sprintTasks.length} задач</strong>
      </article>
      <p className="section-empty-note">Завершённых спринтов пока нет.</p>
    </div>
  );
}

function Achievements() {
  const tasks = useTasksStore((state) => state.tasks);
  const streak = useTasksStore((state) => state.player.streak);
  const completed = settledTasks(tasks).length;
  const onTime = onTimeTaskCount(tasks);
  const achievements = [
    { icon: '⚔', name: 'Работяга', value: completed, target: 50, unit: 'задач', rarity: 'rare' },
    { icon: '🔥', name: 'Неугасимый', value: streak, target: 14, unit: 'дней streak', rarity: 'epic' },
    { icon: '⏰', name: 'Гроза дедлайнов', value: onTime, target: 25, unit: 'задач вовремя', rarity: 'legendary' },
  ];

  return (
    <div className="achievement-grid">
      {achievements.map((item) => {
        const progress = Math.min(100, Math.round((item.value / item.target) * 100));
        return (
          <article key={item.name} className={`achievement-card ${item.rarity}`}>
            <span>{item.icon}</span>
            <div>
              <small>{item.rarity.toUpperCase()}</small>
              <h2>{item.name}</h2>
              <p>{item.value} / {item.target} {item.unit}</p>
              <i><b style={{ width: `${progress}%` }} /></i>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Shop({ coins }: { coins: number }) {
  const items = [
    { icon: '🍕', name: 'Заказать пиццу', price: 350, family: true },
    { icon: '🎮', name: 'Игровой вечер', price: 500, family: true },
    { icon: '🧪', name: 'Заморозка streak', price: 80, family: false },
    { icon: '🎁', name: 'Таинственный сундук', price: 180, family: false },
  ];
  return (
    <>
      <div className="shop-wallet"><Icon name="coins" size={22} /><span>Ваш кошелёк</span><strong>{coins} ◈</strong></div>
      <div className="shop-grid">
        {items.map((item) => (
          <article key={item.name}>
            <span>{item.icon}</span>
            <small>{item.family ? 'СЕМЕЙНАЯ НАГРАДА' : 'МАГИЧЕСКАЯ ЛАВКА'}</small>
            <h2>{item.name}</h2>
            <button type="button" disabled={coins < item.price}>{item.price} ◈</button>
          </article>
        ))}
      </div>
    </>
  );
}

function Bestiary() {
  const bossName = useTasksStore((state) => state.bossName);
  const bossHp = useTasksStore((state) => state.bossHp);
  const bossMaxHp = useTasksStore((state) => state.bossMaxHp);
  const defeated = bossHp === 0;
  const icon = bossName.toLocaleLowerCase('ru-RU').includes('тыкв') ? '🎃' : '👹';

  return (
    <div className="bestiary-grid">
      <article className={defeated ? 'won' : 'active'}>
        <span>{icon}</span>
        <div>
          <small>{defeated ? 'ПОБЕЖДЁН' : 'В БОЮ'}</small>
          <h2>{bossName}</h2>
          <p>{bossHp} / {bossMaxHp} HP · текущий босс</p>
        </div>
      </article>
      <p className="section-empty-note">Других встреченных боссов пока нет.</p>
    </div>
  );
}

function Profile() {
  const tasks = useTasksStore((state) => state.tasks);
  const members = useTasksStore((state) => state.members);
  const currentUserId = useTasksStore((state) => state.currentUserId);
  const player = useTasksStore((state) => state.player);
  const bossHp = useTasksStore((state) => state.bossHp);
  const currentMember = members.find((member) => member.id === currentUserId) ?? members[0];
  const completed = settledTasks(tasks).length;
  const onTime = onTimeTaskCount(tasks);
  const onTimeRate = completed > 0 ? Math.round((onTime / completed) * 100) : 0;
  const awards = earnedAchievementCount(tasks, player.streak);
  const damage = Math.round(bossDamageForMember(tasks, currentUserId));
  const title = onTime >= 25
    ? '⏰ ПОВЕЛИТЕЛЬ ДЕДЛАЙНОВ'
    : player.streak >= 14
      ? '🔥 НЕУГАСИМЫЙ'
      : completed >= 50
        ? '⚔ РАБОТЯГА'
        : '✦ НОВЫЙ ИСКАТЕЛЬ';
  const progress = player.xpToNext > 0 ? (player.xp / player.xpToNext) * 100 : 0;

  return (
    <div className="profile-panel">
      <div className="profile-hero">
        <div className="profile-avatar" style={{ background: currentMember?.color }}>
          <span>{currentMember?.initials ?? '•'}</span>
        </div>
        <small>{title}</small>
        <h2>{(currentMember?.name ?? 'Игрок').toLocaleUpperCase('ru-RU')}</h2>
        <b>LEVEL {player.level}</b>
        <i><span style={{ width: `${progress}%` }} /></i>
        <p>{player.xp} / {player.xpToNext} XP</p>
        <div>
          <span>🔥 <b>{player.streak}</b><small>STREAK</small></span>
          <span>◈ <b>{player.coins}</b><small>COINS</small></span>
          <span>🏆 <b>{awards}</b><small>НАГРАДЫ</small></span>
        </div>
      </div>
      <div className="profile-stats">
        <h3>Статистика таверны</h3>
        <div>
          <span><small>Задач выполнено</small><b>{completed}</b></span>
          <span><small>Вовремя</small><b>{onTimeRate}%</b></span>
          <span><small>Boss Damage</small><b>{damage}</b></span>
          <span><small>Побед над боссом</small><b>{bossHp === 0 ? 1 : 0}</b></span>
        </div>
      </div>
    </div>
  );
}
