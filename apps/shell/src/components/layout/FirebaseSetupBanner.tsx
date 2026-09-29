import { isFirebaseReady } from '@chrisasstanina/firebase';

export function FirebaseSetupBanner() {
  if (isFirebaseReady()) {
    return null;
  }

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
      Firebase не настроен — главная работает, но вход и приложения недоступны. Создайте{' '}
      <code className="rounded bg-amber-500/20 px-1">.env</code> из{' '}
      <code className="rounded bg-amber-500/20 px-1">.env.example</code> и перезапустите{' '}
      <code className="rounded bg-amber-500/20 px-1">npm run dev</code>.
    </div>
  );
}
