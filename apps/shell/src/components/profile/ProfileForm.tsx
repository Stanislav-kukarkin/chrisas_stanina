import { FormEvent, useState } from 'react';
import { PROFILE_COLORS, PROFILE_EMOJIS, type UserProfileInput } from '@chrisasstanina/firebase';

interface ProfileFormProps {
  initialValues: UserProfileInput;
  submitLabel: string;
  onSubmit: (values: UserProfileInput) => Promise<void>;
  showPreview?: boolean;
}

export function ProfileForm({
  initialValues,
  submitLabel,
  onSubmit,
  showPreview = false,
}: ProfileFormProps) {
  const [values, setValues] = useState<UserProfileInput>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!values.displayName.trim()) {
      setError('Введите имя.');
      return;
    }

    if (!values.emoji) {
      setError('Выберите аватар.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        displayName: values.displayName.trim(),
        emoji: values.emoji,
        color: values.color,
      });
    } catch {
      setError('Не удалось сохранить профиль.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {showPreview && (
        <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
            style={{ backgroundColor: `${values.color}33` }}
          >
            {values.emoji || '👤'}
          </span>
          <div>
            <p className="font-medium text-zinc-100">{values.displayName || 'Ваше имя'}</p>
            <p className="text-sm text-zinc-500">Так вас увидят в списке покупок</p>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="displayName" className="mb-1 block text-sm text-zinc-300">
          Имя
        </label>
        <input
          id="displayName"
          value={values.displayName}
          onChange={(event) => setValues((prev) => ({ ...prev, displayName: event.target.value }))}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
          placeholder="Как к вам обращаться"
          required
        />
      </div>

      <div>
        <p className="mb-2 text-sm text-zinc-300">аватар</p>
        <div className="flex flex-wrap gap-2">
          {PROFILE_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setValues((prev) => ({ ...prev, emoji }))}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xl transition ${
                values.emoji === emoji
                  ? 'border-violet-500 bg-violet-500/20'
                  : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm text-zinc-300">Цвет метки</p>
        <div className="flex flex-wrap gap-2">
          {PROFILE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setValues((prev) => ({ ...prev, color }))}
              className={`h-8 w-8 rounded-full border-2 transition ${
                values.color === color ? 'border-white scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
              aria-label={`Цвет ${color}`}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-violet-600 px-4 py-2 font-medium text-white transition hover:bg-violet-500 disabled:opacity-60"
      >
        {submitting ? 'Сохранение...' : submitLabel}
      </button>
    </form>
  );
}
