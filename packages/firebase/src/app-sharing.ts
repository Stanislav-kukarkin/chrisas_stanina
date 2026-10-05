import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDefaultFamilyId } from './config';
import { getFirebaseFirestore } from './init';
import { familyMemberPath, familyMembersCollectionPath } from './paths';

export const SHAREABLE_APP_NAMES = ['tasks', 'shopping', 'payments'] as const;
export type ShareableAppName = (typeof SHAREABLE_APP_NAMES)[number];
export type AppSharingRole = 'view' | 'edit';
export type AppInvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'revoked';
export type AppSharingRoles = Partial<Record<ShareableAppName, AppSharingRole>>;

export interface AppInvitation {
  id: string;
  familyId: string;
  fromUid: string;
  fromEmail: string;
  toUid: string;
  toEmail: string;
  apps: AppSharingRoles;
  status: AppInvitationStatus;
  createdAt: Date | null;
  respondedAt: Date | null;
}

export interface InvitationTarget {
  uid: string;
  email: string;
  displayName: string;
}

const db = () => getFirebaseFirestore();
const invitationsCollection = () => collection(db(), 'appInvitations');
const familyAccessPath = (familyId: string, appName: ShareableAppName, uid: string) =>
  `families/${familyId}/appAccess/${appName}/members/${uid}`;

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
}

function mapInvitation(id: string, data: Record<string, unknown>): AppInvitation {
  const rawApps = data.apps && typeof data.apps === 'object'
    ? data.apps as Record<string, unknown>
    : {};
  const apps: AppSharingRoles = {};
  SHAREABLE_APP_NAMES.forEach((appName) => {
    const role = rawApps[appName];
    if (role === 'view' || role === 'edit') apps[appName] = role;
  });

  const status = data.status;
  return {
    id,
    familyId: String(data.familyId ?? getDefaultFamilyId()),
    fromUid: String(data.fromUid ?? ''),
    fromEmail: String(data.fromEmail ?? ''),
    toUid: String(data.toUid ?? ''),
    toEmail: String(data.toEmail ?? ''),
    apps,
    status: status === 'accepted' || status === 'declined' || status === 'cancelled' || status === 'revoked'
      ? status
      : 'pending',
    createdAt: asDate(data.createdAt),
    respondedAt: asDate(data.respondedAt),
  };
}

export async function findInvitationTarget(login: string, currentUid: string): Promise<InvitationTarget | null> {
  const originalEmail = login.trim();
  const email = originalEmail.toLocaleLowerCase();
  if (!email) return null;

  const profiles = await Promise.all([
    getDocs(query(collection(db(), 'users'), where('email', '==', email))),
    ...(originalEmail === email ? [] : [getDocs(query(collection(db(), 'users'), where('email', '==', originalEmail)))]),
  ]);
  const profileDocs = profiles.flatMap((snapshot) => snapshot.docs);
  const match = profileDocs.find((profile) =>
    profile.id !== currentUid && String(profile.data().email ?? '').toLocaleLowerCase() === email,
  );
  if (!match) return null;

  const data = match.data();
  return {
    uid: match.id,
    email: String(data.email ?? email),
    displayName: String(data.displayName ?? ''),
  };
}

export async function listAppInvitations(uid: string): Promise<AppInvitation[]> {
  const [incoming, outgoing] = await Promise.all([
    getDocs(query(invitationsCollection(), where('toUid', '==', uid))),
    getDocs(query(invitationsCollection(), where('fromUid', '==', uid))),
  ]);
  const byId = new Map<string, AppInvitation>();
  [...incoming.docs, ...outgoing.docs].forEach((snapshot) => {
    byId.set(snapshot.id, mapInvitation(snapshot.id, snapshot.data()));
  });
  return [...byId.values()].sort((left, right) =>
    (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0),
  );
}

export async function sendAppInvitation(
  fromUid: string,
  fromEmail: string,
  target: InvitationTarget,
  apps: AppSharingRoles,
): Promise<string> {
  const selectedApps = Object.fromEntries(
    SHAREABLE_APP_NAMES.filter((appName) => apps[appName]).map((appName) => [appName, apps[appName]]),
  ) as AppSharingRoles;
  if (!Object.keys(selectedApps).length) throw new Error('Выберите хотя бы одно приложение.');
  if (target.uid === fromUid) throw new Error('Нельзя пригласить собственный аккаунт.');

  const reference = doc(invitationsCollection());
  await setDoc(reference, {
    familyId: getDefaultFamilyId(),
    fromUid,
    fromEmail: fromEmail.trim().toLocaleLowerCase(),
    toUid: target.uid,
    toEmail: target.email.trim(),
    apps: selectedApps,
    status: 'pending',
    createdAt: serverTimestamp(),
    respondedAt: null,
  });
  return reference.id;
}

export async function respondToAppInvitation(
  uid: string,
  invitationId: string,
  accept: boolean,
): Promise<void> {
  const firestore = db();
  const invitationRef = doc(firestore, 'appInvitations', invitationId);

  await runTransaction(firestore, async (transaction) => {
    const invitationSnapshot = await transaction.get(invitationRef);
    if (!invitationSnapshot.exists()) throw new Error('Приглашение уже недоступно.');
    const invitation = mapInvitation(invitationSnapshot.id, invitationSnapshot.data());
    if (invitation.toUid !== uid || invitation.status !== 'pending') {
      throw new Error('Это приглашение уже обработано или адресовано другому аккаунту.');
    }

    const familyMemberRef = doc(firestore, familyMemberPath(invitation.familyId, uid));
    const familyMemberSnapshot = await transaction.get(familyMemberRef);
    if (accept && familyMemberSnapshot.exists()) {
      throw new Error('Этот пользователь уже состоит в общем пространстве приложений.');
    }
    const accessRefs = SHAREABLE_APP_NAMES.map((appName) =>
      doc(firestore, familyAccessPath(invitation.familyId, appName, uid)),
    );
    const now = serverTimestamp();

    transaction.update(invitationRef, {
      status: accept ? 'accepted' : 'declined',
      respondedAt: now,
      updatedAt: now,
    });

    if (!accept) return;

    transaction.set(familyMemberRef, {
      uid,
      email: invitation.toEmail,
      role: 'member',
      source: 'invitation',
      accessVersion: 1,
      invitationId,
      joinedAt: familyMemberSnapshot.data()?.joinedAt ?? now,
    }, { merge: true });

    accessRefs.forEach((reference, index) => {
      const appName = SHAREABLE_APP_NAMES[index];
      if (!appName) return;
      const role = invitation.apps[appName] ?? 'none';
      transaction.set(reference, {
        uid,
        role,
        source: 'invitation',
        invitationId,
        updatedAt: now,
      }, { merge: false });
    });
  });
}

export async function cancelAppInvitation(uid: string, invitationId: string): Promise<void> {
  const firestore = db();
  const invitationRef = doc(firestore, 'appInvitations', invitationId);

  await runTransaction(firestore, async (transaction) => {
    const invitationSnapshot = await transaction.get(invitationRef);
    if (!invitationSnapshot.exists()) return;
    const invitation = mapInvitation(invitationSnapshot.id, invitationSnapshot.data());
    if (invitation.fromUid !== uid && invitation.toUid !== uid) {
      throw new Error('Отменить это объединение может только его участник.');
    }
    if (invitation.status !== 'pending' && invitation.status !== 'accepted') return;

    transaction.update(invitationRef, {
      status: invitation.status === 'pending' ? 'cancelled' : 'revoked',
      respondedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (invitation.status === 'accepted') {
      transaction.delete(doc(firestore, familyMemberPath(invitation.familyId, invitation.toUid)));
    }
  });
}

export async function getFamilyAppRole(
  uid: string,
  appName: ShareableAppName,
  familyId = getDefaultFamilyId(),
): Promise<AppSharingRole | null> {
  const firestore = db();
  const memberSnapshot = await getDoc(doc(firestore, familyMemberPath(familyId, uid)));
  if (!memberSnapshot.exists()) return null;

  const accessSnapshot = await getDoc(doc(firestore, familyAccessPath(familyId, appName, uid)));
  if (!accessSnapshot.exists()) {
    return memberSnapshot.data().accessVersion === undefined ? 'edit' : null;
  }

  const access = accessSnapshot.data();
  if (access.role !== 'view' && access.role !== 'edit') return null;
  if (typeof access.invitationId === 'string') {
    const inviteSnapshot = await getDoc(doc(firestore, 'appInvitations', access.invitationId));
    if (!inviteSnapshot.exists()) return null;
    const invite = mapInvitation(inviteSnapshot.id, inviteSnapshot.data());
    if (invite.status !== 'accepted' || invite.toUid !== uid || invite.apps[appName] !== access.role) {
      return null;
    }
  }

  return access.role;
}

export async function migrateLegacyFamilyAccess(
  currentUid: string,
  familyId = getDefaultFamilyId(),
): Promise<boolean> {
  const firestore = db();
  const memberSnapshot = await getDoc(doc(firestore, familyMemberPath(familyId, currentUid)));
  if (!memberSnapshot.exists()) return false;
  const currentMember = memberSnapshot.data();
  const canMigrateLegacy = currentMember.accessVersion === undefined || currentMember.source === 'legacy';
  if (!canMigrateLegacy) return false;

  const membersSnapshot = await getDocs(collection(firestore, familyMembersCollectionPath(familyId)));
  const legacyMembers = membersSnapshot.docs.filter((member) =>
    member.data().accessVersion === undefined || member.data().source === 'legacy',
  );
  const references = legacyMembers.flatMap((member) =>
    SHAREABLE_APP_NAMES.map((appName) =>
      doc(firestore, familyAccessPath(familyId, appName, member.id)),
    ),
  );
  const accessSnapshots = await Promise.all(references.map((reference) => getDoc(reference)));

  for (let start = 0; start < legacyMembers.length; start += 140) {
    const batch = writeBatch(firestore);
    const members = legacyMembers.slice(start, start + 140);
    members.forEach((member, index) => {
      if (member.data().accessVersion === undefined) {
        batch.set(member.ref, { source: 'legacy', accessVersion: 1 }, { merge: true });
      }
      SHAREABLE_APP_NAMES.forEach((appName, appIndex) => {
        const referenceIndex = (start + index) * SHAREABLE_APP_NAMES.length + appIndex;
        if (accessSnapshots[referenceIndex]?.exists()) return;
        batch.set(doc(firestore, familyAccessPath(familyId, appName, member.id)), {
          uid: member.id,
          role: 'edit',
          source: 'legacy',
          updatedAt: serverTimestamp(),
        });
      });
    });
    try {
      await batch.commit();
    } catch (error) {
      const refreshedMember = await getDoc(doc(firestore, familyMemberPath(familyId, currentUid)));
      if (refreshedMember.exists() && refreshedMember.data().accessVersion !== undefined) return false;
      throw error;
    }
  }

  return true;
}

export async function leaveLegacyFamily(uid: string, familyId = getDefaultFamilyId()): Promise<void> {
  const firestore = db();
  const memberRef = doc(firestore, familyMemberPath(familyId, uid));
  const memberSnapshot = await getDoc(memberRef);
  if (!memberSnapshot.exists() || memberSnapshot.data().source !== 'legacy') {
    throw new Error('Для этого аккаунта нет старой общей связи.');
  }

  const batch = writeBatch(firestore);
  batch.delete(memberRef);
  SHAREABLE_APP_NAMES.forEach((appName) => {
    batch.delete(doc(firestore, familyAccessPath(familyId, appName, uid)));
  });
  await batch.commit();
}
