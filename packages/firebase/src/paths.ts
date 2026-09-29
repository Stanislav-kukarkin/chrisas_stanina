export type FamilyAppName = 'tasks' | 'shopping' | 'recipes' | 'budget' | 'cashback' | 'salary';

export function familyDocPath(familyId: string): string {
  return `families/${familyId}`;
}

export function familyAppCollectionPath(familyId: string, appName: FamilyAppName): string {
  return `${familyDocPath(familyId)}/apps/${appName}`;
}

export function familyAppDocPath(
  familyId: string,
  appName: FamilyAppName,
  docId: string,
): string {
  return `${familyAppCollectionPath(familyId, appName)}/${docId}`;
}

export function userProfilePath(uid: string): string {
  return `users/${uid}`;
}

export function familyMembersCollectionPath(familyId: string): string {
  return `${familyDocPath(familyId)}/members`;
}

export function familyMemberPath(familyId: string, uid: string): string {
  return `${familyMembersCollectionPath(familyId)}/${uid}`;
}

export function shoppingItemsCollectionPath(familyId: string): string {
  return `${familyAppCollectionPath(familyId, 'shopping')}/items`;
}

export function shoppingItemPath(familyId: string, itemId: string): string {
  return `${shoppingItemsCollectionPath(familyId)}/${itemId}`;
}

export function shoppingFavoritesCollectionPath(familyId: string): string {
  return `${familyAppCollectionPath(familyId, 'shopping')}/favorites`;
}

export function shoppingFavoritePath(familyId: string, favoriteId: string): string {
  return `${shoppingFavoritesCollectionPath(familyId)}/${favoriteId}`;
}

export function salarySettingsCollectionPath(familyId: string): string {
  return `${familyAppCollectionPath(familyId, 'salary')}/settings`;
}

export function salarySettingsPath(familyId: string, uid: string): string {
  return `${salarySettingsCollectionPath(familyId)}/${uid}`;
}
