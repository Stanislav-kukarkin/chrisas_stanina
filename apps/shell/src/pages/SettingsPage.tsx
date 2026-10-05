import { useAuth } from '@chrisasstanina/auth';
import {
  getDefaultFamilyId,
  useUpdateProfile,
  useUserBootstrap,
  useUserProfile,
  type UserProfileInput,
} from '@chrisasstanina/firebase';
import { ProfileForm } from '@/components/profile/ProfileForm';

export function SettingsPage() {
  const { user } = useAuth();
  const bootstrap = useUserBootstrap(user?.uid, user?.email ?? undefined);
  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
    error: profileFetchError,
    refetch,
  } = useUserProfile(user?.uid);
  const updateProfile = useUpdateProfile(getDefaultFamilyId());

  if (!user) {
    return null;
  }

  const waitingForBootstrap = bootstrap.isLoading || bootstrap.isFetching;
  const waitingForProfile = profileLoading && profile === undefined;

  if (waitingForBootstrap || waitingForProfile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-400">
        Загрузка профиля...
      </div>
    );
  }

  if (bootstrap.isError || profileError) {
    const requestError = bootstrap.error ?? profileFetchError;
    const errorMessage =
      (requestError instanceof Error ? requestError.message : null) ??
      (profileError ? 'Ошибка чтения профиля из Firestore' : null);
    const errorCode =
      requestError && typeof requestError === 'object' && 'code' in requestError
        ? String(requestError.code)
        : '';
    const offline =
      errorCode === 'unavailable' ||
      errorMessage?.toLowerCase().includes('client is offline') ||
      errorMessage?.toLowerCase().includes('network');
    const guidance = offline
      ? 'Нет соединения с Firebase. Проверьте интернет, VPN или прокси, затем попробуйте снова.'
      : errorCode === 'permission-denied'
        ? 'Доступ запрещён правилами Firestore. Проверьте Firestore Rules в Firebase Console.'
        : 'Проверьте подключение к Firebase и попробуйте снова.';

    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-red-400">Не удалось загрузить профиль.</p>
        {errorMessage ? (
          <p className="mt-2 text-xs text-zinc-600">{errorMessage}</p>
        ) : null}
        <p className="mt-2 text-sm text-zinc-500">{guidance}</p>
        <button
          type="button"
          onClick={() => {
            void bootstrap.refetch();
            void refetch();
          }}
          className="mt-4 text-sm text-violet-400 hover:text-violet-300"
        >
          Повторить
        </button>
      </div>
    );
  }

  const initialValues: UserProfileInput = {
    displayName: profile?.displayName ?? '',
    emoji: profile?.emoji ?? '',
    color: profile?.color ?? '#8b5cf6',
  };

  async function handleSubmit(values: UserProfileInput) {
    await updateProfile.mutateAsync({
      uid: user.uid,
      email: user.email ?? '',
      input: values,
    });
  }

  return (
    <section className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-zinc-100">Настройки профиля</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Имя и аватар отображаются в семейных приложениях вместо email.
      </p>

      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <ProfileForm
          key={profile?.updatedAt?.getTime() ?? profile?.id ?? 'new-profile'}
          initialValues={initialValues}
          submitLabel="Сохранить изменения"
          onSubmit={handleSubmit}
          showPreview
        />
      </div>
    </section>
  );
}
