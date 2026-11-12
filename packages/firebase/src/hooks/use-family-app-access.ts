import { useQuery } from '@tanstack/react-query';
import { getFamilyAppRole, type ShareableAppName } from '../app-sharing';
import { resolveAppWorkspace } from '../app-workspaces';
import { queryKeys } from '../query-keys';

export function useFamilyAppAccess(
  uid: string | undefined,
  appName: ShareableAppName,
  familyId?: string,
) {
  const query = useQuery({
    queryKey: familyId
      ? queryKeys.familyAppAccess(familyId, appName, uid ?? 'anonymous')
      : queryKeys.appWorkspace(uid ?? 'anonymous', appName),
    queryFn: async () => {
      if (familyId) {
        const role = await getFamilyAppRole(uid!, appName, familyId);
        return role ? { familyId, role, source: 'shared' as const } : null;
      }
      return resolveAppWorkspace(uid!, appName);
    },
    enabled: Boolean(uid),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    role: query.data?.role ?? null,
    canView: query.data?.role === 'view' || query.data?.role === 'edit',
    canEdit: query.data?.role === 'edit',
    familyId: query.data?.familyId ?? familyId ?? null,
    source: query.data?.source ?? null,
  };
}
