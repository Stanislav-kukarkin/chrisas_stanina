"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const rules_unit_testing_1 = require("@firebase/rules-unit-testing");
const firestore_1 = require("firebase/firestore");
const vitest_1 = require("vitest");
const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const suite = emulatorAvailable ? vitest_1.describe : vitest_1.describe.skip;
suite('firestore tasks access rules', () => {
    let environment;
    (0, vitest_1.beforeAll)(async () => {
        environment = await (0, rules_unit_testing_1.initializeTestEnvironment)({
            projectId: 'family-kanban-rules-test',
            firestore: { rules: await (0, promises_1.readFile)((0, node_path_1.resolve)(process.cwd(), '../firestore.rules'), 'utf8') },
        });
        await environment.withSecurityRulesDisabled(async (context) => {
            const firestore = context.firestore();
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'families/family/members/editor'), { uid: 'editor', accessVersion: 1 });
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'families/family/members/viewer'), { uid: 'viewer', accessVersion: 1 });
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'families/family/appAccess/tasks/members/editor'), { role: 'edit' });
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'families/family/appAccess/tasks/members/viewer'), { role: 'view' });
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'families/family/appAccess/salary/members/editor'), { role: 'edit' });
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'families/family/appAccess/salary/members/viewer'), { role: 'view' });
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'families/family/appAccess/recipes/members/editor'), { role: 'edit' });
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'families/family/appAccess/recipes/members/viewer'), { role: 'view' });
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'families/family/apps/tasks/tasks/existing'), validTask('editor'));
        });
    });
    (0, vitest_1.afterAll)(async () => environment?.cleanup());
    (0, vitest_1.it)('allows members to read and blocks outsiders', async () => {
        const viewer = environment.authenticatedContext('viewer').firestore();
        const outsider = environment.authenticatedContext('outsider').firestore();
        await (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.getDoc)((0, firestore_1.doc)(viewer, 'families/family/apps/tasks/tasks/existing')));
        await (0, rules_unit_testing_1.assertFails)((0, firestore_1.getDoc)((0, firestore_1.doc)(outsider, 'families/family/apps/tasks/tasks/existing')));
    });
    (0, vitest_1.it)('allows valid editor task creation and blocks viewers', async () => {
        const editor = environment.authenticatedContext('editor').firestore();
        const viewer = environment.authenticatedContext('viewer').firestore();
        await (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.setDoc)((0, firestore_1.doc)(editor, 'families/family/apps/tasks/tasks/new'), validTask('editor')));
        await (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(viewer, 'families/family/apps/tasks/tasks/forbidden'), validTask('viewer')));
    });
    (0, vitest_1.it)('rejects malformed task and negative economy values', async () => {
        const editor = environment.authenticatedContext('editor').firestore();
        await (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(editor, 'families/family/apps/tasks/tasks/malformed'), { title: 'Нет схемы' }));
        await (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(editor, 'families/family/apps/tasks/profiles/editor'), { coins: -1 }));
    });
    (0, vitest_1.it)('lets task editors award another member inventory and blocks viewers', async () => {
        const editor = environment.authenticatedContext('editor').firestore();
        const viewer = environment.authenticatedContext('viewer').firestore();
        const inventoryPath = 'families/family/apps/tasks/profiles/viewer/inventory/sprint-award';
        await (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.setDoc)((0, firestore_1.doc)(editor, inventoryPath), {
            kind: 'title', name: 'Награда спринта', quantity: 1,
        }));
        await (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(viewer, inventoryPath), {
            kind: 'title', name: 'Подмена', quantity: 99,
        }));
    });
    (0, vitest_1.it)('allows recipe editors to save recipes and keeps viewers read-only', async () => {
        const editor = environment.authenticatedContext('editor').firestore();
        const viewer = environment.authenticatedContext('viewer').firestore();
        await (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.setDoc)((0, firestore_1.doc)(editor, 'families/family/apps/recipes/recipes/pancakes'), validRecipe('editor')));
        await (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.getDoc)((0, firestore_1.doc)(viewer, 'families/family/apps/recipes/recipes/pancakes')));
        await (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(viewer, 'families/family/apps/recipes/recipes/forbidden'), validRecipe('viewer')));
    });
    (0, vitest_1.it)('lets a new account bootstrap its own isolated app workspace', async () => {
        const uid = 'solo-user';
        const familyId = `personal-${uid}`;
        const firestore = environment.authenticatedContext(uid).firestore();
        const batch = (0, firestore_1.writeBatch)(firestore);
        batch.set((0, firestore_1.doc)(firestore, `families/${familyId}`), {
            ownerId: uid,
            kind: 'personal',
            createdAt: (0, firestore_1.serverTimestamp)(),
            updatedAt: (0, firestore_1.serverTimestamp)(),
        });
        batch.set((0, firestore_1.doc)(firestore, `families/${familyId}/members/${uid}`), {
            uid,
            email: 'solo@example.com',
            role: 'admin',
            source: 'personal',
            accessVersion: 2,
            joinedAt: (0, firestore_1.serverTimestamp)(),
        });
        batch.set((0, firestore_1.doc)(firestore, `families/${familyId}/appAccess/tasks/members/${uid}`), {
            uid,
            role: 'edit',
            source: 'personal',
            updatedAt: (0, firestore_1.serverTimestamp)(),
        });
        batch.set((0, firestore_1.doc)(firestore, `families/${familyId}/appAccess/salary/members/${uid}`), {
            uid,
            role: 'edit',
            source: 'personal',
            updatedAt: (0, firestore_1.serverTimestamp)(),
        });
        batch.set((0, firestore_1.doc)(firestore, `families/${familyId}/appAccess/recipes/members/${uid}`), {
            uid,
            role: 'edit',
            source: 'personal',
            updatedAt: (0, firestore_1.serverTimestamp)(),
        });
        batch.set((0, firestore_1.doc)(firestore, `users/${uid}/appWorkspaces/tasks`), {
            familyId,
            source: 'personal',
            updatedAt: (0, firestore_1.serverTimestamp)(),
        });
        batch.set((0, firestore_1.doc)(firestore, `users/${uid}/appWorkspaces/salary`), {
            familyId,
            source: 'personal',
            updatedAt: (0, firestore_1.serverTimestamp)(),
        });
        batch.set((0, firestore_1.doc)(firestore, `users/${uid}/appWorkspaces/recipes`), {
            familyId,
            source: 'personal',
            updatedAt: (0, firestore_1.serverTimestamp)(),
        });
        await (0, rules_unit_testing_1.assertSucceeds)(batch.commit());
        await (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, `families/${familyId}/apps/tasks/tasks/first`), validTask(uid)));
        await (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, `families/${familyId}/apps/salary/settings/${uid}`), { monthlySalary: 100_000 }));
        await (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, `families/${familyId}/apps/recipes/recipes/first`), validRecipe(uid)));
        const outsider = environment.authenticatedContext('another-user').firestore();
        await (0, rules_unit_testing_1.assertFails)((0, firestore_1.getDoc)((0, firestore_1.doc)(outsider, `families/${familyId}/apps/tasks/tasks/first`)));
        await (0, rules_unit_testing_1.assertFails)((0, firestore_1.getDoc)((0, firestore_1.doc)(outsider, `families/${familyId}/apps/salary/settings/${uid}`)));
    });
    (0, vitest_1.it)('keeps own salary settings writable during legacy app-access migration', async () => {
        await environment.withSecurityRulesDisabled(async (context) => {
            const firestore = context.firestore();
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'families/personal-compat-user'), {
                ownerId: 'compat-user', kind: 'personal', createdAt: new Date(), updatedAt: new Date(),
            });
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'families/personal-compat-user/members/compat-user'), {
                uid: 'compat-user', email: 'compat@example.com', role: 'admin',
                source: 'personal', accessVersion: 2,
            });
        });
        const compat = environment.authenticatedContext('compat-user').firestore();
        await (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.setDoc)((0, firestore_1.doc)(compat, 'families/personal-compat-user/apps/salary/settings/compat-user'), { monthlySalary: 100_000 }));
        const viewer = environment.authenticatedContext('viewer').firestore();
        await (0, rules_unit_testing_1.assertFails)((0, firestore_1.setDoc)((0, firestore_1.doc)(viewer, 'families/family/apps/salary/settings/viewer'), { monthlySalary: 100_000 }));
    });
    (0, vitest_1.it)('accepts an app-specific workspace invitation', async () => {
        await environment.withSecurityRulesDisabled(async (context) => {
            const firestore = context.firestore();
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'users/alice'), { email: 'alice@example.com' });
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'users/bob'), { email: 'bob@example.com' });
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'families/personal-alice'), {
                ownerId: 'alice', kind: 'personal', createdAt: new Date(), updatedAt: new Date(),
            });
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'families/personal-alice/members/alice'), {
                uid: 'alice', email: 'alice@example.com', role: 'admin', source: 'personal', accessVersion: 2,
            });
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'families/personal-alice/appAccess/tasks/members/alice'), {
                uid: 'alice', role: 'edit', source: 'personal',
            });
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'families/personal-alice/appAccess/salary/members/alice'), {
                uid: 'alice', role: 'edit', source: 'personal',
            });
            await (0, firestore_1.setDoc)((0, firestore_1.doc)(firestore, 'families/personal-alice/apps/salary/settings/alice'), {
                monthlySalary: 150_000,
            });
        });
        const alice = environment.authenticatedContext('alice').firestore();
        const invitationRef = (0, firestore_1.doc)(alice, 'appInvitations/app-specific');
        await (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.setDoc)(invitationRef, {
            familyId: 'personal-alice',
            workspaceIds: { tasks: 'personal-alice', salary: 'personal-alice' },
            fromUid: 'alice',
            fromEmail: 'alice@example.com',
            toUid: 'bob',
            toEmail: 'bob@example.com',
            apps: { tasks: 'edit', salary: 'edit' },
            status: 'pending',
            createdAt: (0, firestore_1.serverTimestamp)(),
            respondedAt: null,
        }));
        const bob = environment.authenticatedContext('bob').firestore();
        await (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.runTransaction)(bob, async (transaction) => {
            const bobInvitationRef = (0, firestore_1.doc)(bob, 'appInvitations/app-specific');
            await transaction.get(bobInvitationRef);
            transaction.update(bobInvitationRef, {
                status: 'accepted', respondedAt: (0, firestore_1.serverTimestamp)(), updatedAt: (0, firestore_1.serverTimestamp)(),
            });
            transaction.set((0, firestore_1.doc)(bob, 'families/personal-alice/members/bob'), {
                uid: 'bob', email: 'bob@example.com', role: 'member', source: 'invitation',
                accessVersion: 1, invitationId: 'app-specific', joinedAt: (0, firestore_1.serverTimestamp)(),
            });
            transaction.set((0, firestore_1.doc)(bob, 'families/personal-alice/appAccess/tasks/members/bob'), {
                uid: 'bob', role: 'edit', source: 'invitation', invitationId: 'app-specific',
                updatedAt: (0, firestore_1.serverTimestamp)(),
            });
            transaction.set((0, firestore_1.doc)(bob, 'families/personal-alice/appAccess/salary/members/bob'), {
                uid: 'bob', role: 'edit', source: 'invitation', invitationId: 'app-specific',
                updatedAt: (0, firestore_1.serverTimestamp)(),
            });
            transaction.set((0, firestore_1.doc)(bob, 'users/bob/appWorkspaces/tasks'), {
                familyId: 'personal-alice', source: 'shared', updatedAt: (0, firestore_1.serverTimestamp)(),
            });
            transaction.set((0, firestore_1.doc)(bob, 'users/bob/appWorkspaces/salary'), {
                familyId: 'personal-alice', source: 'shared', updatedAt: (0, firestore_1.serverTimestamp)(),
            });
        }));
        await (0, rules_unit_testing_1.assertSucceeds)((0, firestore_1.setDoc)((0, firestore_1.doc)(bob, 'families/personal-alice/apps/salary/settings/bob'), { monthlySalary: 120_000 }));
        await (0, rules_unit_testing_1.assertFails)((0, firestore_1.getDoc)((0, firestore_1.doc)(bob, 'families/personal-alice/apps/salary/settings/alice')));
    });
});
function validRecipe(authorId) {
    return {
        title: 'Блины',
        description: null,
        servings: 4,
        prepMinutes: 10,
        cookMinutes: 20,
        ingredients: [{ id: 'flour', name: 'Мука', quantity: 500, unit: 'г', note: null }],
        steps: ['Смешать', 'Обжарить'],
        sourceUrl: null,
        favorite: false,
        authorId,
        createdAt: (0, firestore_1.serverTimestamp)(),
        updatedAt: (0, firestore_1.serverTimestamp)(),
    };
}
function validTask(authorId) {
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
//# sourceMappingURL=firestore.rules.test.js.map