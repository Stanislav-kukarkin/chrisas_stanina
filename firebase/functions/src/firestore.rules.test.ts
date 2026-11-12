import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, runTransaction, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const suite = emulatorAvailable ? describe : describe.skip;

suite('firestore tasks access rules', () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId: 'family-kanban-rules-test',
      firestore: { rules: await readFile(resolve(process.cwd(), '../firestore.rules'), 'utf8') },
    });
    await environment.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, 'families/family/members/editor'), { uid: 'editor', accessVersion: 1 });
      await setDoc(doc(firestore, 'families/family/members/viewer'), { uid: 'viewer', accessVersion: 1 });
      await setDoc(doc(firestore, 'families/family/appAccess/tasks/members/editor'), { role: 'edit' });
      await setDoc(doc(firestore, 'families/family/appAccess/tasks/members/viewer'), { role: 'view' });
      await setDoc(doc(firestore, 'families/family/appAccess/salary/members/editor'), { role: 'edit' });
      await setDoc(doc(firestore, 'families/family/appAccess/salary/members/viewer'), { role: 'view' });
      await setDoc(doc(firestore, 'families/family/apps/tasks/tasks/existing'), validTask('editor'));
    });
  });

  afterAll(async () => environment?.cleanup());

  it('allows members to read and blocks outsiders', async () => {
    const viewer = environment.authenticatedContext('viewer').firestore();
    const outsider = environment.authenticatedContext('outsider').firestore();
    await assertSucceeds(getDoc(doc(viewer, 'families/family/apps/tasks/tasks/existing')));
    await assertFails(getDoc(doc(outsider, 'families/family/apps/tasks/tasks/existing')));
  });

  it('allows valid editor task creation and blocks viewers', async () => {
    const editor = environment.authenticatedContext('editor').firestore();
    const viewer = environment.authenticatedContext('viewer').firestore();
    await assertSucceeds(setDoc(doc(editor, 'families/family/apps/tasks/tasks/new'), validTask('editor')));
    await assertFails(setDoc(doc(viewer, 'families/family/apps/tasks/tasks/forbidden'), validTask('viewer')));
  });

  it('rejects malformed task and negative economy values', async () => {
    const editor = environment.authenticatedContext('editor').firestore();
    await assertFails(setDoc(doc(editor, 'families/family/apps/tasks/tasks/malformed'), { title: 'Нет схемы' }));
    await assertFails(setDoc(doc(editor, 'families/family/apps/tasks/profiles/editor'), { coins: -1 }));
  });

  it('lets task editors award another member inventory and blocks viewers', async () => {
    const editor = environment.authenticatedContext('editor').firestore();
    const viewer = environment.authenticatedContext('viewer').firestore();
    const inventoryPath = 'families/family/apps/tasks/profiles/viewer/inventory/sprint-award';
    await assertSucceeds(setDoc(doc(editor, inventoryPath), {
      kind: 'title', name: 'Награда спринта', quantity: 1,
    }));
    await assertFails(setDoc(doc(viewer, inventoryPath), {
      kind: 'title', name: 'Подмена', quantity: 99,
    }));
  });

  it('lets a new account bootstrap its own isolated app workspace', async () => {
    const uid = 'solo-user';
    const familyId = `personal-${uid}`;
    const firestore = environment.authenticatedContext(uid).firestore();
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, `families/${familyId}`), {
      ownerId: uid,
      kind: 'personal',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(firestore, `families/${familyId}/members/${uid}`), {
      uid,
      email: 'solo@example.com',
      role: 'admin',
      source: 'personal',
      accessVersion: 2,
      joinedAt: serverTimestamp(),
    });
    batch.set(doc(firestore, `families/${familyId}/appAccess/tasks/members/${uid}`), {
      uid,
      role: 'edit',
      source: 'personal',
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(firestore, `families/${familyId}/appAccess/salary/members/${uid}`), {
      uid,
      role: 'edit',
      source: 'personal',
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(firestore, `users/${uid}/appWorkspaces/tasks`), {
      familyId,
      source: 'personal',
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(firestore, `users/${uid}/appWorkspaces/salary`), {
      familyId,
      source: 'personal',
      updatedAt: serverTimestamp(),
    });

    await assertSucceeds(batch.commit());
    await assertSucceeds(setDoc(
      doc(firestore, `families/${familyId}/apps/tasks/tasks/first`),
      validTask(uid),
    ));
    await assertSucceeds(setDoc(
      doc(firestore, `families/${familyId}/apps/salary/settings/${uid}`),
      { monthlySalary: 100_000 },
    ));
    const outsider = environment.authenticatedContext('another-user').firestore();
    await assertFails(getDoc(doc(outsider, `families/${familyId}/apps/tasks/tasks/first`)));
    await assertFails(getDoc(doc(outsider, `families/${familyId}/apps/salary/settings/${uid}`)));
  });

  it('keeps own salary settings writable during legacy app-access migration', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, 'families/personal-compat-user'), {
        ownerId: 'compat-user', kind: 'personal', createdAt: new Date(), updatedAt: new Date(),
      });
      await setDoc(doc(firestore, 'families/personal-compat-user/members/compat-user'), {
        uid: 'compat-user', email: 'compat@example.com', role: 'admin',
        source: 'personal', accessVersion: 2,
      });
    });

    const compat = environment.authenticatedContext('compat-user').firestore();
    await assertSucceeds(setDoc(
      doc(compat, 'families/personal-compat-user/apps/salary/settings/compat-user'),
      { monthlySalary: 100_000 },
    ));

    const viewer = environment.authenticatedContext('viewer').firestore();
    await assertFails(setDoc(
      doc(viewer, 'families/family/apps/salary/settings/viewer'),
      { monthlySalary: 100_000 },
    ));
  });

  it('accepts an app-specific workspace invitation', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, 'users/alice'), { email: 'alice@example.com' });
      await setDoc(doc(firestore, 'users/bob'), { email: 'bob@example.com' });
      await setDoc(doc(firestore, 'families/personal-alice'), {
        ownerId: 'alice', kind: 'personal', createdAt: new Date(), updatedAt: new Date(),
      });
      await setDoc(doc(firestore, 'families/personal-alice/members/alice'), {
        uid: 'alice', email: 'alice@example.com', role: 'admin', source: 'personal', accessVersion: 2,
      });
      await setDoc(doc(firestore, 'families/personal-alice/appAccess/tasks/members/alice'), {
        uid: 'alice', role: 'edit', source: 'personal',
      });
      await setDoc(doc(firestore, 'families/personal-alice/appAccess/salary/members/alice'), {
        uid: 'alice', role: 'edit', source: 'personal',
      });
      await setDoc(doc(firestore, 'families/personal-alice/apps/salary/settings/alice'), {
        monthlySalary: 150_000,
      });
    });
    const alice = environment.authenticatedContext('alice').firestore();
    const invitationRef = doc(alice, 'appInvitations/app-specific');
    await assertSucceeds(setDoc(invitationRef, {
      familyId: 'personal-alice',
      workspaceIds: { tasks: 'personal-alice', salary: 'personal-alice' },
      fromUid: 'alice',
      fromEmail: 'alice@example.com',
      toUid: 'bob',
      toEmail: 'bob@example.com',
      apps: { tasks: 'edit', salary: 'edit' },
      status: 'pending',
      createdAt: serverTimestamp(),
      respondedAt: null,
    }));

    const bob = environment.authenticatedContext('bob').firestore();
    await assertSucceeds(runTransaction(bob, async (transaction) => {
      const bobInvitationRef = doc(bob, 'appInvitations/app-specific');
      await transaction.get(bobInvitationRef);
      transaction.update(bobInvitationRef, {
        status: 'accepted', respondedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      transaction.set(doc(bob, 'families/personal-alice/members/bob'), {
        uid: 'bob', email: 'bob@example.com', role: 'member', source: 'invitation',
        accessVersion: 1, invitationId: 'app-specific', joinedAt: serverTimestamp(),
      });
      transaction.set(doc(bob, 'families/personal-alice/appAccess/tasks/members/bob'), {
        uid: 'bob', role: 'edit', source: 'invitation', invitationId: 'app-specific',
        updatedAt: serverTimestamp(),
      });
      transaction.set(doc(bob, 'families/personal-alice/appAccess/salary/members/bob'), {
        uid: 'bob', role: 'edit', source: 'invitation', invitationId: 'app-specific',
        updatedAt: serverTimestamp(),
      });
      transaction.set(doc(bob, 'users/bob/appWorkspaces/tasks'), {
        familyId: 'personal-alice', source: 'shared', updatedAt: serverTimestamp(),
      });
      transaction.set(doc(bob, 'users/bob/appWorkspaces/salary'), {
        familyId: 'personal-alice', source: 'shared', updatedAt: serverTimestamp(),
      });
    }));
    await assertSucceeds(setDoc(
      doc(bob, 'families/personal-alice/apps/salary/settings/bob'),
      { monthlySalary: 120_000 },
    ));
    await assertFails(getDoc(doc(bob, 'families/personal-alice/apps/salary/settings/alice')));
  });
});

function validTask(authorId: string) {
  return {
    title: 'Задача',
    description: null,
    status: 'backlog',
    authorId,
    assigneeIds: [],
    reviewerId: 'editor',
    difficulty: 'easy',
    difficultyStatus: 'pending',
    difficultyProposedById: authorId,
    pendingAssigneeIds: [],
    transferRequestedById: null,
    transferRequestedAt: null,
    estimatedDuration: null,
    dueDate: null,
    sprintId: null,
    blockerIds: [],
    bonusCoins: 0,
    bonusCoinsAuthorId: null,
    bonusReservedAt: null,
    bossPlannedAt: null,
    rolloverCount: 0,
    recurrence: null,
    recurrenceTemplateId: null,
    recurrenceDateKey: null,
    rewardSettledAt: null,
    bossDamageSettledAt: null,
    reviewStartedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
