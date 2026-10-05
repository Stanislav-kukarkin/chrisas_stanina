import { taskReward, type FamilyTask } from './task';

export function settledTasks(tasks: FamilyTask[]) {
  return tasks.filter((task) => task.rewardSettledAt || task.status === 'done');
}

export function onTimeTaskCount(tasks: FamilyTask[]) {
  return settledTasks(tasks).filter((task) => task.dueTone !== 'overdue').length;
}

export function earnedAchievementCount(tasks: FamilyTask[], streak: number) {
  const completed = settledTasks(tasks).length;
  const onTime = onTimeTaskCount(tasks);
  return Number(completed >= 50) + Number(streak >= 14) + Number(onTime >= 25);
}

export function bossDamageForMember(tasks: FamilyTask[], memberId: string) {
  return tasks.reduce((total, task) => {
    if (!task.bossDamageSettledAt || !task.assigneeIds.includes(memberId)) return total;
    return total + taskReward(task).bossDamage / Math.max(1, task.assigneeIds.length);
  }, 0);
}
