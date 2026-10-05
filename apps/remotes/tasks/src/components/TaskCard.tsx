import { useMemo } from 'react';
import { GAME_CONFIG } from '../domain/game-config';
import {
  nextPrimaryStatus,
  primaryActionLabel,
  unresolvedBlockers,
  type FamilyTask,
  type TaskStatus,
} from '../domain/task';
import { useTasksStore } from '../stores/tasks-store';
import { Icon } from './Icon';

const durationLabels = {
  '5m': '5 мин',
  '30m': '30 мин',
  '1_2h': '1–2 ч',
  large: 'Большое дело',
};

interface TaskCardProps {
  task: FamilyTask;
  allTasks: FamilyTask[];
  onDragStart: (taskId: string) => void;
}

export function TaskCard({ task, allTasks, onDragStart }: TaskCardProps) {
  const moveTask = useTasksStore((state) => state.moveTask);
  const agreeDifficulty = useTasksStore((state) => state.agreeDifficulty);
  const takeTask = useTasksStore((state) => state.takeTask);
  const members = useTasksStore((state) => state.members);
  const pending = useTasksStore((state) => state.pendingTaskIds.includes(task.id));
  const canEdit = useTasksStore((state) => state.canEdit);
  const reward = GAME_CONFIG.difficulty[task.difficulty];
  const blockers = useMemo(() => unresolvedBlockers(task, allTasks), [allTasks, task]);
  const actionTarget = nextPrimaryStatus(task);
  const actionLabel = primaryActionLabel(task);
  const assignees = task.assigneeIds.map((id) => members.find((member) => member.id === id)).filter(Boolean);
  const reviewer = members.find((member) => member.id === task.reviewerId);
  const isPending = task.difficultyStatus === 'pending';

  function transition(target: TaskStatus) {
    void moveTask(task.id, target);
  }

  return (
    <article
      className={`task-card difficulty-${task.difficulty} ${task.status === 'done' ? 'is-done' : ''} ${pending ? 'is-pending' : ''}`}
      draggable={canEdit && !pending}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/task-id', task.id);
        onDragStart(task.id);
      }}
    >
      <div className="task-card-top">
        <span className="difficulty-chip"><i>{reward.stars}</i>{reward.shortLabel}</span>
        <div className="task-card-actions">
          {task.recurring && <span title={task.recurring === 'weekly' ? 'Еженедельно' : 'Ежемесячно'}><Icon name="repeat" size={14} /></span>}
          <button type="button" aria-label="Меню задачи">•••</button>
        </div>
      </div>
      <h3>{task.title}</h3>
      {task.description && <p className="task-description">{task.description}</p>}

      {isPending && (
        <div className="agreement-banner">
          <span>Нужно согласовать сложность</span>
          <button type="button" disabled={!canEdit || pending} onClick={() => void agreeDifficulty(task.id)}>Согласен</button>
        </div>
      )}

      {blockers.length > 0 && (
        <div className="blocker-banner"><Icon name="link" size={14} /><span>Заблокировано: {blockers[0]?.title}</span></div>
      )}

      <div className="reward-row">
        <span><b>XP</b> +{reward.xp}</span>
        <span><b className="coin-dot">◈</b> {reward.coins + task.bonusCoins}</span>
        <span><b>⚔</b> {reward.bossDamage}</span>
      </div>

      <div className="task-meta">
        {task.estimatedDuration && <span><Icon name="clock" size={14} />{durationLabels[task.estimatedDuration]}</span>}
        {task.dueLabel && <span className={`due-${task.dueTone ?? 'normal'}`}><i />{task.dueLabel}</span>}
        {task.rolloverCount > 0 && <span className="rollover"><Icon name="repeat" size={13} />×{task.rolloverCount}</span>}
      </div>

      <div className="task-footer">
        <div className="assignee-stack">
          {assignees.length > 0 ? assignees.map((member) => member && (
            <span key={member.id} className="avatar" style={{ background: member.color }} title={member.name}>{member.initials}</span>
          )) : (
            <button type="button" className="free-task" disabled={!canEdit || pending} onClick={() => void takeTask(task.id)}>👥 Взять</button>
          )}
          {reviewer && <span className="reviewer-label">→ <span className="avatar" style={{ background: reviewer.color }}>{reviewer.initials}</span></span>}
        </div>
        {task.status === 'review' && <span className="review-wait">● Ждёт проверки</span>}
        {task.status === 'done' && <span className="done-label">✓ Награда выдана</span>}
      </div>

      {actionTarget && actionLabel && !isPending && (
        <div className="mobile-task-actions">
          {task.status === 'review' && <button type="button" disabled={!canEdit || pending} className="secondary" onClick={() => transition('in_progress')}>Вернуть</button>}
          <button type="button" disabled={!canEdit || pending} onClick={() => transition(actionTarget)}>{pending ? 'Сохраняем…' : actionLabel}<Icon name="chevron" size={15} /></button>
        </div>
      )}
    </article>
  );
}
