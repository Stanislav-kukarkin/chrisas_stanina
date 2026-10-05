import { formatDate, money, type PaymentBank, type PaymentInstance } from '../lib/domain';
import { SelectControl } from './SelectControl';
export function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  const color =
    tone === 'teal'
      ? 'text-teal-300'
      : tone === 'amber'
        ? 'text-amber-300'
        : tone === 'rose'
          ? 'text-rose-300'
          : 'text-zinc-100';
  return (
    <div className="rounded-xl bg-zinc-900/75 px-3 py-2.5">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}
export function PaymentRow({
  instance,
  banks,
  selectedBank,
  onBank,
  onComplete,
  onEdit,
  onDelete,
  readOnly = false,
}: {
  instance: PaymentInstance;
  banks: PaymentBank[];
  selectedBank: string;
  onBank: (id: string) => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}) {
  const { payment, date, status, daysUntil } = instance;
  const statusLabel =
    status === 'overdue'
      ? `Просрочен на ${Math.abs(daysUntil)} дн.`
      : status === 'soon'
        ? daysUntil === 0
          ? 'Сегодня'
          : daysUntil === 1
            ? 'Завтра'
            : `Через ${daysUntil} дн.`
        : '';
  return (
    <div
      className={`rounded-2xl border p-3.5 ${status === 'overdue' ? 'border-rose-500/30 bg-rose-500/[0.06]' : status === 'soon' ? 'border-amber-500/25 bg-amber-500/[0.04]' : 'border-zinc-800 bg-zinc-950/35'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${status === 'overdue' ? 'bg-rose-400' : status === 'soon' ? 'bg-amber-300' : 'bg-zinc-600'}`}
            />
            <p className="truncate font-medium text-zinc-100">{payment.name}</p>
          </div>
          <p className="mt-1 pl-4 text-xs text-zinc-500">
            {formatDate(date)}
            {statusLabel && (
              <span className={`ml-2 ${status === 'overdue' ? 'text-rose-300' : 'text-amber-200'}`}>
                {statusLabel}
              </span>
            )}
            {payment.amount !== null && (
              <span className="ml-2 text-zinc-400">· {money(payment.amount)}</span>
            )}
          </p>
        </div>
        {!readOnly && <details className="relative">
          <summary className="list-none cursor-pointer px-1.5 text-lg text-zinc-500">⋯</summary>
          <div className="absolute right-0 top-7 z-20 min-w-32 rounded-xl border border-zinc-700 bg-zinc-900 p-1">
            <button
              onClick={onEdit}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-zinc-800"
            >
              Изменить
            </button>
            <button
              onClick={onDelete}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs text-rose-300 hover:bg-zinc-800"
            >
              Удалить
            </button>
          </div>
        </details>}
      </div>
      {readOnly ? (
        <p className="mt-3 pl-4 text-xs text-zinc-500">
          {banks.find((bank) => bank.id === (selectedBank || payment.bankId))?.name ?? 'Банк не выбран'}
        </p>
      ) : <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <SelectControl
          aria-label={`Банк оплаты ${payment.name}`}
          value={selectedBank}
          onChange={(e) => onBank(e.target.value)}
          containerClassName="max-w-[55%]"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs text-zinc-300"
        >
          <option value="">Банк не выбран</option>
          {banks
            .filter((bank) => !bank.isArchived || bank.id === selectedBank)
            .map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.icon} {bank.name}
                {bank.isArchived ? ' (архивный)' : ''}
              </option>
            ))}
        </SelectControl>
        <button
          type="button"
          onClick={onComplete}
          className="rounded-lg bg-teal-400/10 px-3 py-2 text-xs font-semibold text-teal-200 hover:bg-teal-400/20"
        >
          ✓ Оплачено
        </button>
      </div>}
    </div>
  );
}
export function PaidRow({
  instance,
  banks,
  onBank,
  onUndo,
  onEdit,
  readOnly = false,
}: {
  instance: PaymentInstance;
  banks: PaymentBank[];
  onBank: (id: string) => void;
  onUndo: () => void;
  onEdit: () => void;
  readOnly?: boolean;
}) {
  const completion = instance.completion!;
  const bank = banks.find((entry) => entry.id === completion.bankId);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-950/40 px-3.5 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-zinc-300">
          ✓ {instance.payment.name}
          <span className="ml-2 font-semibold text-zinc-100">
            {instance.payment.amount !== null ? money(instance.payment.amount) : ''}
          </span>
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          {formatDate(completion.scheduledDate)} · оплачено {formatDate(completion.paidOn)} ·{' '}
          {bank
            ? `${bank.icon} ${bank.name}${bank.isArchived ? ' (архивный)' : ''}`
            : 'банк не указан'}
        </p>
      </div>
      {!readOnly && <div className="flex shrink-0 items-center gap-1">
        <SelectControl
          title="Изменить банк оплаты"
          aria-label="Банк фактической оплаты"
          value={completion.bankId ?? ''}
          onChange={(event) => onBank(event.target.value)}
          containerClassName="max-w-28"
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-[11px] text-zinc-500"
        >
          <option value="">Банк не указан</option>
          {banks.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
              {entry.isArchived ? ' (архивный)' : ''}
            </option>
          ))}
        </SelectControl>
        <button
          onClick={onEdit}
          title="Редактировать"
          className="rounded-lg px-2 py-2 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        >
          ✎
        </button>
        <button
          onClick={onUndo}
          title="Вернуть в активные"
          className="rounded-lg px-2 py-2 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-amber-200"
        >
          ↩
        </button>
      </div>}
    </div>
  );
}
