import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getDefaultFamilyId,
  migrateLegacyFamilyAccess,
  queryKeys,
  useFamilyAppAccess,
  useFamilyMembers,
  useFirebaseUser,
  useUserProfile,
  type FamilyMemberWithProfile,
} from '@chrisasstanina/firebase';
import {
  ensureBoardBootstrap,
  fetchBoss,
  fetchPlayerProfile,
  fetchTasks,
} from '../repositories/tasks-repository';
import { configureTasksService } from '../services/tasks-service';
import { useTasksStore } from '../stores/tasks-store';
import type { FamilyMember } from '../domain/task';

function displayName(member: FamilyMemberWithProfile) {
  return member.profile?.displayName || member.email || 'Участник';
}

function mapMember(member: FamilyMemberWithProfile): FamilyMember {
  const name = displayName(member);
  return {
    id: member.uid,
    name,
    initials: member.profile?.emoji || name.trim().charAt(0).toLocaleUpperCase('ru-RU') || '•',
    color: member.profile?.color || '#7c5ce0',
  };
}

export function FirebaseBoardBridge() {
  const user = useFirebaseUser();
  const familyId = getDefaultFamilyId();
  const queryClient = useQueryClient();
  const setSyncState = useTasksStore((state) => state.setSyncState);
  const hydrateRemoteBoard = useTasksStore((state) => state.hydrateRemoteBoard);
  const access = useFamilyAppAccess(user?.uid, 'tasks', familyId);
  const userProfile = useUserProfile(user?.uid);

  const migration = useQuery({
    queryKey: ['tasks', 'legacy-access-migration', familyId, user?.uid ?? 'anonymous'],
    queryFn: () => migrateLegacyFamilyAccess(user!.uid, familyId),
    enabled: Boolean(user),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!user || !migration.isSuccess) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.familyAppAccess(familyId, 'tasks', user.uid),
    });
  }, [familyId, migration.isSuccess, queryClient, user]);

  const membersQuery = useFamilyMembers(familyId, Boolean(user && access.canView));
  const currentUserName = userProfile.data?.displayName || user?.displayName || user?.email || 'Игрок';
  const boardQuery = useQuery({
    queryKey: ['tasks', 'board', familyId, user?.uid ?? 'anonymous'],
    queryFn: async () => {
      await ensureBoardBootstrap({
        familyId,
        currentUserId: user!.uid,
        currentUserName,
      });
      const [tasks, profile, boss] = await Promise.all([
        fetchTasks(familyId),
        fetchPlayerProfile(familyId, user!.uid),
        fetchBoss(familyId),
      ]);
      return { tasks, profile, boss };
    },
    enabled: Boolean(user && access.canView),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const {
    data: boardData,
    error: boardError,
    isError: boardIsError,
    isLoading: boardIsLoading,
    refetch: refetchBoard,
  } = boardQuery;

  const members = useMemo(() => {
    const mapped = (membersQuery.data ?? []).map(mapMember);
    if (user && !mapped.some((member) => member.id === user.uid)) {
      mapped.unshift({
        id: user.uid,
        name: currentUserName,
        initials: userProfile.data?.emoji || currentUserName.charAt(0).toLocaleUpperCase('ru-RU'),
        color: userProfile.data?.color || '#7c5ce0',
      });
    }
    return mapped;
  }, [currentUserName, membersQuery.data, user, userProfile.data?.color, userProfile.data?.emoji]);

  useEffect(() => {
    if (!user) {
      configureTasksService(null);
      setSyncState('demo');
      return;
    }
    if (migration.isLoading || access.isLoading) {
      setSyncState('loading');
      return;
    }
    if (migration.isError) {
      setSyncState('error', migration.error instanceof Error ? migration.error.message : 'Не удалось проверить доступ.');
      return;
    }
    if (!access.canView) {
      configureTasksService(null);
      setSyncState('denied');
      return;
    }
    if (boardIsLoading) {
      setSyncState('loading');
      return;
    }
    if (boardIsError) {
      setSyncState('error', boardError instanceof Error ? boardError.message : 'Не удалось загрузить доску.');
      return;
    }
    if (!boardData) return;

    hydrateRemoteBoard({
      ...boardData,
      members,
      currentUserId: user.uid,
      canEdit: access.canEdit,
    });
    configureTasksService({
      repository: {
        familyId,
        currentUserId: user.uid,
        currentUserName,
      },
      canEdit: access.canEdit,
      refresh: async () => { await refetchBoard(); },
    });
    return () => configureTasksService(null);
  }, [
    access.canEdit,
    access.canView,
    access.isLoading,
    boardData,
    boardError,
    boardIsError,
    boardIsLoading,
    currentUserName,
    familyId,
    hydrateRemoteBoard,
    members,
    migration.error,
    migration.isError,
    migration.isLoading,
    refetchBoard,
    setSyncState,
    user,
  ]);

  return null;
}
