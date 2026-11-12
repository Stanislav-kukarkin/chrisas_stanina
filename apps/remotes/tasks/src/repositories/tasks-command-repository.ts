import { getFirebaseFunctions } from '@chrisasstanina/firebase';
import { httpsCallable } from 'firebase/functions';

type CommandName =
  | 'transitionTask'
  | 'agreeDifficulty'
  | 'deleteTask'
  | 'claimDaily'
  | 'rerollDaily'
  | 'purchaseSystemItem'
  | 'openMysteryChest'
  | 'createFamilyReward'
  | 'purchaseFamilyReward'
  | 'resolveRewardRequest'
  | 'redeemInventoryItem'
  | 'equipProfileItem';

type CommandInput = Record<string, unknown> & { command: CommandName };

interface CommandResponse<T> {
  result: T;
}

export function serverTasksCommandsEnabled(): boolean {
  return import.meta.env.VITE_TASKS_SERVER_COMMANDS === 'true';
}

function commandId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function runTasksCommand<T>(familyId: string, input: CommandInput): Promise<T> {
  const callable = httpsCallable<CommandInput & { familyId: string; commandId: string }, CommandResponse<T>>(
    getFirebaseFunctions(),
    'tasksCommand',
  );
  const response = await callable({ ...input, familyId, commandId: commandId() });
  return response.data.result;
}
