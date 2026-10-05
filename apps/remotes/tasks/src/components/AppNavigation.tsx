import { Icon, type IconName } from './Icon';
import { earnedAchievementCount } from '../domain/stats';
import { useTasksStore, type AppSection } from '../stores/tasks-store';

const items: { id: AppSection; label: string; icon: IconName }[] = [
  { id: 'board', label: 'Доска', icon: 'board' },
  { id: 'history', label: 'Спринты', icon: 'history' },
  { id: 'achievements', label: 'Достижения', icon: 'trophy' },
  { id: 'shop', label: 'Лавка', icon: 'shop' },
  { id: 'bestiary', label: 'Бестиарий', icon: 'book' },
  { id: 'profile', label: 'Профиль', icon: 'user' },
];

function AchievementBadge() {
  const tasks = useTasksStore((state) => state.tasks);
  const streak = useTasksStore((state) => state.player.streak);
  const count = earnedAchievementCount(tasks, streak);
  return count > 0 ? <em>{count}</em> : null;
}

export function AppSidebar() {
  const activeSection = useTasksStore((state) => state.activeSection);
  const setActiveSection = useTasksStore((state) => state.setActiveSection);
  const player = useTasksStore((state) => state.player);
  const members = useTasksStore((state) => state.members);
  const currentUserId = useTasksStore((state) => state.currentUserId);
  const currentMember = members.find((member) => member.id === currentUserId) ?? members[0];

  return (
    <aside className="tavern-sidebar">
      <div className="brand-lockup">
        <div className="brand-crest"><span>⚔</span></div>
        <div><strong>Семейные</strong><small>дела</small></div>
      </div>
      <p className="nav-kicker">НАВИГАЦИЯ</p>
      <nav className="side-nav" aria-label="Разделы приложения">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activeSection === item.id ? 'active' : undefined}
            onClick={() => setActiveSection(item.id)}
          >
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
            {item.id === 'achievements' && <AchievementBadge />}
          </button>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <section className="sidebar-player">
        <div className="sidebar-player-top">
          <div className="avatar" style={{ background: currentMember?.color }}>{currentMember?.initials ?? '•'}</div>
          <div><strong>{currentMember?.name ?? 'Игрок'}</strong><span>LVL {player.level}</span></div>
          <button type="button" aria-label="Открыть профиль" onClick={() => setActiveSection('profile')}>›</button>
        </div>
        <div className="mini-progress"><i style={{ width: `${(player.xp / player.xpToNext) * 100}%` }} /></div>
        <div className="sidebar-stats">
          <span><b>◈</b> {player.coins}</span>
          <span><b>🔥</b> {player.streak} дн.</span>
        </div>
      </section>
    </aside>
  );
}

export function MobileNavigation() {
  const activeSection = useTasksStore((state) => state.activeSection);
  const setActiveSection = useTasksStore((state) => state.setActiveSection);
  return (
    <nav className="mobile-nav" aria-label="Мобильная навигация">
      {items.slice(0, 5).map((item) => (
        <button key={item.id} type="button" className={activeSection === item.id ? 'active' : undefined} onClick={() => setActiveSection(item.id)}>
          <Icon name={item.icon} size={20} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
