export type GamificationEvent =
  | { type: 'task_completed'; taskId: string; title: string; userIds: string[]; reviewerId: string; bossDamage: number }
  | { type: 'boss_defeated'; taskId: string; title: string; userIds: string[] }
  | { type: 'achievement'; achievementId: string; title: string; userId: string }
  | { type: 'daily_chest'; dateKey: string; userId: string }
  | { type: 'chest_opened'; chestNumber: number; title: string; rarity: string; userId: string }
  | { type: 'level_milestone'; level: number; userId: string }
  | { type: 'reward_resolved'; requestId: string; title: string; userId: string; decision: 'approved' | 'rejected' };

export function gamificationEventId(event: GamificationEvent): string {
  switch (event.type) {
    case 'task_completed': return `taskCompleted_${event.taskId}_v1`;
    case 'boss_defeated': return `bossDefeated_${event.taskId}`;
    case 'achievement': return `achievement_${event.userId}_${event.achievementId}`;
    case 'daily_chest': return `dailyChest_${event.dateKey}_${event.userId}`;
    case 'chest_opened': return `chestOpened_${event.userId}_${event.chestNumber}`;
    case 'level_milestone': return `levelMilestone_${event.userId}_${event.level}`;
    case 'reward_resolved': return `rewardRequest_${event.requestId}_${event.decision}`;
  }
}

export function activityFromGamificationEvent(event: GamificationEvent) {
  switch (event.type) {
    case 'task_completed':
      return { type: event.type, taskId: event.taskId, title: event.title, userIds: event.userIds, reviewerId: event.reviewerId, bossDamage: event.bossDamage };
    case 'boss_defeated':
      return { type: event.type, taskId: event.taskId, title: event.title, userIds: event.userIds };
    case 'achievement':
      return { type: event.type, title: event.title, userIds: [event.userId] };
    case 'daily_chest':
      return { type: event.type, title: 'Сундук дня', userIds: [event.userId] };
    case 'chest_opened':
      return { type: event.type, title: event.title, userIds: [event.userId], rarity: event.rarity };
    case 'level_milestone':
      return { type: event.type, title: `Уровень ${event.level}`, userIds: [event.userId] };
    case 'reward_resolved':
      return { type: event.decision === 'approved' ? 'reward_approved' : 'reward_rejected', title: event.title, userIds: [event.userId] };
  }
}
