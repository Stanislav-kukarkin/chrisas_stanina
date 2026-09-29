import { useEffect, useState } from 'react';
import {
  DEFAULT_SALARY_SETTINGS,
  getWorkDurationMinutes,
  type SalarySettings,
  type SalaryVisualizationType,
} from '@chrisasstanina/salary-flow-core';
import { GlassPanel, cn } from '@chrisasstanina/ui';
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center">
      <GlassPanel animated={false} className="w-full max-w-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-100">Настройки</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Закрыть
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Месячная зарплата</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={draft.monthlySalary || ''}
              placeholder="150000"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  monthlySalary: event.target.value === '' ? 0 : Number(event.target.value),
                }))
              }
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">Начало дня</span>
              <input
                type="time"
                value={draft.workStart}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, workStart: event.target.value }))
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-400">
                {draft.workEndsNextDay ? 'Конец (след. день)' : 'Конец дня'}
              </span>
              <input
                type="time"
                value={draft.workEnd}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, workEnd: event.target.value }))
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
              />
            </label>
          </div>

          <label className="flex items-center gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={draft.workEndsNextDay}
              onChange={(event) =>
                setDraft((current) => ({ ...current, workEndsNextDay: event.target.checked }))
              }
              className="size-4 rounded border-zinc-600"
            />
            Конец рабочего дня на следующий календарный день
          </label>

          <label className="flex items-center gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={draft.lunchEnabled}
              onChange={(event) =>
                setDraft((current) => ({ ...current, lunchEnabled: event.target.checked }))
              }
              className="size-4 rounded border-zinc-600"
            />
            Учитывать обед
          </label>

          {draft.lunchEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Начало обеда</span>
                <input
                  type="time"
                  value={draft.lunchStart}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, lunchStart: event.target.value }))
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-zinc-400">Длительность (мин)</span>
                <input
                  type="number"
                  min={1}
                  value={draft.lunchDurationMinutes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      lunchDurationMinutes: Number(event.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
                />
              </label>
            </div>
          )}

          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Валюта</span>
            <select
              value={draft.currency}
              onChange={(event) =>
                setDraft((current) => ({ ...current, currency: event.target.value }))
              }
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
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
                      className="mt-1 size-4 border-zinc-600"
                    />
                    <span>
                      <span className="block text-sm font-medium text-zinc-100">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="block space-y-1 text-sm">
            <span className="text-zinc-400">Часовой пояс</span>
            <input
              type="text"
              value={draft.timezone}
              onChange={(event) =>
                setDraft((current) => ({ ...current, timezone: event.target.value }))
              }
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center justify-between gap-3 pt-2">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={rememberChoice}
                onChange={(event) => setRememberChoice(event.target.checked)}
                className="size-4 rounded border-zinc-600"
              />
              Запомнить выбор
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDraft({ ...DEFAULT_SALARY_SETTINGS })}
                className="rounded-xl px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Сбросить
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={cn(
                  'rounded-xl bg-teal-500/20 px-4 py-2 text-sm font-medium text-teal-300',
                  'hover:bg-teal-500/30 disabled:opacity-50',
                )}
              >
                {isSaving ? 'Сохранение...' : rememberChoice ? 'Сохранить' : 'Применить'}
              </button>
            </div>
          </div>
        </form>
      </GlassPanel>
    </div>
  );
}
