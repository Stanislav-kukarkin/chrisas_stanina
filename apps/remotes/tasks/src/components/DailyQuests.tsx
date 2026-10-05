import { Icon } from './Icon';

const quests = [
  { icon: '⚔', title: 'Разминка', text: 'Заверши 1 задачу', value: 1, max: 1, reward: 3 },
  { icon: '🔥', title: 'Рабочий настрой', text: 'Получи 50 XP', value: 35, max: 50, reward: 5 },
  { icon: '⏱', title: 'Точно в срок', text: 'Заверши без просрочки', value: 0, max: 1, reward: 5 },
];

export function DailyQuests() {
  return (
    <section className="daily-quests">
      <header><span><Icon name="sparkles" size={17} />ЕЖЕДНЕВНЫЕ КВЕСТЫ</span><small>Обновятся через 8ч 42м</small></header>
      <div>{quests.map((quest) => <article key={quest.title} className={quest.value >= quest.max ? 'complete' : undefined}><span className="daily-icon">{quest.icon}</span><div><b>{quest.title}</b><p>{quest.text}</p><span className="quest-progress"><i style={{ width: `${(quest.value / quest.max) * 100}%` }} /></span></div><strong>+{quest.reward} ◈</strong></article>)}</div>
    </section>
  );
}

