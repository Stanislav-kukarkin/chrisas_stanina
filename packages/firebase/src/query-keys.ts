import { type FamilyAppName } from './paths';

export const queryKeys = {
  family: (familyId: string) => ['family', familyId] as const,
  familyApp: (familyId: string, appName: FamilyAppName) =>
    [...queryKeys.family(familyId), 'apps', appName] as const,
  familyAppCollection: (familyId: string, appName: FamilyAppName) =>
    [...queryKeys.familyApp(familyId, appName), 'collection'] as const,
  familyAppDoc: (familyId: string, appName: FamilyAppName, docId: string) =>
    [...queryKeys.familyApp(familyId, appName), 'doc', docId] as const,
  userProfile: (uid: string) => ['userProfile', uid] as const,
  familyMembers: (familyId: string) => [...queryKeys.family(familyId), 'members'] as const,
  familyAppAccess: (familyId: string, appName: FamilyAppName, uid: string) =>
    [...queryKeys.familyApp(familyId, appName), 'access', uid] as const,
  appInvitations: (uid: string) => ['appInvitations', uid] as const,
  appWorkspace: (uid: string, appName: FamilyAppName) =>
    ['appWorkspace', uid, appName] as const,
  shoppingLists: (familyId: string) =>
    [...queryKeys.familyApp(familyId, 'shopping'), 'lists'] as const,
  shoppingItems: (familyId: string, listId = 'main') =>
    [...queryKeys.familyApp(familyId, 'shopping'), 'lists', listId, 'items'] as const,
  shoppingFavorites: (familyId: string) =>
    [...queryKeys.familyApp(familyId, 'shopping'), 'favorites'] as const,
  salarySettings: (familyId: string, uid: string) =>
    [...queryKeys.familyApp(familyId, 'salary'), 'settings', uid] as const,
  recipes: (familyId: string) =>
    [...queryKeys.familyApp(familyId, 'recipes'), 'recipes'] as const,
};
