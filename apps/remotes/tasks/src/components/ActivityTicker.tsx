import { useTasksStore } from '../stores/tasks-store';

function eventText(type: string, title: string, damage?: number) {
  if (type === 'task_completed') return `завершил(а) «${title}»${damage ? ` · −${damage} HP` : ''}`;
  if (type === 'achievement') return `получил(а) достижение «${title}»`;
  if (type === 'boss_defeated') return `нанёс(ла) добивающий удар задачей «${title}»`;
  if (type === 'task_transferred') return `принял(а) передачу задачи «${title}»`;
  if (type === 'task_declined') return `отказался(ась) от задачи «${title}»`;
  if (type === 'daily_chest') return 'получил(а) сундук за все Daily';
  if (type === 'chest_opened') return `открыл(а) сундук: ${title}`;
  if (type === 'level_milestone') return `достиг(ла) milestone «${title}»`;
  if (type === 'reward_approved') return `использовал(а) награду «${title}»`;
  if (type === 'reward_rejected') return `получил(а) обратно награду «${title}»`;
  return title;
}

function eventIcon(type: string) {
  if (type === 'achievement') return '🏆';
  if (type === 'boss_defeated') return '👹';
  if (type.includes('chest')) return '🎁';
  if (type.includes('reward')) return '💰';
  if (type === 'level_milestone') return '⚡';
  return '⚔️';
}

export function ActivityTicker() {
  const activity = useTasksStore((state) => state.activity);
  const members = useTasksStore((state) => state.members);
  if (activity.length === 0) return null;
  const label = (userId?: string) => members.find((member) => member.id === userId)?.name ?? 'Участник';

  return (
    <details className="activity-ticker">
      <summary>
        <span>✦ ЛЕНТА ТАВЕРНЫ</span>
        <b>{label(activity[0].userIds[0])} {eventText(activity[0].type, activity[0].title, activity[0].bossDamage)}</b>
        <i>Развернуть</i>
      </summary>
      <div>
        {activity.map((event) => (
          <p key={event.id}><span>{eventIcon(event.type)}</span><b>{label(event.userIds[0])}</b> {eventText(event.type, event.title, event.bossDamage)}</p>
        ))}
      </div>
    </details>
  );
}
