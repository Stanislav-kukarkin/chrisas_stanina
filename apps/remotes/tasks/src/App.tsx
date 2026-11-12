import { useEffect } from 'react';
import { FadeIn } from '@chrisasstanina/ui';
import {
  getFirebaseConfigFromEnv,
  initializeFirebase,
  isFirebaseReady,
} from '@chrisasstanina/firebase';
import { AppSidebar, MobileNavigation } from './components/AppNavigation';
import { ActivityTicker } from './components/ActivityTicker';
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
  const openCreateModal = useTasksStore((state) => state.openCreateModal);
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
        <div className="party-avatars">{members.slice(0, 3).map((member) => <i key={member.id} className="avatar" style={{ background: member.color }} title={member.name}>{member.initials}</i>)}<a href="/connections" aria-label="Пригласить участника">+</a></div>
        <span className={`sync-pill ${syncState}`}>{syncState === 'live' ? 'База' : syncState === 'loading' ? 'Загрузка' : 'Нет доступа'}</span>
        <button type="button" disabled={!canEdit} className="header-add" onClick={openCreateModal} aria-label="Создать задачу"><Icon name="plus" size={20} /></button>
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

function Celebration() {
  const celebration = useTasksStore((state) => state.celebration);
  const dismiss = useTasksStore((state) => state.dismissCelebration);
  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(dismiss, 6200);
    return () => window.clearTimeout(timer);
  }, [celebration, dismiss]);
  if (!celebration) return null;
  const icon = celebration.kind === 'level' ? '⚡' : celebration.kind === 'chest' ? '🎁' : '🏆';
  return <div className={`celebration-backdrop ${celebration.kind}`} role="dialog" aria-modal="true" aria-label={celebration.title} onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss(); }}><FadeIn key={celebration.id} className="celebration-card"><div className="celebration-particles" aria-hidden="true"><i /><i /><i /><i /><i /></div><span>{icon}</span><small>{celebration.kind === 'level' ? 'НОВЫЙ УРОВЕНЬ' : celebration.kind === 'chest' ? 'RARITY REVEAL' : 'ДОСТИЖЕНИЕ ОТКРЫТО'}</small><h2>{celebration.title}</h2><p>{celebration.detail}</p><button type="button" onClick={dismiss}>Продолжить</button></FadeIn></div>;
}

export default function App() {
  const activeSection = useTasksStore((state) => state.activeSection);
  const syncState = useTasksStore((state) => state.syncState);
  const showBoard = syncState === 'live';
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
              <ActivityTicker />
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
      <Celebration />
      <Toast />
    </div>
  );
}
