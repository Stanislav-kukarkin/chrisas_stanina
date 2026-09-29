import { FormEvent, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { useAuth } from './auth-context';

const ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Некорректный email.',
  'auth/user-disabled': 'Аккаунт отключён.',
  'auth/user-not-found': 'Пользователь не найден.',
  'auth/wrong-password': 'Неверный пароль.',
  'auth/invalid-credential': 'Неверный email или пароль.',
};

function mapAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    return ERROR_MESSAGES[error.code] ?? 'Не удалось войти. Попробуйте снова.';
  }
  return 'Произошла ошибка. Попробуйте снова.';
}

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { signIn, firebaseReady } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await signIn(email, password);
      onSuccess?.();
    } catch (submitError) {
      setError(mapAuthError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-zinc-300">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-zinc-300">
          Пароль
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
        />
      </div>

      {!firebaseReady && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Firebase не настроен. Скопируйте <code className="text-amber-100">.env.example</code> в{' '}
          <code className="text-amber-100">.env</code> и заполните ключи из Firebase Console.
        </p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !firebaseReady}
        className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white transition hover:bg-violet-500 disabled:opacity-60"
      >
        {submitting ? 'Вход...' : 'Войти'}
      </button>

      <p className="text-center text-xs text-zinc-500">
        Аккаунты создаются вручную в Firebase Console.
      </p>
    </form>
  );
}
