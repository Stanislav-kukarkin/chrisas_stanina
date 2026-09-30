import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DEFAULT_SALARY_SETTINGS,
  getWorkDurationMinutes,
  type SalarySettings,
  type SalaryVisualizationType,
} from '@chrisasstanina/salary-flow-core';
import { cn } from '@chrisasstanina/ui';
import {
  getRememberSettingsPreference,
  setRememberSettingsPreference,
} from '../lib/settings-persistence';

const VISUALIZATION_OPTIONS: Array<{
  value: SalaryVisualizationType;
  label: string;
  description: string;
}> = [
  { value: 'money-jar', label: 'Банка', description: 'Монеты падают в банку' },
  { value: 'xp-bar', label: 'XP-бар', description: 'Опыт за день, как в игре' },
  { value: 'ticker-tape', label: 'Бегущая строка', description: 'Стиль биржи, +₽/сек' },
];

interface SettingsModalProps {
  open: boolean;
  draftSettings: SalarySettings;
  userId?: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (update: SalarySettings, options: { remember: boolean }) => Promise<void>;
}

function validateSettings(settings: SalarySettings): string | null {
  if (settings.monthlySalary < 0) {
    return 'Зарплата не может быть отрицательной';
  }
  const hasWorkTimes = Boolean(settings.workStart.trim() && settings.workEnd.trim());
  if (hasWorkTimes) {
    const workMinutes = getWorkDurationMinutes(settings);
    if (workMinutes <= 0) {
      return 'Проверьте время начала и окончания рабочего дня';
    }
    if (workMinutes > 16 * 60) {
      return 'Рабочий день не может быть длиннее 16 часов';
    }
    if (!settings.workEndsNextDay && settings.workStart >= settings.workEnd) {
      return 'Начало должно быть раньше окончания или включите «конец на следующий день»';
    }
  }
  if (settings.lunchEnabled && settings.lunchDurationMinutes <= 0) {
    return 'Длительность обеда должна быть больше нуля';
  }
  return null;
}

const fieldClassName =
  'w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-base text-zinc-100 sm:text-sm';

export function SettingsModal({
  open,
  draftSettings,
  userId,
  isSaving,
  onClose,
  onSave,
}: SettingsModalProps) {
  const [draft, setDraft] = useState(draftSettings);
  const [rememberChoice, setRememberChoice] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(draftSettings);
      setRememberChoice(getRememberSettingsPreference(userId));
      setError(null);
    }
  }, [draftSettings, open, userId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validateSettings(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setRememberSettingsPreference(userId, rememberChoice);
    await onSave(draft, { remember: rememberChoice });
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="salary-settings-title"
    >
      <button
        type="button"
        aria-label="Закрыть настройки"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-800 bg-zinc-900/95 shadow-2xl md:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 px-4 py-3 sm:px-6">
          <h2 id="salary-settings-title" className="text-lg font-medium text-zinc-100">
            Настройки
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Закрыть
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-6">
            <label className="block space-y-1.5 text-sm">
              <span className="text-zinc-400">Месячная зарплата</span>
              <input
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                value={draft.monthlySalary || ''}
                placeholder="150000"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    monthlySalary: event.target.value === '' ? 0 : Number(event.target.value),
                  }))
                }
                className={fieldClassName}
              />
            </label>

            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <label className="block space-y-1.5 text-sm">
                <span className="text-zinc-400">Начало дня</span>
                <input
                  type="time"
                  value={draft.workStart}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, workStart: event.target.value }))
                  }
                  className={fieldClassName}
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="text-zinc-400">
                  {draft.workEndsNextDay ? 'Конец (след. день)' : 'Конец дня'}
                </span>
                <input
                  type="time"
                  value={draft.workEnd}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, workEnd: event.target.value }))
                  }
                  className={fieldClassName}
                />
              </label>
            </div>

            <label className="flex items-start gap-3 text-sm leading-snug text-zinc-300">
              <input
                type="checkbox"
                checked={draft.workEndsNextDay}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, workEndsNextDay: event.target.checked }))
                }
                className="mt-0.5 size-4 shrink-0 rounded border-zinc-600"
              />
              Конец рабочего дня на следующий календарный день
            </label>

            <label className="flex items-start gap-3 text-sm leading-snug text-zinc-300">
              <input
                type="checkbox"
                checked={draft.lunchEnabled}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, lunchEnabled: event.target.checked }))
                }
                className="mt-0.5 size-4 shrink-0 rounded border-zinc-600"
              />
              Учитывать обед
            </label>

            {draft.lunchEnabled && (
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                <label className="block space-y-1.5 text-sm">
                  <span className="text-zinc-400">Начало обеда</span>
                  <input
                    type="time"
                    value={draft.lunchStart}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, lunchStart: event.target.value }))
                    }
                    className={fieldClassName}
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-zinc-400">Длительность (мин)</span>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={draft.lunchDurationMinutes}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        lunchDurationMinutes: Number(event.target.value),
                      }))
                    }
                    className={fieldClassName}
                  />
                </label>
              </div>
            )}

            <label className="block space-y-1.5 text-sm">
              <span className="text-zinc-400">Валюта</span>
              <select
                value={draft.currency}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, currency: event.target.value }))
                }
                className={fieldClassName}
              >
                <option value="RUB">₽ RUB</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
              </select>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm text-zinc-400">Виджет прогресса</legend>
              <div className="space-y-2">
                {VISUALIZATION_OPTIONS.map((option) => {
                  const isSelected = draft.visualizationType === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition',
                        isSelected
                          ? 'border-teal-500/50 bg-teal-500/10'
                          : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600',
                      )}
                    >
                      <input
                        type="radio"
                        name="visualizationType"
                        value={option.value}
                        checked={isSelected}
                        onChange={() =>
                          setDraft((current) => ({
                            ...current,
                            visualizationType: option.value,
                          }))
                        }
                        className="mt-1 size-4 shrink-0 border-zinc-600"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-zinc-100">{option.label}</span>
                        <span className="mt-0.5 block text-xs text-zinc-500">{option.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <label className="block space-y-1.5 text-sm">
              <span className="text-zinc-400">Часовой пояс</span>
              <input
                type="text"
                value={draft.timezone}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, timezone: event.target.value }))
                }
                className={fieldClassName}
              />
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          <div className="shrink-0 space-y-3 border-t border-zinc-800/80 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={rememberChoice}
                onChange={(event) => setRememberChoice(event.target.checked)}
                className="size-4 rounded border-zinc-600"
              />
              Запомнить выбор
            </label>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDraft({ ...DEFAULT_SALARY_SETTINGS })}
                className="rounded-xl px-4 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 sm:py-2"
              >
                Сбросить
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={cn(
                  'rounded-xl bg-teal-500/20 px-4 py-2.5 text-sm font-medium text-teal-300',
                  'hover:bg-teal-500/30 disabled:opacity-50 sm:py-2',
                )}
              >
                {isSaving ? 'Сохранение...' : rememberChoice ? 'Сохранить' : 'Применить'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
