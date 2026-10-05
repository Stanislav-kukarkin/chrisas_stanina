import { useEffect, useState, type FormEvent } from 'react';
import { GAME_CONFIG, type TaskDifficulty } from '../domain/game-config';
import type { TaskDuration } from '../domain/task';
import { useTasksStore } from '../stores/tasks-store';
import { Icon } from './Icon';
import { SelectControl } from './SelectControl';

export function CreateTaskModal() {
  const open = useTasksStore((state) => state.createModalOpen);
  const setOpen = useTasksStore((state) => state.setCreateModalOpen);
  const createTask = useTasksStore((state) => state.createTask);
  const members = useTasksStore((state) => state.members);
  const currentUserId = useTasksStore((state) => state.currentUserId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'backlog' | 'planned'>('planned');
  const [assigneeId, setAssigneeId] = useState(currentUserId);
  const [reviewerId, setReviewerId] = useState(currentUserId);
  const [difficulty, setDifficulty] = useState<TaskDifficulty>('normal');
  const [estimatedDuration, setEstimatedDuration] = useState<TaskDuration>('30m');
  const [dueLabel, setDueLabel] = useState('');
  const [recurring, setRecurring] = useState<'' | 'weekly' | 'monthly'>('');
  const [bonusCoins, setBonusCoins] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  if (!open) return null;
  const reward = GAME_CONFIG.difficulty[difficulty];
  const selectedAssigneeId = members.some((member) => member.id === assigneeId)
    ? assigneeId
    : currentUserId;
  const selectedReviewerId = members.some((member) => member.id === reviewerId)
    ? reviewerId
    : members.find((member) => member.id !== currentUserId)?.id ?? currentUserId;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setFormError('');
    try {
      await createTask({
        title,
        description,
        status,
        assigneeId: selectedAssigneeId || undefined,
        reviewerId: selectedReviewerId,
        difficulty,
        estimatedDuration,
        dueLabel,
        recurring: recurring || undefined,
        bonusCoins,
      });
      setTitle('');
      setDescription('');
      setBonusCoins(0);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось создать задачу.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="create-task-title">
        <header>
          <div><span>НОВОЕ ПОРУЧЕНИЕ</span><h2 id="create-task-title">Создать задачу</h2></div>
          <button type="button" aria-label="Закрыть" onClick={() => setOpen(false)}><Icon name="x" size={20} /></button>
        </header>
        <form onSubmit={(event) => void submit(event)}>
          <label className="field full"><span>Название *</span><input autoFocus required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, помыть окна" /></label>
          <label className="field full"><span>Описание</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Детали, которые помогут выполнить задачу" /></label>
          <div className="form-grid">
            <label className="field"><span>Исполнитель</span><SelectControl value={selectedAssigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Свободная задача</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</SelectControl></label>
            <label className="field"><span>Проверяющий *</span><SelectControl required value={selectedReviewerId} onChange={(event) => setReviewerId(event.target.value)}>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</SelectControl></label>
          </div>
          <fieldset className="difficulty-picker">
            <legend>Сложность и награда</legend>
            <div>{(Object.keys(GAME_CONFIG.difficulty) as TaskDifficulty[]).map((value) => { const item = GAME_CONFIG.difficulty[value]; return <label key={value} className={difficulty === value ? `active ${value}` : value}><input type="radio" name="difficulty" value={value} checked={difficulty === value} onChange={() => setDifficulty(value)} /><b>{item.stars}</b><span>{item.shortLabel}<small>{item.xp} XP · {item.coins} ◈</small></span></label>; })}</div>
          </fieldset>
          <div className="form-grid">
            <label className="field"><span>Оценка времени</span><SelectControl value={estimatedDuration} onChange={(event) => setEstimatedDuration(event.target.value as TaskDuration)}><option value="5m">⚡ 5 минут</option><option value="30m">🕐 30 минут</option><option value="1_2h">🕑 1–2 часа</option><option value="large">🌋 Большое дело</option></SelectControl></label>
            <label className="field"><span>Дедлайн</span><input value={dueLabel} onChange={(event) => setDueLabel(event.target.value)} placeholder="напр., 12 окт" /></label>
            <label className="field"><span>Повторение</span><SelectControl value={recurring} onChange={(event) => setRecurring(event.target.value as typeof recurring)}><option value="">Не повторять</option><option value="weekly">Еженедельно</option><option value="monthly">Ежемесячно</option></SelectControl></label>
            <label className="field"><span>Бонус автора</span><div className="coin-input"><b>◈</b><input type="number" min="0" max="100" value={bonusCoins} onChange={(event) => setBonusCoins(Math.max(0, Number(event.target.value)))} /></div></label>
          </div>
          <div className="modal-reward-summary"><span>Награда</span><b>+{reward.xp} XP</b><b>+{reward.coins + bonusCoins} ◈</b><b>−{reward.bossDamage} HP боссу</b></div>
          {formError && <p className="modal-form-error" role="alert">{formError}</p>}
          <footer>
            <label className="sprint-toggle"><input type="checkbox" checked={status === 'planned'} onChange={(event) => setStatus(event.target.checked ? 'planned' : 'backlog')} /><span /><b>Включить в текущий спринт</b></label>
            <div><button type="button" disabled={submitting} className="cancel-button" onClick={() => setOpen(false)}>Отмена</button><button type="submit" disabled={submitting || !selectedReviewerId} className="create-button"><Icon name="plus" size={17} />{submitting ? 'Сохраняем…' : 'Создать'}</button></div>
          </footer>
        </form>
      </section>
    </div>
  );
}
