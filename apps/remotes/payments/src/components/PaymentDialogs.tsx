import { useState, type ReactNode } from 'react';
import { usePaymentsActions } from '../lib/repository';
import {
  BANK_COLORS,
  BANK_ICONS,
  GROUP_COLORS,
  GROUP_ICONS,
  localDateIso,
  type Payment,
  type PaymentGroup,
  type PaymentSettings,
} from '../lib/domain';
import { SelectControl } from './SelectControl';

export type ModalState =
  | { type: 'group'; group?: PaymentGroup }
  | { type: 'payment'; groupId: string; payment?: Payment }
  | { type: 'settings' }
  | { type: 'delete-group'; group: PaymentGroup }
  | { type: 'delete-payment'; payment: Payment };

export const inputClass =
  'w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-teal-500/60';

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl sm:rounded-3xl sm:p-7"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-zinc-400 hover:bg-zinc-800"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
function PrimaryButton({
  children,
  ...props
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button
      {...props}
      className="rounded-xl bg-teal-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-teal-300 disabled:cursor-wait disabled:opacity-50"
    >
      {children}
    </button>
  );
}
function SecondaryButton({
  children,
  ...props
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      {...props}
      className="rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-300 transition hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

export function Dialog({
  state,
  onClose,
  settings,
  actions,
  onDeleteGroup,
  paymentCount,
}: {
  state: ModalState;
  onClose: () => void;
  settings: PaymentSettings;
  actions: ReturnType<typeof usePaymentsActions>;
  onDeleteGroup: (group: PaymentGroup) => void;
  paymentCount: number;
}) {
  if (state.type === 'delete-group')
    return (
      <Modal title="Удалить группу?" onClose={onClose}>
        <p className="text-sm leading-6 text-zinc-400">
          {paymentCount
            ? `В группе «${state.group.name}» есть ${paymentCount} платеж(а). `
            : `Группа «${state.group.name}» будет удалена. `}
          Она и активные платежи будут скрыты, а история оплат сохранится. Удаление можно отменить
          до обновления страницы.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Отмена</SecondaryButton>
          <button
            onClick={() => onDeleteGroup(state.group)}
            className="rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white"
          >
            Удалить
          </button>
        </div>
      </Modal>
    );
  if (state.type === 'delete-payment')
    return (
      <Modal title="Удалить платеж?" onClose={onClose}>
        <p className="text-sm leading-6 text-zinc-400">
          «{state.payment.name}» перестанет появляться в будущих месяцах. История оплат останется
          сохранена.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Отмена</SecondaryButton>
          <button
            onClick={() => actions.archivePayment.mutate(state.payment.id, { onSuccess: onClose })}
            className="rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white"
          >
            Удалить
          </button>
        </div>
      </Modal>
    );
  if (state.type === 'group')
    return (
      <GroupForm
        group={state.group}
        onClose={onClose}
        onSave={(data) =>
          state.group
            ? actions.updateGroup.mutate({ id: state.group.id, ...data }, { onSuccess: onClose })
            : actions.createGroup.mutate(data, { onSuccess: onClose })
        }
      />
    );
  if (state.type === 'payment')
    return (
      <PaymentForm
        payment={state.payment}
        groupId={state.groupId}
        settings={settings}
        onClose={onClose}
        onSave={(data) =>
          state.payment
            ? actions.updatePayment.mutate(
                { id: state.payment.id, ...data },
                { onSuccess: onClose },
              )
            : actions.createPayment.mutate(data, { onSuccess: onClose })
        }
      />
    );
  return (
    <SettingsForm
      settings={settings}
      onClose={onClose}
      onSave={(next) => actions.saveSettings.mutate(next, { onSuccess: onClose })}
    />
  );
}
function GroupForm({
  group,
  onClose,
  onSave,
}: {
  group?: PaymentGroup;
  onClose: () => void;
  onSave: (data: Omit<PaymentGroup, 'id' | 'isArchived' | 'createdOn'>) => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [icon, setIcon] = useState(group?.icon ?? GROUP_ICONS[0]);
  const [color, setColor] = useState(group?.color ?? GROUP_COLORS[0]);
  return (
    <Modal title={group ? 'Изменить группу' : 'Новая группа'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave({ name: name.trim(), icon, color });
        }}
        className="space-y-5"
      >
        <Field label="Название группы">
          <input
            autoFocus
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Например, Квартира"
          />
        </Field>
        <Field label="Иконка">
          <div className="flex flex-wrap gap-2">
            {GROUP_ICONS.map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setIcon(value)}
                className={`grid h-11 w-11 place-items-center rounded-xl border text-xl ${icon === value ? 'border-teal-300 bg-teal-300/10' : 'border-zinc-700 bg-zinc-900'}`}
              >
                {value}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Цвет">
          <div className="flex gap-3">
            {GROUP_COLORS.map((value) => (
              <button
                type="button"
                aria-label={`Цвет ${value}`}
                key={value}
                onClick={() => setColor(value)}
                className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-zinc-950 ${color === value ? 'ring-2 ring-white' : ''}`}
                style={{ backgroundColor: value }}
              />
            ))}
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Отмена</SecondaryButton>
          <PrimaryButton type="submit">{group ? 'Сохранить' : 'Создать группу'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
function PaymentForm({
  payment,
  groupId,
  settings,
  onClose,
  onSave,
}: {
  payment?: Payment;
  groupId: string;
  settings: PaymentSettings;
  onClose: () => void;
  onSave: (data: Omit<Payment, 'id' | 'isArchived' | 'createdOn'>) => void;
}) {
  const [name, setName] = useState(payment?.name ?? '');
  const [amount, setAmount] = useState(payment?.amount?.toString() ?? '');
  const [monthly, setMonthly] = useState(payment?.isMonthly ?? true);
  const [day, setDay] = useState(String(payment?.paymentDay ?? new Date().getDate()));
  const [dueDate, setDueDate] = useState(payment?.dueDate ?? localDateIso());
  const [bankId, setBankId] = useState(payment?.bankId ?? settings.defaultBankId ?? '');
  return (
    <Modal title={payment ? 'Изменить платеж' : 'Новый платеж'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSave({
            groupId,
            name: name.trim(),
            amount: amount.trim() ? Number(amount) : null,
            paymentDay: Math.max(1, Math.min(31, Number(day) || 1)),
            dueDate: monthly ? null : dueDate,
            isMonthly: monthly,
            bankId: bankId || null,
          });
        }}
        className="space-y-4"
      >
        <Field label="Название">
          <input
            autoFocus
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Интернет"
          />
        </Field>
        <Field label="Сумма, ₽">
          <input
            inputMode="decimal"
            type="number"
            min="0"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
            placeholder="Не указана"
          />
        </Field>
        <label className="flex items-center gap-3 rounded-xl bg-zinc-900 px-3.5 py-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={monthly}
            onChange={(e) => setMonthly(e.target.checked)}
            className="accent-teal-400"
          />
          Ежемесячный платеж
        </label>
        {monthly ? (
          <Field label="Число месяца (1–31)">
            <input
              type="number"
              min="1"
              max="31"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className={inputClass}
            />
          </Field>
        ) : (
          <Field label="Дата платежа">
            <input
              required
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </Field>
        )}
        <Field label="Банк по умолчанию">
          <SelectControl value={bankId} onChange={(e) => setBankId(e.target.value)} className={inputClass}>
            <option value="">Не выбран</option>
            {settings.banks
              .filter((bank) => !bank.isArchived || bank.id === payment?.bankId)
              .map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.icon} {bank.name}
                  {bank.isArchived ? ' (архивный)' : ''}
                </option>
              ))}
          </SelectControl>
        </Field>
        <p className="text-xs leading-5 text-zinc-600">
          Изменение ежемесячного шаблона сохраняет уже записанные оплаты.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Отмена</SecondaryButton>
          <PrimaryButton type="submit">{payment ? 'Сохранить' : 'Добавить'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
function SettingsForm({
  settings,
  onClose,
  onSave,
}: {
  settings: PaymentSettings;
  onClose: () => void;
  onSave: (settings: PaymentSettings) => void;
}) {
  const [banks, setBanks] = useState(settings.banks);
  const [defaultBankId, setDefaultBankId] = useState(settings.defaultBankId ?? '');
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState(BANK_ICONS[0]);
  const [newColor, setNewColor] = useState(BANK_COLORS[0]);
  const addBank = () => {
    if (!newName.trim()) return;
    const bank = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      icon: newIcon,
      color: newColor,
      isArchived: false,
    };
    setBanks((list) => [...list, bank]);
    setNewName('');
  };
  return (
    <Modal title="Настройки банков" onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-2xl border border-zinc-800 p-3">
          <Field label="Название нового банка">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={inputClass}
              placeholder="Например, Сбер"
            />
          </Field>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              {BANK_ICONS.map((icon) => (
                <button
                  type="button"
                  key={icon}
                  onClick={() => setNewIcon(icon)}
                  aria-pressed={newIcon === icon}
                  className={`rounded-lg border px-2 py-1 ${newIcon === icon ? 'border-teal-300' : 'border-zinc-700'}`}
                >
                  {icon}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {BANK_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  aria-label={`Цвет нового банка ${color}`}
                  aria-pressed={newColor === color}
                  onClick={() => setNewColor(color)}
                  className={`h-5 w-5 rounded-full ${newColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="mt-4">
            <PrimaryButton onClick={addBank} type="button" disabled={!newName.trim()}>
              ＋ Добавить банк
            </PrimaryButton>
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-medium text-zinc-300">Банки</h3>
          <div className="space-y-2">
            {banks.length === 0 && (
              <p className="rounded-xl border border-dashed border-zinc-800 px-3 py-4 text-sm text-zinc-500">
                Пока банков нет. Добавьте банк выше — весь список сохранится одной кнопкой.
              </p>
            )}
            {banks.map((bank) => (
              <div
                key={bank.id}
                className={`rounded-xl bg-zinc-900 p-3 ${bank.isArchived ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg" style={{ backgroundColor: `${bank.color}30` }}>
                    {bank.icon}
                  </span>
                  <input
                    aria-label={`Название банка ${bank.name}`}
                    value={bank.name}
                    maxLength={40}
                    onChange={(event) => setBanks((list) => list.map((item) => item.id === bank.id ? { ...item, name: event.target.value } : item))}
                    className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-teal-500/60"
                  />
                  {bank.isArchived ? (
                    <button
                      type="button"
                      className="shrink-0 text-xs text-teal-300"
                      onClick={() => setBanks((list) => list.map((item) => item.id === bank.id ? { ...item, isArchived: false } : item))}
                    >
                      Вернуть
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="shrink-0 text-xs text-zinc-500 hover:text-rose-300"
                      onClick={() => {
                        setBanks((list) => list.map((item) => item.id === bank.id ? { ...item, isArchived: true } : item));
                        if (defaultBankId === bank.id) setDefaultBankId('');
                      }}
                    >
                      В архив
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-1.5" aria-label={`Иконка банка ${bank.name}`}>
                    {BANK_ICONS.map((icon) => (
                      <button
                        type="button"
                        key={icon}
                        aria-label={`Выбрать иконку ${icon}`}
                        aria-pressed={bank.icon === icon}
                        onClick={() => setBanks((list) => list.map((item) => item.id === bank.id ? { ...item, icon } : item))}
                        className={`grid h-8 w-8 place-items-center rounded-lg border ${bank.icon === icon ? 'border-teal-300 bg-teal-300/10' : 'border-zinc-800'}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2" aria-label={`Цвет банка ${bank.name}`}>
                    {BANK_COLORS.map((color) => (
                      <button
                        type="button"
                        key={color}
                        aria-label={`Выбрать цвет ${color}`}
                        aria-pressed={bank.color === color}
                        onClick={() => setBanks((list) => list.map((item) => item.id === bank.id ? { ...item, color } : item))}
                        className={`h-5 w-5 rounded-full ${bank.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : ''}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Field label="Основной банк для новых платежей">
          <SelectControl
            value={defaultBankId}
            onChange={(e) => setDefaultBankId(e.target.value)}
            className={inputClass}
          >
            <option value="">Не выбран</option>
            {banks
              .filter((bank) => !bank.isArchived)
              .map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.icon} {bank.name}
                </option>
              ))}
          </SelectControl>
        </Field>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Отмена</SecondaryButton>
          <PrimaryButton onClick={() => onSave({ banks, defaultBankId: defaultBankId || null })}>
            Сохранить
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
