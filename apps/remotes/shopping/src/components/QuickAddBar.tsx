import { FormEvent, useState } from 'react';

interface QuickAddBarProps {
  onAdd: (name: string) => Promise<void>;
  disabled?: boolean;
}

export function QuickAddBar({ onAdd, disabled }: QuickAddBarProps) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const name = value.trim();
    if (!name || submitting || disabled) {
      return;
    }

    setSubmitting(true);
    try {
      await onAdd(name);
      setValue('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Добавте товар"
        disabled={disabled || submitting}
        className="flex-1 rounded-xl border border-zinc-700/80 bg-zinc-950/60 px-4 py-3 text-zinc-100 outline-none placeholder:text-zinc-500 transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
      />
      <button
        type="submit"
        disabled={disabled || submitting || !value.trim()}
        className="rounded-xl bg-violet-600 px-5 py-3 font-medium text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:opacity-50"
      >
        +
      </button>
    </form>
  );
}
