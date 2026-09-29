const REMEMBER_KEY_PREFIX = 'chrisasstanina:salary:remember-settings:';

export function getRememberSettingsPreference(uid: string | undefined): boolean {
  if (!uid) {
    return true;
  }

  const stored = localStorage.getItem(`${REMEMBER_KEY_PREFIX}${uid}`);
  if (stored === null) {
    return true;
  }

  return stored === 'true';
}

export function setRememberSettingsPreference(uid: string | undefined, remember: boolean): void {
  if (!uid) {
    return;
  }

  localStorage.setItem(`${REMEMBER_KEY_PREFIX}${uid}`, String(remember));
}
