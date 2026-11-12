import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  migrateLegacyFamilyAccess,
  queryKeys,
  useFamilyAppAccess,
  useFamilyMembers,
  useFirebaseUser,
  useUserProfile,
  type FamilyMemberWithProfile,
} from '@chrisasstanina/firebase';
import {
  fetchBoss,
  fetchActivity,
  fetchCoinTransactions,
  fetchAllPlayerProfiles,
  fetchDailyState,
  fetchFamilyRewards,
  fetchInventory,
  fetchPlayerProfile,
  fetchRewardRequests,
  fetchSprintHistory,
  fetchTasks,
  reconcileBoard,
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
  const queryClient = useQueryClient();
  const setSyncState = useTasksStore((state) => state.setSyncState);
  const hydrateRemoteBoard = useTasksStore((state) => state.hydrateRemoteBoard);
  const access = useFamilyAppAccess(user?.uid, 'tasks');
  const familyId = access.familyId ?? '';
  const userProfile = useUserProfile(user?.uid);

  const migration = useQuery({
    queryKey: ['tasks', 'legacy-access-migration', familyId, user?.uid ?? 'anonymous'],
    queryFn: () => migrateLegacyFamilyAccess(user!.uid, familyId),
    enabled: Boolean(user && familyId),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!user || !migration.isSuccess) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.appWorkspace(user.uid, 'tasks'),
    });
  }, [familyId, migration.isSuccess, queryClient, user]);

  const membersQuery = useFamilyMembers(familyId, Boolean(user && access.canView), 'tasks');
  const currentUserName = userProfile.data?.displayName || user?.displayName || user?.email || 'Игрок';
  const boardQuery = useQuery({
    queryKey: ['tasks', 'board', familyId, user?.uid ?? 'anonymous'],
    queryFn: async () => {
      const context = {
        familyId,
        currentUserId: user!.uid,
        currentUserName,
      };
      if (access.canEdit) await reconcileBoard(context);
      const [tasks, profile, boss, history, profiles, activity, familyRewards, inventory, rewardRequests, coinTransactions] = await Promise.all([
        fetchTasks(familyId),
        fetchPlayerProfile(familyId, user!.uid),
        fetchBoss(familyId),
        fetchSprintHistory(familyId),
        fetchAllPlayerProfiles(familyId),
        fetchActivity(familyId),
        fetchFamilyRewards(familyId),
        fetchInventory(familyId, user!.uid),
        fetchRewardRequests(familyId, user!.uid),
        fetchCoinTransactions(familyId, user!.uid),
      ]);
      const daily = await fetchDailyState(familyId, user!.uid, tasks);
      return { tasks, profile, boss, history, daily, profiles, activity, familyRewards, inventory, rewardRequests, coinTransactions };
    },
    enabled: Boolean(user && familyId && access.canView),
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
      setSyncState('denied');
      return;
    }
    if (migration.isLoading || access.isLoading) {
      setSyncState('loading');
      return;
    }
    if (migration.isError || access.isError) {
      const error = migration.error ?? access.error;
      setSyncState('error', error instanceof Error ? error.message : 'Не удалось проверить доступ.');
      return;
    }
    if (!access.canView) {
      configureTasksService(null);
      setSyncState('denied');
      return;
    }
    if (boardIsLoading || membersQuery.isLoading) {
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
    access.error,
    access.isError,
    access.isLoading,
    boardData,
    boardError,
    boardIsError,
    boardIsLoading,
    currentUserName,
    familyId,
    hydrateRemoteBoard,
    members,
    membersQuery.isLoading,
    migration.error,
    migration.isError,
    migration.isLoading,
    refetchBoard,
    setSyncState,
    user,
  ]);

  return null;
}
