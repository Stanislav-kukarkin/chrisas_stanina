import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@chrisasstanina/auth';
import { useUserBootstrap, useUserProfile } from '@chrisasstanina/firebase';
import { FirebaseSetupBanner } from '@/components/layout/FirebaseSetupBanner';
import { ProfileDropdown } from '@/components/layout/ProfileDropdown';
import { ProfileSetupModal } from '@/components/profile/ProfileSetupModal';

export function ShellLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const bootstrap = useUserBootstrap(user?.uid, user?.email ?? undefined);
  const { data: profile, isLoading: profileLoading } = useUserProfile(user?.uid);
  const navigate = useNavigate();
  const [profileDismissed, setProfileDismissed] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  const bootstrapReady = bootstrap.isSuccess;
  const profileReady = !profileLoading || profile !== undefined;
  const onSettingsPage = location.pathname === '/settings';

  const showProfileModal =
    Boolean(user) &&
    bootstrapReady &&
    profileReady &&
    !profile?.profileComplete &&
    !profileDismissed &&
    !onSettingsPage;

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950 text-zinc-100">
      <FirebaseSetupBanner />
      <header className="sticky top-0 z-20 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center" aria-label="Chrisasstanina">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Chrisasstanina"
              className="h-9 w-9 object-contain sm:h-10 sm:w-10"
            />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-zinc-400 transition hover:text-zinc-100">
              Главная
            </Link>
            {user ? (
              <ProfileDropdown onLogout={handleLogout} />
            ) : (
              <Link
                to="/login"
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-white transition hover:bg-violet-500"
              >
                Войти
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      {showProfileModal && (
        <ProfileSetupModal onComplete={() => setProfileDismissed(true)} />
      )}
    </div>
  );
}
