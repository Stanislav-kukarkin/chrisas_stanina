import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LoginForm, useAuth } from '@chrisasstanina/auth';

export function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/apps/tasks';

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-3xl font-semibold">Вход в семейный hub</h1>
        <p className="mt-2 text-zinc-400">Используйте email и пароль, созданные в Firebase.</p>
      </div>
      <div className="mt-10">
        <LoginForm onSuccess={() => navigate(redirectTo, { replace: true })} />
      </div>
    </section>
  );
}
