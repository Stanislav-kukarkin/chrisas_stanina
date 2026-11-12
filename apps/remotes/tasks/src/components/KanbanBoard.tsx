import { useMemo, useState } from 'react';
import { deadlineState, STATUS_META, TASK_STATUSES, type FamilyTask, type TaskStatus } from '../domain/task';
import { useTasksStore, type BoardFilter } from '../stores/tasks-store';
import { Icon } from './Icon';
import { SelectControl } from './SelectControl';
import { TaskCard } from './TaskCard';

const filters: { id: BoardFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'mine', label: 'Мои' },
  { id: 'authored', label: 'Я автор' },
  { id: 'reviewing', label: 'Я проверяю' },
  { id: 'free', label: 'Свободные' },
  { id: 'today', label: 'Сегодня' },
  { id: 'overdue', label: 'Просрочено' },
  { id: 'blocked', label: 'Заблокированы' },
  { id: 'review', label: 'Review' },
  { id: 'recurring', label: 'Повторяемые' },
  { id: 'sprint', label: 'В спринте' },
  { id: 'easy', label: 'Easy' },
  { id: 'normal', label: 'Normal' },
  { id: 'hard', label: 'Hard' },
  { id: 'epic', label: 'Epic' },
];

function matchesFilter(task: FamilyTask, filter: BoardFilter, tasks: FamilyTask[], currentUserId: string) {
  if (filter === 'mine') return task.assigneeIds.includes(currentUserId);
  if (filter === 'authored') return task.authorId === currentUserId;
  if (filter === 'reviewing') return task.reviewerId === currentUserId;
  if (filter === 'free') return task.assigneeIds.length === 0;
  if (filter === 'today') return deadlineState(task).label === 'сегодня';
  if (filter === 'overdue') return deadlineState(task).tone === 'overdue';
  if (filter === 'blocked') return task.blockerIds.some((id) => tasks.find((candidate) => candidate.id === id)?.status !== 'done');
  if (filter === 'review') return task.status === 'review';
  if (filter === 'recurring') return Boolean(task.recurrenceTemplateId || task.recurrence);
  if (filter === 'sprint') return Boolean(task.sprintId);
  if (filter === 'easy' || filter === 'normal' || filter === 'hard' || filter === 'epic') return task.difficulty === filter;
  return true;
}

export function KanbanBoard() {
  const tasks = useTasksStore((state) => state.tasks);
  const filter = useTasksStore((state) => state.filter);
  const query = useTasksStore((state) => state.query);
  const setFilter = useTasksStore((state) => state.setFilter);
  const setQuery = useTasksStore((state) => state.setQuery);
  const moveTask = useTasksStore((state) => state.moveTask);
  const openCreateModal = useTasksStore((state) => state.openCreateModal);
  const currentUserId = useTasksStore((state) => state.currentUserId);
  const canEdit = useTasksStore((state) => state.canEdit);
  const members = useTasksStore((state) => state.members);
  const activeSprintId = useTasksStore((state) => state.activeSprintId);
  const sprintNumber = useTasksStore((state) => state.sprintNumber);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const [assigneeId, setAssigneeId] = useState('all');
  const [reviewerId, setReviewerId] = useState('all');
  const [authorId, setAuthorId] = useState('all');
  const [sprintScope, setSprintScope] = useState<'all' | 'backlog' | 'current' | 'next'>('all');

  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
    const nextSprintId = `sprint-${sprintNumber + 1}`;
    return tasks.filter((task) => {
      const matchesSprint = sprintScope === 'all'
        || (sprintScope === 'backlog' && !task.sprintId)
        || (sprintScope === 'current' && (task.sprintId === activeSprintId || task.sprintId === 'current'))
        || (sprintScope === 'next' && task.sprintId === nextSprintId);
      return matchesFilter(task, filter, tasks, currentUserId)
        && (assigneeId === 'all' || task.assigneeIds.includes(assigneeId))
        && (reviewerId === 'all' || task.reviewerId === reviewerId)
        && (authorId === 'all' || task.authorId === authorId)
        && matchesSprint
        && (!normalizedQuery || `${task.title} ${task.description ?? ''}`.toLocaleLowerCase('ru-RU').includes(normalizedQuery));
    });
  }, [activeSprintId, assigneeId, authorId, currentUserId, filter, query, reviewerId, sprintNumber, sprintScope, tasks]);

  function handleDrop(status: TaskStatus, taskId?: string) {
    const id = taskId || draggedId;
    if (id && canEdit) void moveTask(id, status);
    setDraggedId(null);
    setDropTarget(null);
  }

  return (
    <>
      <section className="board-toolbar">
        <div className="filter-scroll">
          {filters.map((item) => (
            <button key={item.id} type="button" className={filter === item.id ? 'active' : undefined} onClick={() => setFilter(item.id)}>{item.label}</button>
          ))}
        </div>
        <div className="board-actions">
          <label className="search-field"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти задачу…" /></label>
          <button type="button" disabled={!canEdit} className="add-task-button" onClick={openCreateModal}><Icon name="plus" size={18} />{canEdit ? 'Создать' : 'Только просмотр'}</button>
        </div>
      </section>
      <section className="advanced-filters" aria-label="Расширенные фильтры">
        <label><span>Исполнитель</span><SelectControl value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="all">Все</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</SelectControl></label>
        <label><span>Проверяющий</span><SelectControl value={reviewerId} onChange={(event) => setReviewerId(event.target.value)}><option value="all">Все</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</SelectControl></label>
        <label><span>Автор</span><SelectControl value={authorId} onChange={(event) => setAuthorId(event.target.value)}><option value="all">Все</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</SelectControl></label>
        <label><span>Спринт</span><SelectControl value={sprintScope} onChange={(event) => setSprintScope(event.target.value as typeof sprintScope)}><option value="all">Все</option><option value="backlog">Backlog</option><option value="current">Текущий #{sprintNumber}</option><option value="next">Следующий #{sprintNumber + 1}</option></SelectControl></label>
      </section>

      {tasks.length === 0 && !query && filter === 'all' ? (
        <section className="empty-board-state">
          <span>🍺</span>
          <h2>Таверна пока слишком спокойна.</h2>
          <p>Создайте первое семейное дело, пока Лентяй не захватил весь дом.</p>
          {canEdit && <button type="button" onClick={openCreateModal}><Icon name="plus" size={17} />Создать задачу</button>}
        </section>
      ) : <div className="kanban" aria-label="Kanban доска">
        {TASK_STATUSES.map((status) => {
          const meta = STATUS_META[status];
          const columnTasks = visibleTasks.filter((task) => task.status === status);
          return (
            <section
              key={status}
              className={`kanban-column status-${meta.accent} ${dropTarget === status ? 'is-drop-target' : ''}`}
              onDragOver={(event) => { if (!canEdit) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(status); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null); }}
              onDrop={(event) => { event.preventDefault(); handleDrop(status, event.dataTransfer.getData('text/task-id')); }}
            >
              <header className="column-header">
                <span className="column-icon">{meta.icon}</span>
                <h2>{meta.label}</h2>
                <b>{columnTasks.length}</b>
                <button type="button" disabled={!canEdit} aria-label={`Добавить в ${meta.label}`} onClick={openCreateModal}><Icon name="plus" size={16} /></button>
              </header>
              <div className="column-tasks">
                {columnTasks.map((task) => <TaskCard key={task.id} task={task} allTasks={tasks} onDragStart={setDraggedId} />)}
                {columnTasks.length === 0 && (
                  <button type="button" disabled={!canEdit} className="empty-column" onClick={openCreateModal}><Icon name="plus" size={18} /><span>{query || filter !== 'all' ? 'Нет задач по фильтру' : canEdit ? 'Добавить задачу' : 'Колонка пуста'}</span></button>
                )}
              </div>
            </section>
          );
        })}
      </div>}
    </>
  );
}
