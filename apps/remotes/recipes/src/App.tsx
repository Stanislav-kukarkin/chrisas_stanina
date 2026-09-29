import { useAuth } from '@chrisasstanina/auth';

export default function App() {
  const { user } = useAuth();

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
      <p className="text-sm uppercase tracking-wide text-violet-400">Приложение</p>
      <h1 className="mt-2 text-3xl font-semibold text-zinc-100">Рецепты</h1>
      <p className="mt-4 text-zinc-400">Скоро здесь — любимые рецепты и меню.</p>
      {user && <p className="mt-6 text-sm text-zinc-500">Вы вошли как {user.email}</p>}
    </div>
  );
}
