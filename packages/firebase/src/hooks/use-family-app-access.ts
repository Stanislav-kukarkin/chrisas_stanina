import { useQuery } from '@tanstack/react-query';
import { getDefaultFamilyId } from '../config';
import { getFamilyAppRole, type ShareableAppName } from '../app-sharing';
import { queryKeys } from '../query-keys';

export function useFamilyAppAccess(
  uid: string | undefined,
  appName: ShareableAppName,
  familyId = getDefaultFamilyId(),
) {
  const query = useQuery({
    queryKey: queryKeys.familyAppAccess(familyId, appName, uid ?? 'anonymous'),
    queryFn: () => getFamilyAppRole(uid!, appName, familyId),
    enabled: Boolean(uid),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  return {
    ...query,
    role: query.data ?? null,
    canView: query.data === 'view' || query.data === 'edit',
    canEdit: query.data === 'edit',
    familyId,
  };
}
