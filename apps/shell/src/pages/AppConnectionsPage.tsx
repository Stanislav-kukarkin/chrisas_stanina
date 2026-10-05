import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@chrisasstanina/auth';
import {
  APP_DESCRIPTIONS,
  APP_LABELS,
  REMOTE_NAMES,
  type RemoteName,
} from '@chrisasstanina/shared-federation';
import {
  cancelAppInvitation,
  findInvitationTarget,
  getDefaultFamilyId,
  leaveLegacyFamily,
  listAppInvitations,
  migrateLegacyFamilyAccess,
  queryKeys,
  sendAppInvitation,
  SHAREABLE_APP_NAMES,
  useFamilyMembers,
  type AppInvitation,
  type AppSharingRole,
  type AppSharingRoles,
  type ShareableAppName,
} from '@chrisasstanina/firebase';

const APP_ACCESS: Record<ShareableAppName, { label: string; description: string }> = {
  shopping: { label: APP_LABELS.shopping, description: APP_DESCRIPTIONS.shopping },
  payments: { label: APP_LABELS.payments, description: APP_DESCRIPTIONS.payments },
};

function peerFor(invitation: AppInvitation, uid: string) {
  return uid === invitation.fromUid
    ? { uid: invitation.toUid, email: invitation.toEmail }
    : { uid: invitation.fromUid, email: invitation.fromEmail };
}

export function AppConnectionsPage() {
  const { user } = useAuth();
  const familyId = getDefaultFamilyId();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [migrationError, setMigrationError] = useState('');
  const [actionError, setActionError] = useState('');
  const [legacyBusy, setLegacyBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [selectedApps, setSelectedApps] = useState<AppSharingRoles>({ shopping: 'edit', payments: 'edit' });
  const [formError, setFormError] = useState('');
  const membersQuery = useFamilyMembers(familyId, Boolean(user));
  const invitationsQuery = useQuery({
    queryKey: queryKeys.appInvitations(user?.uid ?? 'anonymous'),
    queryFn: () => listAppInvitations(user!.uid),
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!user) return;
    let active = true;
    void migrateLegacyFamilyAccess(user.uid, familyId)
      .then((migrated) => {
        if (!active) return;
        if (migrated) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.familyMembers(familyId) });
          void queryClient.invalidateQueries({ queryKey: queryKeys.familyAppAccess(familyId, 'shopping', user.uid) });
          void queryClient.invalidateQueries({ queryKey: queryKeys.familyAppAccess(familyId, 'payments', user.uid) });
        }
      })
      .catch((error: unknown) => {
        if (active) setMigrationError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, [familyId, queryClient, user]);

  const invitations = invitationsQuery.data ?? [];
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const activeInvitations = invitations.filter((invitation) => invitation.status === 'accepted');
  const legacyMembers = members.filter(
    (member) => member.uid !== user?.uid && member.source === 'legacy',
  );
  const connectedMemberIds = useMemo(() => new Set(members.map((member) => member.uid)), [members]);

  const sendMutation = useMutation({
    mutationFn: async (values: { login: string; apps: AppSharingRoles }) => {
      if (!user) throw new Error('Сначала войдите в аккаунт.');
      const target = await findInvitationTarget(values.login, user.uid);
      if (!target) throw new Error('Аккаунт с таким email не найден. Попросите пользователя сначала войти в приложение.');
      if (connectedMemberIds.has(target.uid)) throw new Error('Этот пользователь уже связан с вашим аккаунтом через старое общее пространство.');
      const duplicate = invitations.find(
        (invite) =>
          invite.status === 'pending' &&
          ((invite.fromUid === user.uid && invite.toUid === target.uid) ||
            (invite.fromUid === target.uid && invite.toUid === user.uid)),
      );
      if (duplicate) throw new Error('Для этого пользователя уже есть ожидающий запрос.');
      return sendAppInvitation(user.uid, user.email ?? '', target, values.apps);
    },
    onSuccess: async () => {
      setEmail('');
      setFormError('');
      setModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.appInvitations(user!.uid) });
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : String(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: (invitationId: string) => cancelAppInvitation(user!.uid, invitationId),
    onSuccess: async () => {
      setActionError('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.appInvitations(user!.uid) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.familyMembers(familyId) }),
      ]);
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : String(error)),
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    try {
      await sendMutation.mutateAsync({ login: email, apps: selectedApps });
    } catch {
      // The mutation owns the visible error message.
    }
  }

  function updateRole(appName: ShareableAppName, role: AppSharingRole | null) {
    setSelectedApps((current) => {
      const next = { ...current };
      if (role) next[appName] = role;
      else delete next[appName];
      return next;
    });
  }

  async function handleLeaveLegacy() {
    if (!user || !window.confirm('Отключиться от старого общего пространства? Доступ к общим покупкам и платежам пропадёт.')) return;
    setLegacyBusy(true);
    setMigrationError('');
    try {
      await leaveLegacyFamily(user.uid, familyId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.familyMembers(familyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.familyAppAccess(familyId, 'shopping', user.uid) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.familyAppAccess(familyId, 'payments', user.uid) }),
      ]);
    } catch (error) {
      setMigrationError(error instanceof Error ? error.message : String(error));
    } finally {
      setLegacyBusy(false);
    }
  }

  const displayName = (uid: string, fallback: string) => {
    const member = members.find((entry) => entry.uid === uid);
    return member?.profile?.displayName || fallback;
  };

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-violet-300">Общий доступ</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-100">Объединение приложений</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Пригласите человека по email и отдельно выберите приложения и уровень доступа. Объединение начнётся после принятия приглашения.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/connection-requests" className="rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-200 hover:border-zinc-500">
            Запросы
          </Link>
          <button type="button" onClick={() => { setModalOpen(true); setFormError(''); }} className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400">
            <span aria-hidden="true" className="text-lg leading-none">+</span>
            Добавить связь
          </button>
        </div>
      </div>

      {(migrationError || actionError || membersQuery.isError || invitationsQuery.isError) && (
        <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200">
          {migrationError || actionError || (membersQuery.error instanceof Error ? membersQuery.error.message : null) || (invitationsQuery.error instanceof Error ? invitationsQuery.error.message : 'Не удалось загрузить связи.')}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {REMOTE_NAMES.map((appName: RemoteName) => {
          const shareable = SHAREABLE_APP_NAMES.includes(appName as ShareableAppName);
          return (
            <article key={appName} className={`rounded-2xl border p-5 ${shareable ? 'border-zinc-700 bg-zinc-900/50' : 'border-zinc-800/70 bg-zinc-900/20 opacity-60'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-medium text-zinc-100">{APP_LABELS[appName]}</h2>
                  <p className="mt-1 text-sm text-zinc-400">{APP_DESCRIPTIONS[appName]}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${shareable ? 'bg-teal-400/10 text-teal-200' : 'bg-zinc-800 text-zinc-500'}`}>
                  {shareable ? 'Доступно' : 'Скоро'}
                </span>
              </div>
              {!shareable && <p className="mt-4 text-xs text-zinc-500">Совместный доступ пока не подключён</p>}
            </article>
          );
        })}
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Подключённые пользователи</h2>
            <p className="mt-1 text-sm text-zinc-400">Права отображаются отдельно для каждого доступного приложения.</p>
          </div>
        </div>

        {activeInvitations.length > 0 && (
          <div className="mt-4 space-y-3">
            {activeInvitations.map((invitation) => {
              const peer = peerFor(invitation, user!.uid);
              return (
                <article key={invitation.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-zinc-100">{displayName(peer.uid, peer.email)}</p>
                      {displayName(peer.uid, '') && <p className="mt-0.5 text-sm text-zinc-500">{peer.email}</p>}
                    </div>
                    <button type="button" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate(invitation.id)} className="rounded-lg border border-rose-500/30 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-50">
                      Отменить связь
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {Object.entries(invitation.apps).map(([appName, role]) => (
                      <span key={appName} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300">
                        {APP_ACCESS[appName as ShareableAppName]?.label}: {role === 'edit' ? 'редактирование' : 'просмотр'}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {legacyMembers.length > 0 && (
          <article className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-medium text-zinc-100">Старая общая связь</p>
                <p className="mt-1 text-sm text-zinc-400">Эти аккаунты уже были объединены в базе. Для них сохранён полный доступ к покупкам и платежам.</p>
                <p className="mt-3 text-sm text-zinc-300">{legacyMembers.map((member) => member.profile?.displayName || member.email).join(' · ')}</p>
              </div>
              <button type="button" disabled={legacyBusy} onClick={() => void handleLeaveLegacy()} className="rounded-lg border border-amber-500/30 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/10 disabled:opacity-50">
                {legacyBusy ? 'Отключение…' : 'Отключиться'}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {SHAREABLE_APP_NAMES.map((appName) => (
                <span key={appName} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300">{APP_ACCESS[appName].label}: редактирование</span>
              ))}
            </div>
          </article>
        )}

        {activeInvitations.length === 0 && legacyMembers.length === 0 && !membersQuery.isLoading && (
          <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
            Пока нет подключённых пользователей. Создайте приглашение, чтобы поделиться приложением.
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="connection-dialog-title" className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="connection-dialog-title" className="text-xl font-semibold text-zinc-100">Новое объединение</h2>
                <p className="mt-1 text-sm text-zinc-400">Приглашение появится у человека в запросах.</p>
              </div>
              <button type="button" aria-label="Закрыть" onClick={() => setModalOpen(false)} className="rounded-lg px-2 py-1 text-xl text-zinc-500 hover:bg-zinc-800">×</button>
            </div>
            <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-5">
              <label className="block space-y-2 text-sm text-zinc-300">
                <span>Логин (email)</span>
                <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400" />
              </label>
              <fieldset className="space-y-3">
                <legend className="mb-2 text-sm font-medium text-zinc-200">Приложения и права</legend>
                {SHAREABLE_APP_NAMES.map((appName) => {
                  const role = selectedApps[appName];
                  return (
                    <div key={appName} className="rounded-xl border border-zinc-800 p-4">
                      <label className="flex items-start gap-3">
                        <input type="checkbox" checked={Boolean(role)} onChange={(event) => updateRole(appName, event.target.checked ? 'edit' : null)} className="mt-1 accent-violet-500" />
                        <span><span className="block text-sm font-medium text-zinc-100">{APP_ACCESS[appName].label}</span><span className="mt-0.5 block text-xs text-zinc-500">{APP_ACCESS[appName].description}</span></span>
                      </label>
                      {role && <div className="mt-3 flex gap-2 pl-7">
                        {(['view', 'edit'] as const).map((value) => (
                          <label key={value} className={`cursor-pointer rounded-lg border px-3 py-2 text-xs ${role === value ? 'border-violet-400/60 bg-violet-400/10 text-violet-200' : 'border-zinc-700 text-zinc-400'}`}>
                            <input type="radio" name={`role-${appName}`} value={value} checked={role === value} onChange={() => updateRole(appName, value)} className="sr-only" />
                            {value === 'view' ? 'Просмотр' : 'Редактирование'}
                          </label>
                        ))}
                      </div>}
                    </div>
                  );
                })}
              </fieldset>
              {formError && <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{formError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-900">Отмена</button>
                <button type="submit" disabled={sendMutation.isPending || !Object.keys(selectedApps).length} className="rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-50">{sendMutation.isPending ? 'Отправка…' : 'Отправить приглашение'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
