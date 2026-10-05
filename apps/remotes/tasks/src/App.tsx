import { useEffect } from 'react';
import {
  getFirebaseConfigFromEnv,
  initializeFirebase,
  isFirebaseReady,
} from '@chrisasstanina/firebase';
import { AppSidebar, MobileNavigation } from './components/AppNavigation';
import { BossPanel } from './components/BossPanel';
import { CreateTaskModal } from './components/CreateTaskModal';
import { DailyQuests } from './components/DailyQuests';
import { Icon } from './components/Icon';
import { KanbanBoard } from './components/KanbanBoard';
import { SectionScreen } from './components/SectionScreens';
import { FirebaseBoardBridge } from './hooks/use-board-data';
import { useTasksStore } from './stores/tasks-store';

// Shell imports only the exposed App module (not this remote's main.tsx), so the
// remote must be able to initialise the shared Firebase package on its own.
initializeFirebase(getFirebaseConfigFromEnv());

function BoardHeader() {
  const setCreateModalOpen = useTasksStore((state) => state.setCreateModalOpen);
  const members = useTasksStore((state) => state.members);
  const sprintNumber = useTasksStore((state) => state.sprintNumber);
  const syncState = useTasksStore((state) => state.syncState);
  const canEdit = useTasksStore((state) => state.canEdit);
  return (
    <header className="board-header">
      <div>
        <span className="mobile-brand"><b>⚔</b> Семейные дела</span>
        <p>СЕМЕЙНАЯ ТАВЕРНА · СПРИНТ #{sprintNumber}</p>
        <h1>Зал поручений <span>✦</span></h1>
      </div>
      <div className="header-party">
        <span>УЧАСТНИКИ</span>
        <div className="party-avatars">{members.slice(0, 3).map((member) => <i key={member.id} className="avatar" style={{ background: member.color }} title={member.name}>{member.initials}</i>)}<button type="button" aria-label="Пригласить">з</button></div>
        <span className={`sync-pill ${syncState}`}>{syncState === 'live' ? 'База' : syncState === 'demo' ? 'Демо' : syncState === 'loading' ? 'Загрузка' : 'Нет доступа'}</span>
        <button type="button" disabled={!canEdit} className="header-add" onClick={() => setCreateModalOpen(true)} aria-label="Создать задачу"><Icon name="plus" size={20} /></button>
      </div>
    </header>
  );
}

function BoardStateMessage() {
  const syncState = useTasksStore((state) => state.syncState);
  const syncError = useTasksStore((state) => state.syncError);
  if (syncState !== 'loading' && syncState !== 'denied' && syncState !== 'error') return null;
  return (
    <section className="board-state-message">
      <span>{syncState === 'loading' ? '✦' : syncState === 'denied' ? '🛡' : '!'}</span>
      <h2>{syncState === 'loading' ? 'Загружаем семейную доску…' : syncState === 'denied' ? 'Нет доступа к «Семейным делам»' : 'Не удалось загрузить доску'}</h2>
      {syncState === 'denied' && <p>Попросите владельца добавить приложение в общую связь.</p>}
      {syncState === 'error' && <p>{syncError}</p>}
      {syncState === 'denied' && <a href="/connections">Настроить общий доступ</a>}
      {syncState === 'error' && <button type="button" onClick={() => window.location.reload()}>Повторить</button>}
    </section>
  );
}

function Toast() {
  const toast = useTasksStore((state) => state.toast);
  const dismissToast = useTasksStore((state) => state.dismissToast);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismissToast, 4200);
    return () => window.clearTimeout(timer);
  }, [dismissToast, toast]);
  if (!toast) return null;
  return (
    <div className={`app-toast ${toast.tone}`} role="status" key={toast.id}>
      <span>{toast.tone === 'success' ? '✓' : toast.tone === 'warning' ? '!' : '✦'}</span>
      <div><strong>{toast.title}</strong><p>{toast.detail}</p></div>
      <button type="button" onClick={dismissToast} aria-label="Закрыть"><Icon name="x" size={16} /></button>
    </div>
  );
}

export default function App() {
  const activeSection = useTasksStore((state) => state.activeSection);
  const syncState = useTasksStore((state) => state.syncState);
  const showBoard = syncState === 'demo' || syncState === 'live';
  return (
    <div className="tavern-app">
      {isFirebaseReady() && <FirebaseBoardBridge />}
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <AppSidebar />
      <main className="tavern-main">
        {activeSection === 'board' ? (
          <>
            <BoardHeader />
            {showBoard ? <div className="board-content">
              <BossPanel />
              <DailyQuests />
              <KanbanBoard />
            </div> : <BoardStateMessage />}
          </>
        ) : (
          <SectionScreen section={activeSection} />
        )}
      </main>
      <MobileNavigation />
      <CreateTaskModal />
      <Toast />
    </div>
  );
}
