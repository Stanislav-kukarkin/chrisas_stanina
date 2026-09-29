import { Link } from 'react-router-dom';
import { useAuth } from '@chrisasstanina/auth';
import {
  getDefaultFamilyId,
  useUpdateProfile,
  useUserBootstrap,
  useUserProfile,
  type UserProfileInput,
} from '@chrisasstanina/firebase';
import { ProfileForm } from '@/components/profile/ProfileForm';

interface ProfileSetupModalProps {
  onComplete: () => void;
}

export function ProfileSetupModal({ onComplete }: ProfileSetupModalProps) {
  const { user } = useAuth();
  const bootstrap = useUserBootstrap(user?.uid, user?.email ?? undefined);
  const { data: profile, isLoading: profileLoading } = useUserProfile(user?.uid);
  const updateProfile = useUpdateProfile(getDefaultFamilyId());

  if (!user) {
    return null;
  }

  const isReady = bootstrap.isSuccess && !profileLoading;

  const initialValues: UserProfileInput = {
    displayName: profile?.displayName ?? '',
    emoji: profile?.emoji ?? '',
    color: profile?.color ?? '#8b5cf6',
  };

  async function handleSubmit(values: UserProfileInput) {
    await updateProfile.mutateAsync({
      uid: user!.uid,
      email: user!.email ?? '',
      input: values,
    });
    onComplete();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-zinc-100">Заполните профиль</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Укажите имя и аватар — так вас будут видеть в семейных приложениях.
        </p>

        <div className="mt-6">
          {!isReady ? (
            <p className="text-center text-sm text-zinc-500">Подготовка профиля...</p>
          ) : (
            <ProfileForm
              key={profile?.id ?? 'setup-profile'}
              initialValues={initialValues}
              submitLabel="Сохранить и продолжить"
              onSubmit={handleSubmit}
            />
          )}
        </div>

        <p className="mt-4 text-center text-xs text-zinc-500">
          <Link to="/settings" className="text-violet-400 hover:text-violet-300">
            Подробные настройки профиля
          </Link>
        </p>
      </div>
    </div>
  );
}
