import { describe, expect, it } from 'vitest';
import { activityFromGamificationEvent, gamificationEventId } from './gamification-events';

describe('gamification events', () => {
  it('uses deterministic ids for idempotent events', () => {
    const event = { type: 'task_completed' as const, taskId: 'task-1', title: 'Полить цветы', userIds: ['u1'], reviewerId: 'u2', bossDamage: 20 };
    expect(gamificationEventId(event)).toBe('taskCompleted_task-1_v1');
    expect(gamificationEventId(event)).toBe(gamificationEventId(event));
  });

  it('maps domain events to activity documents', () => {
    expect(activityFromGamificationEvent({ type: 'daily_chest', dateKey: '2026-10-11', userId: 'u1' })).toEqual({
      type: 'daily_chest', title: 'Сундук дня', userIds: ['u1'],
    });
  });
});
