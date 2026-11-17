export type FamilyAppName = 'tasks' | 'shopping' | 'recipes' | 'budget' | 'cashback' | 'salary' | 'payments';

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

export function shoppingListsCollectionPath(familyId: string): string {
  return `${familyAppCollectionPath(familyId, 'shopping')}/lists`;
}

export function shoppingListPath(familyId: string, listId: string): string {
  return `${shoppingListsCollectionPath(familyId)}/${listId}`;
}

export function shoppingListItemsCollectionPath(familyId: string, listId: string): string {
  return listId === 'main'
    ? shoppingItemsCollectionPath(familyId)
    : `${shoppingListPath(familyId, listId)}/items`;
}

export function shoppingListItemPath(familyId: string, listId: string, itemId: string): string {
  return `${shoppingListItemsCollectionPath(familyId, listId)}/${itemId}`;
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

export function recipesCollectionPath(familyId: string): string {
  return `${familyAppCollectionPath(familyId, 'recipes')}/recipes`;
}

export function recipePath(familyId: string, recipeId: string): string {
  return `${recipesCollectionPath(familyId)}/${recipeId}`;
}
