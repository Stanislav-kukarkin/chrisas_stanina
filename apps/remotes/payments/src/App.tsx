import { useMemo, useState } from 'react';
import { getFirebaseConfigFromEnv, initializeFirebase } from '@chrisasstanina/firebase';
import { Aurora, BlurText, FadeIn, GlassPanel, ProgressGlow } from '@chrisasstanina/ui';
import { usePaymentsActions, usePaymentsData } from './lib/repository';
import { usePaymentsAuth } from './hooks/usePaymentsAuth';
import {
  addMonth,
  formatDate,
  isVisibleInMonth,
  money,
  monthKey,
  monthLabel,
  paymentInstance,
  type Payment,
  type PaymentGroup,
  type PaymentInstance,
  type PaymentSettings,
} from './lib/domain';
import { Dialog, inputClass, type ModalState } from './components/PaymentDialogs';
import { PaidRow, PaymentRow, Stat } from './components/PaymentRows';
import './index.css';

initializeFirebase(getFirebaseConfigFromEnv());

const blankSettings: PaymentSettings = { banks: [], defaultBankId: null };
const emptyGroups: PaymentGroup[] = [];
const emptyPayments: Payment[] = [];
const emptyCompletions: import('./lib/domain').PaymentCompletion[] = [];

export default function App() {
  const { user, loading: authLoading, firebaseReady } = usePaymentsAuth();
  const query = usePaymentsData(firebaseReady && !authLoading && Boolean(user));
  const actions = usePaymentsActions();
  const [month, setMonth] = useState(monthKey());
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [undo, setUndo] = useState<{ group: PaymentGroup; paymentIds: string[] } | null>(null);
  const [selectedBanks, setSelectedBanks] = useState<Record<string, string>>({});
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const todayKey = monthKey();
  const groups = query.data?.groups ?? emptyGroups;
  const activeGroups = groups.filter((group) => !group.isArchived);
  const payments = query.data?.payments ?? emptyPayments;
  const completions = query.data?.completions ?? emptyCompletions;
  const settings = query.data?.settings ?? blankSettings;
  const archivedHistory = completions
    .filter(
      (entry) =>
        entry.year === Number(month.slice(0, 4)) && entry.month === Number(month.slice(5, 7)),
    )
    .map((entry) => ({
      entry,
      payment: payments.find((payment) => payment.id === entry.paymentId),
      group: groups.find((group) => group.id === entry.groupId),
    }))
    .filter((row) => row.payment?.isArchived || row.group?.isArchived)
    .filter(
      ({ entry, payment, group }) =>
        !search ||
        group?.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ||
        payment?.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ||
        settings.banks
          .find((bank) => bank.id === entry.bankId)
          ?.name.toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    );
  const groupRows = useMemo(
    () =>
      activeGroups
        .map((group) => {
          const list = payments.filter(
            (payment) =>
              payment.groupId === group.id &&
              !payment.isArchived &&
              isVisibleInMonth(payment, month),
          );
          const instances = list
            .map((payment) =>
              paymentInstance(
                payment,
                month,
                new Date(),
                completions.find(
                  (entry) =>
                    entry.paymentId === payment.id &&
                    entry.year === Number(month.slice(0, 4)) &&
                    entry.month === Number(month.slice(5, 7)),
                ),
              ),
            )
            .filter((value): value is PaymentInstance => Boolean(value));
          return {
            group,
            active: instances
              .filter((value) => !value.completion)
              .sort((a, b) => a.date.localeCompare(b.date)),
            paid: instances
              .filter((value) => Boolean(value.completion))
              .sort((a, b) => a.date.localeCompare(b.date)),
          };
        })
        .filter(
          ({ group, active, paid }) =>
            !search ||
            group.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ||
            [...active, ...paid].some(
              ({ payment, completion }) =>
                payment.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ||
                settings.banks
                  .find((bank) => bank.id === (completion?.bankId ?? payment.bankId))
                  ?.name.toLocaleLowerCase()
                  .includes(search.toLocaleLowerCase()),
            ),
        ),
    [activeGroups, payments, completions, month, search, settings.banks],
  );
  const instances = [
    ...groupRows.flatMap(({ active, paid }) => [...active, ...paid]),
    ...archivedHistory.map(({ entry, payment }) => ({
      payment: payment!,
      completion: entry,
      status: 'paid' as const,
      daysUntil: 0,
      date: entry.scheduledDate,
    })),
  ];
  const paidCount = instances.filter((entry) => Boolean(entry.completion)).length;
  const plannedAmount = instances.reduce((sum, entry) => sum + (entry.payment.amount ?? 0), 0);
  const paidAmount = instances
    .filter((entry) => Boolean(entry.completion))
    .reduce((sum, entry) => sum + (entry.payment.amount ?? 0), 0);
  const moneyFmt = (amount: number) => money(amount);

  function complete(instance: PaymentInstance) {
    const bankId = selectedBanks[instance.payment.id] || instance.payment.bankId || null;
    actions.completePayment.mutate({
      paymentId: instance.payment.id,
      groupId: instance.payment.groupId,
      month,
      bankId,
      scheduledDate: instance.date,
    });
  }
  function removeGroup(group: PaymentGroup) {
    const paymentIds = payments
      .filter((payment) => payment.groupId === group.id && !payment.isArchived)
      .map((payment) => payment.id);
    actions.archiveGroup.mutate(group.id, {
      onSuccess: () => {
        setUndo({ group, paymentIds });
        setTimeout(() => setUndo(null), 7000);
      },
    });
    setModal(null);
  }
  function doUndo() {
    if (undo) {
      actions.restoreGroup.mutate({ id: undo.group.id, paymentIds: undo.paymentIds });
      setUndo(null);
    }
  }

  if (authLoading || query.isLoading)
    return (
      <div className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden">
        <Aurora />
        <div className="relative z-10 w-full max-w-3xl space-y-4 p-6">
          <div className="h-10 w-52 animate-pulse rounded-xl bg-zinc-800" />
          <div className="h-36 animate-pulse rounded-3xl bg-zinc-900" />
          <div className="h-52 animate-pulse rounded-3xl bg-zinc-900" />
        </div>
      </div>
    );
  if (!firebaseReady)
    return (
      <main className="mx-auto max-w-xl p-8 text-center">
        <p className="text-amber-200">Firebase не настроен.</p>
        <p className="mt-2 text-sm text-zinc-500">
          Заполните Firebase-переменные в .env в корне проекта и перезапустите dev-сервер.
        </p>
      </main>
    );
  if (!user) {
    const shellUrl = import.meta.env.DEV
      ? `${window.location.protocol}//${window.location.hostname}:5173/apps/payments`
      : '/apps/payments';
    return (
      <main className="mx-auto max-w-xl p-8 text-center">
        <p className="text-zinc-200">Для доступа к семейным платежам войдите в Семейный Hub.</p>
        <a href={shellUrl} className="mt-4 inline-block text-teal-300 hover:text-teal-200">
          Открыть через Семейный Hub →
        </a>
      </main>
    );
  }
  if (query.isError)
    return (
      <main className="mx-auto max-w-xl p-8 text-center">
        <p className="text-red-300">Не удалось загрузить платежи.</p>
        <p className="mt-2 text-sm text-zinc-500">
          {query.error instanceof Error ? query.error.message : String(query.error)}
        </p>
        <button className="mt-4 text-teal-300" onClick={() => query.refetch()}>
          Повторить
        </button>
      </main>
    );

  return (
    <main
      className="relative flex min-h-full flex-1 flex-col overflow-hidden"
      onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX ?? null)}
      onTouchEnd={(event) => {
        if (touchStart !== null) {
          const dx = (event.changedTouches[0]?.clientX ?? touchStart) - touchStart;
          if (Math.abs(dx) > 75) setMonth((current) => addMonth(current, dx < 0 ? 1 : -1));
        }
        setTouchStart(null);
      }}
    >
      <Aurora />
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-7 sm:px-6 sm:py-10">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-teal-300/80">
              Семейный Hub
            </p>
            <BlurText
              text="Мои платежи"
              as="h1"
              align="left"
              className="mt-1 text-3xl sm:text-4xl"
            />
          </div>
          <button
            type="button"
            onClick={() => setModal({ type: 'settings' })}
            aria-label="Настройки банков"
            className="grid h-11 w-11 place-items-center rounded-xl border border-zinc-700 bg-zinc-900/70 text-lg text-zinc-300 hover:border-teal-400/50"
          >
            ⚙
          </button>
        </header>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
            ⌕
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-11`}
            placeholder="Поиск платежей, групп, банков"
            aria-label="Поиск платежей"
          />
        </div>
        <GlassPanel className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              aria-label="Предыдущий месяц"
              onClick={() => setMonth(addMonth(month, -1))}
              className="rounded-xl px-3 py-2 text-xl text-zinc-400 hover:bg-zinc-800"
            >
              ‹
            </button>
            <div className="text-center">
              <h2 className="text-lg font-semibold capitalize text-zinc-100">
                {monthLabel(month)}
              </h2>
              {month !== todayKey && (
                <button
                  type="button"
                  onClick={() => setMonth(todayKey)}
                  className="mt-0.5 text-xs text-teal-300 hover:text-teal-200"
                >
                  Сегодня
                </button>
              )}
            </div>
            <button
              type="button"
              aria-label="Следующий месяц"
              onClick={() => setMonth(addMonth(month, 1))}
              className="rounded-xl px-3 py-2 text-xl text-zinc-400 hover:bg-zinc-800"
            >
              ›
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Платежей" value={instances.length} />
            <Stat label="Оплачено" value={paidCount} tone="teal" />
            <Stat
              label="Скоро"
              value={instances.filter((i) => !i.completion && i.status === 'soon').length}
              tone="amber"
            />
            <Stat
              label="Просрочено"
              value={instances.filter((i) => !i.completion && i.status === 'overdue').length}
              tone="rose"
            />
          </div>
          {instances.length > 0 && (
            <>
              <ProgressGlow progress={paidCount / instances.length} className="mt-4" />
              <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-zinc-400">
                <span>
                  Запланировано <b className="text-zinc-200">{moneyFmt(plannedAmount)}</b>
                </span>
                <span>
                  Оплачено <b className="text-teal-200">{moneyFmt(paidAmount)}</b>
                </span>
                <span>
                  Осталось <b className="text-zinc-200">{moneyFmt(plannedAmount - paidAmount)}</b>
                </span>
              </div>
            </>
          )}
        </GlassPanel>
        <div className="space-y-4">
          {groupRows.map(({ group, active, paid }, index) => (
            <FadeIn key={group.id} index={index}>
              <GlassPanel className="overflow-hidden p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl"
                      style={{ backgroundColor: `${group.color}22` }}
                    >
                      {group.icon}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-zinc-100">{group.name}</h3>
                      <p className="text-xs text-zinc-500">
                        {active.length} активных · {paid.length} оплачено
                      </p>
                    </div>
                  </div>
                  <details className="relative">
                    <summary
                      className="cursor-pointer list-none rounded-lg px-3 py-2 text-xl text-zinc-400 hover:bg-zinc-800"
                      aria-label="Действия группы"
                    >
                      ⋯
                    </summary>
                    <div className="absolute right-0 top-10 z-20 min-w-40 rounded-xl border border-zinc-700 bg-zinc-900 p-1 shadow-xl">
                      <button
                        onClick={() => setModal({ type: 'group', group })}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => setModal({ type: 'delete-group', group })}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-300 hover:bg-zinc-800"
                      >
                        Удалить группу
                      </button>
                    </div>
                  </details>
                </div>
                <div className="mt-4 space-y-2">
                  {active.map((instance) => (
                    <PaymentRow
                      key={instance.payment.id}
                      instance={instance}
                      banks={settings.banks}
                      selectedBank={
                        selectedBanks[instance.payment.id] ?? instance.payment.bankId ?? ''
                      }
                      onBank={(id) =>
                        setSelectedBanks((prev) => ({ ...prev, [instance.payment.id]: id }))
                      }
                      onComplete={() => complete(instance)}
                      onEdit={() =>
                        setModal({ type: 'payment', groupId: group.id, payment: instance.payment })
                      }
                      onDelete={() =>
                        setModal({ type: 'delete-payment', payment: instance.payment })
                      }
                    />
                  ))}
                </div>
                {paid.length > 0 && (
                  <div className="mt-4 border-t border-zinc-800 pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                      }
                      className="flex w-full items-center justify-between py-1 text-sm text-zinc-400"
                    >
                      <span>Оплачено · {paid.length}</span>
                      <span>{collapsed[group.id] ? '⌄' : '⌃'}</span>
                    </button>
                    {!collapsed[group.id] && (
                      <div className="mt-2 space-y-2">
                        {paid.map((instance) => (
                          <PaidRow
                            key={instance.payment.id}
                            instance={instance}
                            banks={settings.banks}
                            onBank={(bankId) =>
                              instance.completion &&
                              actions.updateCompletionBank.mutate({
                                id: instance.completion.id,
                                bankId: bankId || null,
                              })
                            }
                            onUndo={() =>
                              instance.completion &&
                              actions.undoCompletion.mutate(instance.completion.id)
                            }
                            onEdit={() =>
                              setModal({
                                type: 'payment',
                                groupId: group.id,
                                payment: instance.payment,
                              })
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setModal({ type: 'payment', groupId: group.id })}
                  className="mt-4 w-full rounded-xl border border-dashed border-zinc-700 py-3 text-sm text-zinc-400 transition hover:border-teal-400/50 hover:text-teal-200"
                >
                  ＋ Добавить платеж
                </button>
              </GlassPanel>
            </FadeIn>
          ))}
          {!groupRows.length && (
            <GlassPanel className="p-8 text-center">
              <div className="text-4xl">🧾</div>
              <h3 className="mt-3 font-medium text-zinc-200">
                {search ? 'Ничего не найдено' : 'Пока нет платежных групп'}
              </h3>
              <p className="mt-2 text-sm text-zinc-500">
                {search
                  ? 'Измените поисковый запрос.'
                  : 'Создайте группу и добавьте первый платеж.'}
              </p>
            </GlassPanel>
          )}
        </div>
        {archivedHistory.length > 0 && (
          <GlassPanel className="p-4 sm:p-5">
            <details>
              <summary className="cursor-pointer text-sm font-medium text-zinc-400">
                История архивных платежей · {archivedHistory.length}
              </summary>
              <div className="mt-3 space-y-2">
                {archivedHistory.map(({ entry, payment, group }) => {
                  const bank = settings.banks.find((item) => item.id === entry.bankId);
                  return (
                    <div key={entry.id} className="rounded-xl bg-zinc-950/50 px-3.5 py-3">
                      <p className="text-sm text-zinc-300">
                        ✓ {payment?.name ?? 'Удаленный платеж'}{' '}
                        <span className="text-zinc-500">· {group?.name ?? 'Архивная группа'}</span>
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">
                        {formatDate(entry.scheduledDate)} · оплачено {formatDate(entry.paidOn)} ·{' '}
                        {bank
                          ? `${bank.icon} ${bank.name}${bank.isArchived ? ' (архивный)' : ''}`
                          : 'банк не указан'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </details>
          </GlassPanel>
        )}
        <button
          type="button"
          onClick={() => setModal({ type: 'group' })}
          className="self-center rounded-2xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-white"
        >
          ＋ Добавить группу
        </button>
        {user?.email && (
          <p className="pb-4 text-center text-xs text-zinc-600">
            Данные доступны участникам вашей семьи
          </p>
        )}
      </div>
      {undo && (
        <div className="fixed inset-x-3 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 shadow-xl">
          <span className="text-sm text-zinc-200">Группа «{undo.group.name}» удалена</span>
          <button onClick={doUndo} className="text-sm font-semibold text-teal-300">
            Отменить
          </button>
        </div>
      )}
      {modal && (
        <Dialog
          state={modal}
          onClose={() => setModal(null)}
          paymentCount={
            modal.type === 'delete-group'
              ? payments.filter(
                  (payment) => payment.groupId === modal.group.id && !payment.isArchived,
                ).length
              : 0
          }
          settings={settings}
          actions={actions}
          onDeleteGroup={removeGroup}
        />
      )}
    </main>
  );
}
