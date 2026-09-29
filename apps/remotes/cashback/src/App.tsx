import { getFirebaseConfigFromEnv, initializeFirebase, useFirebaseUser } from '@chrisasstanina/firebase';

initializeFirebase(getFirebaseConfigFromEnv());

export default function App() {
  const user = useFirebaseUser();

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
      <p className="text-sm uppercase tracking-wide text-violet-400">Приложение</p>
      <h1 className="mt-2 text-3xl font-semibold text-zinc-100">Кэшбеки</h1>
      <p className="mt-4 text-zinc-400">
        Скоро здесь — распознавание и учёт кэшбеков. Планируется миграция из Expo/React Native
        проекта.
      </p>
      <p className="mt-3 text-sm text-amber-400/90">
        TODO: интеграция Expo Web remote после переноса существующего мобильного приложения.
      </p>
      {user && <p className="mt-6 text-sm text-zinc-500">Вы вошли как {user.email}</p>}
    </div>
  );
}
