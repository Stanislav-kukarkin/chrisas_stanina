import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ensureUserBootstrap } from '../../bootstrap';
import { isFirebaseReady } from '../../init';
import { queryKeys } from '../../query-keys';

export function useUserBootstrap(uid: string | undefined, email: string | undefined) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['userBootstrap', uid ?? 'none'],
    queryFn: async () => {
      if (!uid) {
        return false;
      }
      await ensureUserBootstrap(uid, email ?? '');
      await queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(uid) });
      return true;
    },
    enabled: Boolean(uid) && isFirebaseReady(),
    staleTime: Number.POSITIVE_INFINITY,
    retry: 2,
  });
}
