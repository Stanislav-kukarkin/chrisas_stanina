import { useMemo, useState } from 'react';
import { GAME_CONFIG, type TaskDifficulty } from '../domain/game-config';
import {
  deadlineState,
  nextPrimaryStatus,
  primaryActionLabel,
  unresolvedBlockers,
  type FamilyTask,
  type TaskStatus,
} from '../domain/task';
import { useTasksStore } from '../stores/tasks-store';
import { Icon } from './Icon';
import { SelectControl } from './SelectControl';

const durationLabels = { '5m': '5 мин', '30m': '30 мин', '1_2h': '1–2 ч', large: 'Большое дело' };

interface TaskCardProps {
  task: FamilyTask;
  allTasks: FamilyTask[];
  onDragStart: (taskId: string) => void;
}

export function TaskCard({ task, allTasks, onDragStart }: TaskCardProps) {
  const moveTask = useTasksStore((state) => state.moveTask);
  const agreeDifficulty = useTasksStore((state) => state.agreeDifficulty);
  const proposeDifficulty = useTasksStore((state) => state.proposeDifficulty);
  const declineDifficulty = useTasksStore((state) => state.declineDifficulty);
  const takeTask = useTasksStore((state) => state.takeTask);
  const acceptTransfer = useTasksStore((state) => state.acceptTransfer);
  const rejectTransfer = useTasksStore((state) => state.rejectTransfer);
  const leaveTask = useTasksStore((state) => state.leaveTask);
  const openEditModal = useTasksStore((state) => state.openEditModal);
  const deleteTask = useTasksStore((state) => state.deleteTask);
  const members = useTasksStore((state) => state.members);
  const currentUserId = useTasksStore((state) => state.currentUserId);
  const pending = useTasksStore((state) => state.pendingTaskIds.includes(task.id));
  const canEdit = useTasksStore((state) => state.canEdit);
  const activeSprintId = useTasksStore((state) => state.activeSprintId);
  const sprintNumber = useTasksStore((state) => state.sprintNumber);
  const [menuOpen, setMenuOpen] = useState(false);
  const [counterDifficulty, setCounterDifficulty] = useState<TaskDifficulty>(task.difficulty);
  const [openedAt] = useState(() => Date.now());
  const reward = GAME_CONFIG.difficulty[task.difficulty];
  const blockers = useMemo(() => unresolvedBlockers(task, allTasks), [allTasks, task]);
  const actionTarget = nextPrimaryStatus(task);
  const actionLabel = primaryActionLabel(task);
  const assignees = task.assigneeIds.map((id) => members.find((member) => member.id === id)).filter(Boolean);
  const reviewer = members.find((member) => member.id === task.reviewerId);
  const due = deadlineState(task);
  const isPending = task.difficultyStatus !== 'agreed';
  const canRespond = task.authorId === currentUserId || task.assigneeIds.includes(currentUserId);
  const canAgree = canRespond && (
    task.difficultyProposedById !== currentUserId
    || (task.authorId === currentUserId && task.assigneeIds.includes(currentUserId))
  );
  const canDecline = task.assigneeIds.includes(currentUserId);
  const pendingAssignees = task.pendingAssigneeIds ?? [];
  const newTransferParticipants = pendingAssignees.filter((id) => !task.assigneeIds.includes(id));
  const canAcceptTransfer = newTransferParticipants.length > 0
    ? newTransferParticipants.includes(currentUserId)
    : task.assigneeIds.includes(currentUserId);
  const canRejectTransfer = Boolean(task.transferRequestedById) && (
    task.authorId === currentUserId || task.assigneeIds.includes(currentUserId) || pendingAssignees.includes(currentUserId)
  );
  const isNextSprint = Boolean(task.sprintId && task.sprintId !== activeSprintId && task.sprintId !== 'current');
  const reviewHours = task.reviewStartedAt ? Math.floor((openedAt - new Date(task.reviewStartedAt).getTime()) / 3_600_000) : 0;
  const reviewLabel = reviewHours >= 48 ? '● Просрочено 48ч' : reviewHours >= 24 ? '● Проверка >24ч' : '● Ждёт проверки';

  function transition(target: TaskStatus) { void moveTask(task.id, target); }

  return (
    <article
      className={`task-card difficulty-${task.difficulty} ${task.status === 'done' ? 'is-done' : ''} ${pending ? 'is-pending' : ''}`}
      draggable={canEdit && !pending && !menuOpen}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/task-id', task.id);
        onDragStart(task.id);
      }}
    >
      <div className="task-card-top">
        <span className="difficulty-chip"><i>{reward.stars}</i>{reward.shortLabel}</span>
        <div className="task-card-actions">
          {(task.recurrence || task.recurrenceTemplateId) && <span title={task.recurrence === 'monthly' ? 'Ежемесячно' : 'Еженедельно'}><Icon name="repeat" size={14} /></span>}
          <button type="button" aria-label="Меню задачи" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>•••</button>
          {menuOpen && <div className="task-menu">
            {task.authorId === currentUserId && <button type="button" onClick={() => { setMenuOpen(false); openEditModal(task.id); }}>Изменить</button>}
            {task.authorId === currentUserId && task.status !== 'done' && <button type="button" className="danger" onClick={() => { setMenuOpen(false); if (window.confirm(`Удалить «${task.title}»?`)) void deleteTask(task.id); }}>Удалить</button>}
            {task.assigneeIds.includes(currentUserId) && task.difficultyStatus === 'agreed' && task.status !== 'review' && task.status !== 'done' && <button type="button" className="danger" onClick={() => { setMenuOpen(false); if (window.confirm(`Отказаться от «${task.title}» без штрафа?`)) void leaveTask(task.id); }}>Отказаться от задачи</button>}
            {task.authorId !== currentUserId && <small>Изменения доступны автору</small>}
          </div>}
        </div>
      </div>
      <h3>{task.title}</h3>
      {task.description && <p className="task-description">{task.description}</p>}

      {isPending && (
        <div className="agreement-banner agreement-expanded">
          <span>{task.difficultyStatus === 'declined' ? 'Назначение отклонено' : `Согласование: ${reward.label}`}</span>
          {canRespond && <div>
            <SelectControl value={counterDifficulty} onChange={(event) => setCounterDifficulty(event.target.value as TaskDifficulty)}>
              {(Object.keys(GAME_CONFIG.difficulty) as TaskDifficulty[]).map((value) => <option key={value} value={value}>{GAME_CONFIG.difficulty[value].label}</option>)}
            </SelectControl>
            {counterDifficulty !== task.difficulty && <button type="button" disabled={pending} onClick={() => void proposeDifficulty(task.id, counterDifficulty)}>Предложить</button>}
            {canAgree && counterDifficulty === task.difficulty && <button type="button" disabled={pending} onClick={() => void agreeDifficulty(task.id)}>Согласен</button>}
            {canDecline && <button type="button" className="secondary" disabled={pending} onClick={() => void declineDifficulty(task.id)}>Отказаться</button>}
          </div>}
        </div>
      )}

      {task.transferRequestedById && (
        <div className="agreement-banner transfer-banner">
          <span>Передача: {pendingAssignees.length > 0 ? pendingAssignees.map((id) => members.find((member) => member.id === id)?.name ?? 'Участник').join(', ') : 'сделать задачу свободной'}</span>
          <div>
            {canAcceptTransfer && <button type="button" disabled={pending} onClick={() => void acceptTransfer(task.id)}>Подтвердить</button>}
            {canRejectTransfer && <button type="button" className="secondary" disabled={pending} onClick={() => void rejectTransfer(task.id)}>Отклонить</button>}
          </div>
        </div>
      )}

      {blockers.length > 0 && <div className="blocker-banner"><Icon name="link" size={14} /><span>Заблокировано: {blockers.map((item) => item.title).join(', ')}</span></div>}

      <div className="reward-row">
        <span><b>XP</b> +{reward.xp}</span>
        <span><b className="coin-dot">◈</b> {reward.coins + task.bonusCoins}</span>
        <span><b>⚔</b> {reward.bossDamage}</span>
      </div>

      <div className="task-meta">
        {task.estimatedDuration && <span><Icon name="clock" size={14} />{durationLabels[task.estimatedDuration]}</span>}
        {due.label && <span className={`due-${due.tone}`}><i />{due.label}</span>}
        {task.rolloverCount > 0 && <span className="rollover"><Icon name="repeat" size={13} />×{task.rolloverCount}</span>}
        {isNextSprint && <span className="next-sprint">Спринт #{sprintNumber + 1}</span>}
      </div>

      <div className="task-footer">
        <div className="assignee-stack">
          {assignees.length > 0 ? assignees.map((member) => member && <span key={member.id} className="avatar" style={{ background: member.color }} title={member.name}>{member.initials}</span>) : (
            <button type="button" className="free-task" disabled={!canEdit || pending} onClick={() => void takeTask(task.id)}>👥 Взять</button>
          )}
          {reviewer && <span className="reviewer-label" title={`Проверяет ${reviewer.name}`}>→ <span className="avatar" style={{ background: reviewer.color }}>{reviewer.initials}</span></span>}
        </div>
        {task.status === 'review' && <span className={`review-wait ${reviewHours >= 48 ? 'overdue' : reviewHours >= 24 ? 'soon' : ''}`}>{reviewLabel}</span>}
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
