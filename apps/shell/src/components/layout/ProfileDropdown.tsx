import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@chrisasstanina/auth';
import { useUserProfile } from '@chrisasstanina/firebase';

interface ProfileDropdownProps {
  onLogout: () => void;
}

export function ProfileDropdown({ onLogout }: ProfileDropdownProps) {
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.uid);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return null;
  }

  const label = profile?.profileComplete
    ? profile.displayName
    : (profile?.displayName ?? 'Профиль');
  const emoji = profile?.emoji ?? '👤';
  const color = profile?.color ?? '#8b5cf6';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-lg border border-zinc-700 px-2 py-1.5 text-sm text-zinc-200 transition hover:border-zinc-500"
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-base"
          style={{ backgroundColor: `${color}33` }}
        >
          {emoji}
        </span>
        <span className="max-w-[120px] truncate sm:max-w-[160px]">{label}</span>
        <span className="text-zinc-500">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/settings');
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-zinc-900"
          >
            Профиль
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/connections');
            }}
            className="block w-full border-t border-zinc-800 px-4 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-zinc-900"
          >
            Объединение приложений
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="block w-full border-t border-zinc-800 px-4 py-2.5 text-left text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
          >
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}
