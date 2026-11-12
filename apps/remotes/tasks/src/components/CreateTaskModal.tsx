import { useEffect, useRef, useState, type FormEvent } from 'react';
import { GAME_CONFIG, type TaskDifficulty } from '../domain/game-config';
import type { FamilyTask, RecurrenceFrequency, TaskDuration } from '../domain/task';
import { useTasksStore } from '../stores/tasks-store';
import { Icon } from './Icon';
import { SelectControl } from './SelectControl';

export function CreateTaskModal() {
  const open = useTasksStore((state) => state.createModalOpen);
  const editingTaskId = useTasksStore((state) => state.editingTaskId);
  const editingTask = useTasksStore((state) => state.tasks.find((task) => task.id === state.editingTaskId));
  if (!open) return null;
  return <TaskModalForm key={editingTaskId ?? 'new-task'} editingTask={editingTask} />;
}

function TaskModalForm({ editingTask }: { editingTask?: FamilyTask }) {
  const close = useTasksStore((state) => state.closeTaskModal);
  const createTask = useTasksStore((state) => state.createTask);
  const updateTask = useTasksStore((state) => state.updateTask);
  const tasks = useTasksStore((state) => state.tasks);
  const members = useTasksStore((state) => state.members);
  const currentUserId = useTasksStore((state) => state.currentUserId);
  const activeSprintId = useTasksStore((state) => state.activeSprintId);
  const sprintNumber = useTasksStore((state) => state.sprintNumber);
  const fallbackReviewer = members.find((member) => member.id !== currentUserId)?.id ?? currentUserId;
  const [title, setTitle] = useState(editingTask?.title ?? '');
  const [description, setDescription] = useState(editingTask?.description ?? '');
  const [status, setStatus] = useState<'backlog' | 'planned'>(editingTask?.status === 'backlog' ? 'backlog' : 'planned');
  const [sprintTarget, setSprintTarget] = useState<'current' | 'next'>(
    editingTask?.sprintId && editingTask.sprintId !== activeSprintId && editingTask.sprintId !== 'current' ? 'next' : 'current',
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(editingTask?.assigneeIds ?? [currentUserId]);
  const [reviewerId, setReviewerId] = useState(editingTask?.reviewerId ?? fallbackReviewer);
  const [difficulty, setDifficulty] = useState<TaskDifficulty>(editingTask?.difficulty ?? 'normal');
  const [estimatedDuration, setEstimatedDuration] = useState<TaskDuration>(editingTask?.estimatedDuration ?? '30m');
  const [dueDate, setDueDate] = useState(editingTask?.dueDate?.slice(0, 10) ?? '');
  const [recurrence, setRecurrence] = useState<'' | RecurrenceFrequency>(editingTask?.recurrence ?? '');
  const [blockerIds, setBlockerIds] = useState<string[]>(editingTask?.blockerIds ?? []);
  const [bonusCoins, setBonusCoins] = useState(editingTask?.bonusCoins ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  const reward = GAME_CONFIG.difficulty[difficulty];
  const blockerCandidates = tasks.filter((task) => task.id !== editingTask?.id && task.status !== 'done');

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])')];
      if (focusable.length === 0) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', onKeyDown); };
  }, [close]);

  function toggle(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !reviewerId) return;
    setSubmitting(true);
    setFormError('');
    const input = {
      title,
      description,
      assigneeIds,
      reviewerId,
      difficulty,
      estimatedDuration,
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : undefined,
      blockerIds,
      recurrence: recurrence || undefined,
      bonusCoins,
      sprintTarget,
    };
    try {
      if (editingTask) await updateTask(editingTask.id, input);
      else await createTask({ ...input, status });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось сохранить задачу.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialogRef} className="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <header>
          <div><span>{editingTask ? 'РЕДАКТИРОВАНИЕ' : 'НОВОЕ ПОРУЧЕНИЕ'}</span><h2 id="task-modal-title">{editingTask ? 'Изменить задачу' : 'Создать задачу'}</h2></div>
          <button type="button" aria-label="Закрыть" onClick={close}><Icon name="x" size={20} /></button>
        </header>
        <form onSubmit={(event) => void submit(event)}>
          <label className="field full"><span>Название *</span><input autoFocus required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, помыть окна" /></label>
          <label className="field full"><span>Описание</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Детали, которые помогут выполнить задачу" /></label>
          <div className="form-grid">
            <fieldset className="field member-field"><legend>Исполнители</legend><div className="member-checks">
              {members.map((member) => <label key={member.id}><input type="checkbox" checked={assigneeIds.includes(member.id)} onChange={() => toggle(assigneeIds, member.id, setAssigneeIds)} /><span className="avatar" style={{ background: member.color }}>{member.initials}</span>{member.name}</label>)}
              {members.length === 0 && <small>Участники не найдены</small>}
            </div></fieldset>
            <label className="field"><span>Проверяющий *</span><SelectControl required value={reviewerId} onChange={(event) => setReviewerId(event.target.value)}><option value="" disabled>Выберите</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</SelectControl></label>
          </div>
          <fieldset className="difficulty-picker"><legend>Сложность и награда</legend><div>
            {(Object.keys(GAME_CONFIG.difficulty) as TaskDifficulty[]).map((value) => { const item = GAME_CONFIG.difficulty[value]; return <label key={value} className={difficulty === value ? `active ${value}` : value}><input type="radio" name="difficulty" value={value} checked={difficulty === value} onChange={() => setDifficulty(value)} /><b>{item.stars}</b><span>{item.shortLabel}<small>{item.xp} XP · {item.coins} ◈</small></span></label>; })}
          </div></fieldset>
          <div className="form-grid">
            <label className="field"><span>Оценка времени</span><SelectControl value={estimatedDuration} onChange={(event) => setEstimatedDuration(event.target.value as TaskDuration)}><option value="5m">⚡ 5 минут</option><option value="30m">🕐 30 минут</option><option value="1_2h">🕑 1–2 часа</option><option value="large">🌋 Большое дело</option></SelectControl></label>
            <label className="field"><span>Дедлайн</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            <label className="field"><span>Повторение</span><SelectControl value={recurrence} onChange={(event) => setRecurrence(event.target.value as typeof recurrence)}><option value="">Не повторять</option><option value="weekly">Еженедельно</option><option value="monthly">Ежемесячно</option></SelectControl></label>
            <label className="field"><span>Бонус автора</span><div className="coin-input"><b>◈</b><input type="number" min="0" max="100" value={bonusCoins} onChange={(event) => setBonusCoins(Math.max(0, Number(event.target.value)))} /></div></label>
          </div>
          <fieldset className="field blocker-field"><legend>Блокеры</legend><div className="blocker-picker">
            {blockerCandidates.map((task) => <label key={task.id}><input type="checkbox" checked={blockerIds.includes(task.id)} onChange={() => toggle(blockerIds, task.id, setBlockerIds)} />{task.title}</label>)}
            {blockerCandidates.length === 0 && <small>Нет незавершённых задач для связи.</small>}
          </div></fieldset>
          <div className="modal-reward-summary"><span>Награда</span><b>+{reward.xp} XP</b><b>+{reward.coins + bonusCoins} ◈</b><b>−{reward.bossDamage} HP боссу</b></div>
          {assigneeIds.length === 0 && <p className="modal-form-note">Задача будет свободной. Первый участник сможет взять её и согласовать сложность.</p>}
          {formError && <p className="modal-form-error" role="alert">{formError}</p>}
          <footer>
            {!editingTask ? <label className="field sprint-placement"><span>Планирование</span><SelectControl value={status === 'backlog' ? 'backlog' : sprintTarget} onChange={(event) => { const value = event.target.value; setStatus(value === 'backlog' ? 'backlog' : 'planned'); if (value !== 'backlog') setSprintTarget(value as 'current' | 'next'); }}><option value="backlog">Оставить в Backlog</option><option value="current">Текущий спринт #{sprintNumber}</option><option value="next">Следующий спринт #{sprintNumber + 1}</option></SelectControl></label> : <span />}
            <div><button type="button" disabled={submitting} className="cancel-button" onClick={close}>Отмена</button><button type="submit" disabled={submitting || !reviewerId} className="create-button"><Icon name="plus" size={17} />{submitting ? 'Сохраняем…' : editingTask ? 'Сохранить' : 'Создать'}</button></div>
          </footer>
        </form>
      </section>
    </div>
  );
}
