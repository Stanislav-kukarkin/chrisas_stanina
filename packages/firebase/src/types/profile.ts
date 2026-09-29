export type MemberRole = 'member' | 'admin';

export interface UserProfile {
  id: string;
  displayName: string;
  emoji: string;
  color: string;
  email: string;
  profileComplete: boolean;
  updatedAt?: Date;
}

export interface FamilyMember {
  id: string;
  uid: string;
  email: string;
  role: MemberRole;
  joinedAt?: Date;
}

export interface UserProfileInput {
  displayName: string;
  emoji: string;
  color: string;
}

export const PROFILE_COLORS = [
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#06b6d4',
  '#84cc16',
] as const;

export const PROFILE_EMOJIS = [
  '👤',
  '😊',
  '🏠',
  '🛒',
  '👨',
  '👩',
  '🧑',
  '👦',
  '👧',
  '🐱',
  '🐶',
  '🐨',
  '🐩',
  '🐫',
  '🐬',
  '🐭',
  '🐮',
  '🐯',
  '🐰',
  '🐲',
  '🐳',
  '🐴',
  '🐵',
  '🐷',
  '🐸',
  '🐹',
  '🐺',
  '🐻',
  '🐼',
  '🐽',
  '🐾',
  '🌟',
  '🍳',
  '💼',
  '🎨',
  '⚽',
] as const;

export function isProfileComplete(profile: Pick<UserProfile, 'displayName' | 'emoji'>): boolean {
  return Boolean(profile.displayName.trim() && profile.emoji.trim());
}

export function defaultDisplayNameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? 'user';
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

export function randomProfileColor(): string {
  const index = Math.floor(Math.random() * PROFILE_COLORS.length);
  return PROFILE_COLORS[index] ?? PROFILE_COLORS[0];
}
