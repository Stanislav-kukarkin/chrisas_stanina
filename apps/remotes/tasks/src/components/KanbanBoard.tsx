import { useMemo, useState } from 'react';
import { STATUS_META, TASK_STATUSES, type FamilyTask, type TaskStatus } from '../domain/task';
import { useTasksStore, type BoardFilter } from '../stores/tasks-store';
import { Icon } from './Icon';
import { TaskCard } from './TaskCard';

const filters: { id: BoardFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'mine', label: 'Мои' },
  { id: 'free', label: 'Свободные' },
  { id: 'today', label: 'Сегодня' },
  { id: 'overdue', label: 'Просрочено' },
  { id: 'blocked', label: 'Заблокированы' },
  { id: 'review', label: 'Review' },
];

function matchesFilter(task: FamilyTask, filter: BoardFilter, tasks: FamilyTask[], currentUserId: string) {
  if (filter === 'mine') return task.assigneeIds.includes(currentUserId);
  if (filter === 'free') return task.assigneeIds.length === 0;
  if (filter === 'today') return task.dueLabel === 'сегодня';
  if (filter === 'overdue') return task.dueTone === 'overdue';
  if (filter === 'blocked') return task.blockerIds.some((id) => tasks.find((candidate) => candidate.id === id)?.status !== 'done');
  if (filter === 'review') return task.status === 'review';
  return true;
}

export function KanbanBoard() {
  const tasks = useTasksStore((state) => state.tasks);
  const filter = useTasksStore((state) => state.filter);
  const query = useTasksStore((state) => state.query);
  const setFilter = useTasksStore((state) => state.setFilter);
  const setQuery = useTasksStore((state) => state.setQuery);
  const moveTask = useTasksStore((state) => state.moveTask);
  const setCreateModalOpen = useTasksStore((state) => state.setCreateModalOpen);
  const currentUserId = useTasksStore((state) => state.currentUserId);
  const canEdit = useTasksStore((state) => state.canEdit);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);

  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
    return tasks.filter((task) =>
      matchesFilter(task, filter, tasks, currentUserId) &&
      (!normalizedQuery || `${task.title} ${task.description ?? ''}`.toLocaleLowerCase('ru-RU').includes(normalizedQuery)),
    );
  }, [currentUserId, filter, query, tasks]);

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
          <button type="button" disabled={!canEdit} className="add-task-button" onClick={() => setCreateModalOpen(true)}><Icon name="plus" size={18} />{canEdit ? 'Создать' : 'Только просмотр'}</button>
        </div>
      </section>

      {tasks.length === 0 && !query && filter === 'all' ? (
        <section className="empty-board-state">
          <span>🍺</span>
          <h2>Таверна пока слишком спокойна.</h2>
          <p>Создайте первое семейное дело, пока Лентяй не захватил весь дом.</p>
          {canEdit && <button type="button" onClick={() => setCreateModalOpen(true)}><Icon name="plus" size={17} />Создать задачу</button>}
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
                <button type="button" disabled={!canEdit} aria-label={`Добавить в ${meta.label}`} onClick={() => setCreateModalOpen(true)}><Icon name="plus" size={16} /></button>
              </header>
              <div className="column-tasks">
                {columnTasks.map((task) => <TaskCard key={task.id} task={task} allTasks={tasks} onDragStart={setDraggedId} />)}
                {columnTasks.length === 0 && (
                  <button type="button" disabled={!canEdit} className="empty-column" onClick={() => setCreateModalOpen(true)}><Icon name="plus" size={18} /><span>{query || filter !== 'all' ? 'Нет задач по фильтру' : canEdit ? 'Добавить задачу' : 'Колонка пуста'}</span></button>
                )}
              </div>
            </section>
          );
        })}
      </div>}
    </>
  );
}
