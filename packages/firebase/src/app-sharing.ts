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
import {
  appWorkspacePath,
  ensureUserWorkspaces,
  familyAccessPath,
  personalWorkspaceId,
  resolveAppWorkspace,
  WORKSPACE_APP_NAMES,
} from './app-workspaces';

export const SHAREABLE_APP_NAMES = WORKSPACE_APP_NAMES;
export type ShareableAppName = (typeof SHAREABLE_APP_NAMES)[number];
export type AppSharingRole = 'view' | 'edit';
export type AppInvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'revoked';
export type AppSharingRoles = Partial<Record<ShareableAppName, AppSharingRole>>;
export type AppWorkspaceIds = Partial<Record<ShareableAppName, string>>;

export interface AppInvitation {
  id: string;
  familyId: string;
  workspaceIds: AppWorkspaceIds;
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
  const rawWorkspaceIds = data.workspaceIds && typeof data.workspaceIds === 'object'
    ? data.workspaceIds as Record<string, unknown>
    : {};
  const workspaceIds: AppWorkspaceIds = {};
  SHAREABLE_APP_NAMES.forEach((appName) => {
    const role = rawApps[appName];
    if (role === 'view' || role === 'edit') apps[appName] = role;
    const workspaceId = rawWorkspaceIds[appName];
    if (typeof workspaceId === 'string' && workspaceId) workspaceIds[appName] = workspaceId;
  });

  const status = data.status;
  return {
    id,
    familyId: String(data.familyId ?? getDefaultFamilyId()),
    workspaceIds,
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

function invitationWorkspace(invitation: AppInvitation, appName: ShareableAppName): string {
  return invitation.workspaceIds[appName] ?? invitation.familyId;
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

  const selectedNames = SHAREABLE_APP_NAMES.filter((appName) => selectedApps[appName]);
  const resolved = await Promise.all(selectedNames.map(async (appName) => ({
    appName,
    workspace: await resolveAppWorkspace(fromUid, appName),
  })));
  const denied = resolved.find(({ workspace }) => workspace.role !== 'edit');
  if (denied) throw new Error('Приглашать пользователей может только участник с правом редактирования.');
  const workspaceIds = Object.fromEntries(
    resolved.map(({ appName, workspace }) => [appName, workspace.familyId]),
  ) as AppWorkspaceIds;
  const primaryFamilyId = resolved[0]?.workspace.familyId ?? personalWorkspaceId(fromUid);

  const reference = doc(invitationsCollection());
  await setDoc(reference, {
    familyId: primaryFamilyId,
    workspaceIds,
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

    const selectedApps = SHAREABLE_APP_NAMES.filter((appName) => invitation.apps[appName]);
    const workspaceIds = [...new Set(selectedApps.map((appName) => invitationWorkspace(invitation, appName)))];
    const memberRefs = workspaceIds.map((familyId) => doc(firestore, familyMemberPath(familyId, uid)));
    const memberSnapshots = accept
      ? await Promise.all(memberRefs.map((reference) => transaction.get(reference)))
      : [];
    const now = serverTimestamp();

    transaction.update(invitationRef, {
      status: accept ? 'accepted' : 'declined',
      respondedAt: now,
      updatedAt: now,
    });

    if (!accept) return;

    memberRefs.forEach((reference, index) => {
      if (memberSnapshots[index]?.exists()) return;
      transaction.set(reference, {
        uid,
        email: invitation.toEmail,
        role: 'member',
        source: 'invitation',
        accessVersion: 1,
        invitationId,
        joinedAt: now,
      });
    });

    selectedApps.forEach((appName) => {
      const familyId = invitationWorkspace(invitation, appName);
      const role = invitation.apps[appName]!;
      transaction.set(doc(firestore, familyAccessPath(familyId, appName, uid)), {
        uid,
        role,
        source: 'invitation',
        invitationId,
        updatedAt: now,
      });
      transaction.set(doc(firestore, appWorkspacePath(uid, appName)), {
        familyId,
        source: 'shared',
        updatedAt: now,
      });
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

    const selectedApps = SHAREABLE_APP_NAMES.filter((appName) => invitation.apps[appName]);
    const workspaceIds = [...new Set(selectedApps.map((appName) => invitationWorkspace(invitation, appName)))];
    const allWorkspaceAccess = invitation.status === 'accepted'
      ? await Promise.all(workspaceIds.map(async (familyId) => ({
        familyId,
        snapshots: await Promise.all(SHAREABLE_APP_NAMES.map((appName) => transaction.get(
          doc(firestore, familyAccessPath(familyId, appName, invitation.toUid)),
        ))),
        member: await transaction.get(doc(firestore, familyMemberPath(familyId, invitation.toUid))),
      })))
      : [];

    transaction.update(invitationRef, {
      status: invitation.status === 'pending' ? 'cancelled' : 'revoked',
      respondedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (invitation.status === 'accepted') {
      selectedApps.forEach((appName) => {
        const familyId = invitationWorkspace(invitation, appName);
        const workspace = allWorkspaceAccess.find((entry) => entry.familyId === familyId);
        const access = workspace?.snapshots[SHAREABLE_APP_NAMES.indexOf(appName)];
        if (access?.data()?.invitationId === invitationId) {
          transaction.delete(doc(firestore, familyAccessPath(familyId, appName, invitation.toUid)));
        }
        if (uid === invitation.toUid) {
          transaction.set(doc(firestore, appWorkspacePath(invitation.toUid, appName)), {
            familyId: personalWorkspaceId(invitation.toUid),
            source: 'personal',
            updatedAt: serverTimestamp(),
          });
        }
      });
      allWorkspaceAccess.forEach(({ familyId, snapshots, member }) => {
        const hasRemainingAccess = snapshots.some((snapshot, index) => {
          if (!snapshot.exists()) return false;
          const appName = SHAREABLE_APP_NAMES[index]!;
          const removedByThisInvitation = selectedApps.includes(appName)
            && invitationWorkspace(invitation, appName) === familyId
            && snapshot.data().invitationId === invitationId;
          return !removedByThisInvitation
            && (snapshot.data().role === 'view' || snapshot.data().role === 'edit');
        });
        if (!hasRemainingAccess && member.data()?.invitationId === invitationId) {
          transaction.delete(member.ref);
        }
      });
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
    if (
      invite.status !== 'accepted'
      || invite.toUid !== uid
      || invite.apps[appName] !== access.role
      || invitationWorkspace(invite, appName) !== familyId
    ) {
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

  // Five writes per legacy member at most: member metadata plus four app grants.
  // Stay safely below Firestore's 500-operation batch limit.
  const membersPerBatch = 90;
  for (let start = 0; start < legacyMembers.length; start += membersPerBatch) {
    const batch = writeBatch(firestore);
    const members = legacyMembers.slice(start, start + membersPerBatch);
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
  await ensureUserWorkspaces(uid, '');
  const memberRef = doc(firestore, familyMemberPath(familyId, uid));
  const memberSnapshot = await getDoc(memberRef);
  if (!memberSnapshot.exists() || memberSnapshot.data().source !== 'legacy') {
    throw new Error('Для этого аккаунта нет старой общей связи.');
  }

  const batch = writeBatch(firestore);
  batch.delete(memberRef);
  SHAREABLE_APP_NAMES.forEach((appName) => {
    batch.delete(doc(firestore, familyAccessPath(familyId, appName, uid)));
    batch.set(doc(firestore, appWorkspacePath(uid, appName)), {
      familyId: personalWorkspaceId(uid),
      source: 'personal',
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}
