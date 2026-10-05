import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@chrisasstanina/auth';
import {
  cancelAppInvitation,
  listAppInvitations,
  queryKeys,
  respondToAppInvitation,
  type AppInvitation,
  type ShareableAppName,
} from '@chrisasstanina/firebase';
import { APP_LABELS } from '@chrisasstanina/shared-federation';

const statusLabels: Record<AppInvitation['status'], string> = {
  pending: 'Ожидает ответа',
  accepted: 'Объединено',
  declined: 'Отклонено',
  cancelled: 'Отменено',
  revoked: 'Связь отменена',
};

export function AppConnectionRequestsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState('');
  const query = useQuery({
    queryKey: queryKeys.appInvitations(user?.uid ?? 'anonymous'),
    queryFn: () => listAppInvitations(user!.uid),
    enabled: Boolean(user),
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.appInvitations(user!.uid) });
  };
  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => respondToAppInvitation(user!.uid, id, accept),
    onSuccess: async () => { setActionError(''); await refresh(); },
    onError: (error) => setActionError(error instanceof Error ? error.message : String(error)),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelAppInvitation(user!.uid, id),
    onSuccess: async () => { setActionError(''); await refresh(); },
    onError: (error) => setActionError(error instanceof Error ? error.message : String(error)),
  });

  const invitations = query.data ?? [];
  const incoming = invitations.filter((invitation) => invitation.toUid === user?.uid);
  const outgoing = invitations.filter((invitation) => invitation.fromUid === user?.uid);

  function renderInvitation(invitation: AppInvitation, direction: 'incoming' | 'outgoing') {
    const peerEmail = direction === 'incoming' ? invitation.fromEmail : invitation.toEmail;
    const pending = invitation.status === 'pending';
    const active = invitation.status === 'accepted';
    const busy = respond.isPending || cancel.isPending;
    return (
      <article key={invitation.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium text-zinc-100">{peerEmail}</p>
            <p className="mt-1 text-xs text-zinc-500">{invitation.createdAt?.toLocaleString('ru-RU') ?? 'Недавно'}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs ${active ? 'bg-teal-400/10 text-teal-200' : pending ? 'bg-amber-400/10 text-amber-200' : 'bg-zinc-800 text-zinc-400'}`}>
            {statusLabels[invitation.status]}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(invitation.apps).map(([appName, role]) => (
            <span key={appName} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300">
              {APP_LABELS[appName as ShareableAppName]} · {role === 'edit' ? 'редактирование' : 'просмотр'}
            </span>
          ))}
        </div>
        {(pending || active) && (
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {direction === 'incoming' && pending && <>
              <button type="button" disabled={busy} onClick={() => respond.mutate({ id: invitation.id, accept: false })} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">Отклонить</button>
              <button type="button" disabled={busy} onClick={() => respond.mutate({ id: invitation.id, accept: true })} className="rounded-lg bg-teal-400 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-teal-300 disabled:opacity-50">Принять</button>
            </>}
            {direction === 'outgoing' && pending && <button type="button" disabled={busy} onClick={() => cancel.mutate(invitation.id)} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">Отменить запрос</button>}
            {active && <button type="button" disabled={busy} onClick={() => cancel.mutate(invitation.id)} className="rounded-lg border border-rose-500/30 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-50">Отменить связь</button>}
          </div>
        )}
      </article>
    );
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-violet-300">Общий доступ</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-100">Запросы на объединение</h1>
          <p className="mt-2 text-sm text-zinc-400">Здесь видны входящие и исходящие приглашения, включая уже завершённые.</p>
        </div>
        <Link to="/connections" className="rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-200 hover:border-zinc-500">Приложения и связи</Link>
      </div>

      {query.isLoading && <p className="mt-8 text-sm text-zinc-500">Загружаем запросы…</p>}
      {query.isError && <p role="alert" className="mt-8 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200">{query.error instanceof Error ? query.error.message : 'Не удалось загрузить запросы.'}</p>}
      {actionError && <p role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200">{actionError}</p>}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-100">Входящие</h2>
        <div className="mt-3 space-y-3">
          {incoming.map((invitation) => renderInvitation(invitation, 'incoming'))}
          {!query.isLoading && incoming.length === 0 && <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">Входящих запросов пока нет.</p>}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-100">Исходящие</h2>
        <div className="mt-3 space-y-3">
          {outgoing.map((invitation) => renderInvitation(invitation, 'outgoing'))}
          {!query.isLoading && outgoing.length === 0 && <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">Исходящих запросов пока нет.</p>}
        </div>
      </section>
    </section>
  );
}
