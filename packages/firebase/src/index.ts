export {
  getFirebaseConfigFromEnv,
  getDefaultFamilyId,
  getMissingFirebaseEnvKeys,
  isFirebaseConfigured,
  type FirebaseConfig,
} from './config';
export {
  initializeFirebase,
  isFirebaseReady,
  getFirebaseAuth,
  getFirebaseFirestore,
  type FirebaseServices,
} from './init';
export { ensureUserBootstrap, computeProfileComplete } from './bootstrap';
export { BootstrapProvider } from './bootstrap-provider';
export {
  familyDocPath,
  familyAppCollectionPath,
  familyAppDocPath,
  userProfilePath,
  familyMembersCollectionPath,
  familyMemberPath,
  shoppingItemsCollectionPath,
  shoppingItemPath,
  shoppingFavoritesCollectionPath,
  shoppingFavoritePath,
  salarySettingsCollectionPath,
  salarySettingsPath,
  type FamilyAppName,
} from './paths';
export { queryKeys } from './query-keys';
export { useFamilyCollection } from './hooks/use-family-collection';
export { useFamilyDoc } from './hooks/use-family-doc';
export {
  useUserProfile,
  useProfileComplete,
  fetchUserProfile,
} from './hooks/profile/use-user-profile';
export { useUserBootstrap } from './hooks/profile/use-user-bootstrap';
export { useFirebaseUser } from './hooks/use-firebase-user';
export { useUpdateProfile } from './hooks/profile/use-update-profile';
export {
  useFamilyMembers,
  type FamilyMemberWithProfile,
} from './hooks/profile/use-family-members';
export {
  useShoppingItems,
  useAddShoppingItem,
  useUpdateShoppingItem,
  useToggleShoppingItem,
  useDeleteShoppingItem,
  useClearCheckedItems,
} from './hooks/shopping/use-shopping-items';
export {
  useShoppingFavorites,
  useAddShoppingFavorite,
} from './hooks/shopping/use-shopping-favorites';
export {
  type UserProfile,
  type FamilyMember,
  type UserProfileInput,
  type MemberRole,
  PROFILE_COLORS,
  PROFILE_EMOJIS,
  isProfileComplete,
  defaultDisplayNameFromEmail,
  randomProfileColor,
} from './types/profile';
export {
  type ShoppingItem,
  type ShoppingItemInput,
  type ShoppingItemUpdate,
  type ShoppingFavorite,
  type ShoppingFavoriteInput,
  type ShoppingUnit,
} from './types/shopping';
export { SHOPPING_CATEGORIES, SHOPPING_UNITS, type ShoppingCategory } from './constants/shopping-categories';
export {
  useSalarySettings,
  useUpdateSalarySettings,
} from './hooks/salary/use-salary-settings';
export {
  type SalarySettings,
  type SalarySettingsInput,
  type SalarySettingsUpdate,
  type SalarySettingsSource,
} from './types/salary';
