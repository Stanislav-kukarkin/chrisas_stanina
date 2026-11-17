import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
import { getDefaultFamilyId } from './config';
import { getFirebaseFirestore } from './init';
import { familyMemberPath } from './paths';

export const WORKSPACE_APP_NAMES = ['tasks', 'shopping', 'recipes', 'salary', 'payments'] as const;
export type WorkspaceAppName = (typeof WORKSPACE_APP_NAMES)[number];
export type WorkspaceRole = 'view' | 'edit';
export type WorkspaceSource = 'personal' | 'shared' | 'legacy';

export interface AppWorkspace {
  familyId: string;
  role: WorkspaceRole;
  source: WorkspaceSource;
}

const db = () => getFirebaseFirestore();

export function personalWorkspaceId(uid: string): string {
  return `personal-${uid}`;
}

export function appWorkspacePath(uid: string, appName: WorkspaceAppName): string {
  return `users/${uid}/appWorkspaces/${appName}`;
}

export function familyAccessPath(familyId: string, appName: WorkspaceAppName, uid: string): string {
  return `families/${familyId}/appAccess/${appName}/members/${uid}`;
}

function validRole(data: DocumentData | undefined): WorkspaceRole | null {
  return data?.role === 'view' || data?.role === 'edit' ? data.role : null;
}

function validSource(value: unknown): WorkspaceSource {
  return value === 'legacy' || value === 'shared' ? value : 'personal';
}

async function workspaceStep<T>(label: string, operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label}: ${message}`, { cause: error });
  }
}

/**
 * Creates a private workspace for every shareable app. Existing legacy users keep
 * their old `main` workspace until they explicitly disconnect it.
 */
export async function ensureUserWorkspaces(uid: string, email: string): Promise<void> {
  const firestore = db();
  const personalId = personalWorkspaceId(uid);
  const legacyId = getDefaultFamilyId();
  const familyRef = doc(firestore, 'families', personalId);
  const personalMemberRef = doc(firestore, familyMemberPath(personalId, uid));
  const legacyMemberRef = doc(firestore, familyMemberPath(legacyId, uid));
  const personalAccessRefs = WORKSPACE_APP_NAMES.map((appName) =>
    doc(firestore, familyAccessPath(personalId, appName, uid)),
  );
  const legacyAccessRefs = WORKSPACE_APP_NAMES.map((appName) =>
    doc(firestore, familyAccessPath(legacyId, appName, uid)),
  );
  const pointerRefs = WORKSPACE_APP_NAMES.map((appName) =>
    doc(firestore, appWorkspacePath(uid, appName)),
  );

  const [family, personalMember, legacyMember, personalAccess, legacyAccess, pointers] = await Promise.all([
    workspaceStep('Чтение личного пространства', getDoc(familyRef)),
    workspaceStep('Чтение личного участника', getDoc(personalMemberRef)),
    workspaceStep('Чтение старого пространства', getDoc(legacyMemberRef)),
    workspaceStep('Чтение личных доступов', Promise.all(personalAccessRefs.map((reference) => getDoc(reference)))),
    workspaceStep('Чтение старых доступов', Promise.all(legacyAccessRefs.map((reference) => getDoc(reference)))),
    workspaceStep('Чтение активных пространств', Promise.all(pointerRefs.map(async (reference, index) => {
      try {
        return await getDoc(reference);
      } catch (error) {
        // During a rolling deployment old rules do not recognize a newly added app yet.
        // Its missing pointer must not block established app workspaces.
        if (WORKSPACE_APP_NAMES[index] === 'recipes') return null;
        throw error;
      }
    }))),
  ]);

  if (!family.exists()) {
    await workspaceStep('Создание личного пространства', setDoc(familyRef, {
      ownerId: uid,
      kind: 'personal',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  }
  if (!personalMember.exists()) {
    await workspaceStep('Создание личного участника', setDoc(personalMemberRef, {
      uid,
      email: email.trim().toLocaleLowerCase(),
      role: 'admin',
      source: 'personal',
      accessVersion: 2,
      joinedAt: serverTimestamp(),
    }));
  }

  const isOriginalLegacyMember = legacyMember.exists()
    && (legacyMember.data().accessVersion === undefined || legacyMember.data().source === 'legacy');

  await Promise.all(WORKSPACE_APP_NAMES.map(async (appName, index) => {
    try {
      if (!personalAccess[index]?.exists()) {
        await workspaceStep(`Создание личного доступа ${appName}`, setDoc(personalAccessRefs[index]!, {
          uid,
          role: 'edit',
          source: 'personal',
          updatedAt: serverTimestamp(),
        }));
      }
      if (isOriginalLegacyMember && !legacyAccess[index]?.exists()) {
        await workspaceStep(`Создание старого доступа ${appName}`, setDoc(legacyAccessRefs[index]!, {
          uid,
          role: 'edit',
          source: 'legacy',
          updatedAt: serverTimestamp(),
        }));
      }
      if (pointers[index]?.exists()) return;

      const legacyRole = validRole(legacyAccess[index]?.data());
      const useLegacy = isOriginalLegacyMember
        && (legacyRole !== null
          || legacyMember.data().source === 'legacy'
          || legacyMember.data().accessVersion === undefined);
      await workspaceStep(`Выбор пространства ${appName}`, setDoc(pointerRefs[index]!, {
        familyId: useLegacy ? legacyId : personalId,
        source: useLegacy ? 'legacy' : 'personal',
        updatedAt: serverTimestamp(),
      }));
    } catch (error) {
      // Allows an updated client to roll out before the matching Firestore rules.
      // Other established apps must not become unavailable while `recipes` is pending deployment.
      if (appName === 'recipes') return;
      throw error;
    }
  }));
}

export async function resolveAppWorkspace(
  uid: string,
  appName: WorkspaceAppName,
): Promise<AppWorkspace> {
  await ensureUserWorkspaces(uid, '');
  const firestore = db();
  const personalId = personalWorkspaceId(uid);
  const pointerRef = doc(firestore, appWorkspacePath(uid, appName));
  const pointer = await getDoc(pointerRef);
  const pointedFamilyId = pointer.exists() && typeof pointer.data().familyId === 'string'
    ? pointer.data().familyId
    : personalId;
  const [pointedAccess, pointedMember] = await Promise.all([
    getDoc(doc(firestore, familyAccessPath(pointedFamilyId, appName, uid))),
    getDoc(doc(firestore, familyMemberPath(pointedFamilyId, uid))),
  ]);
  const pointedRole = validRole(pointedAccess.data());
  const implicitLegacyRole = pointedFamilyId === getDefaultFamilyId()
    && pointedMember.exists()
    && pointedMember.data().accessVersion === undefined;

  if (pointedRole || implicitLegacyRole) {
    return {
      familyId: pointedFamilyId,
      role: pointedRole ?? 'edit',
      source: validSource(pointer.data()?.source),
    };
  }

  // A revoked or stale connection always falls back to the user's private board.
  const personalAccess = await getDoc(doc(firestore, familyAccessPath(personalId, appName, uid)));
  const personalRole = validRole(personalAccess.data()) ?? 'edit';
  await setDoc(pointerRef, {
    familyId: personalId,
    source: 'personal',
    updatedAt: serverTimestamp(),
  });
  return { familyId: personalId, role: personalRole, source: 'personal' };
}
