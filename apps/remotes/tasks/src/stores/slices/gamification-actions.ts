import {
  claimRemoteDailyQuest,
  createRemoteFamilyReward,
  equipRemoteProfileItem,
  openRemoteMysteryChest,
  purchaseRemoteFamilyReward,
  purchaseRemoteSystemItem,
  redeemRemoteInventoryItem,
  rerollRemoteDaily,
  resolveRemoteRewardRequest,
} from '../../services/tasks-service';
import { errorMessage, toast, type TasksGet, type TasksSet } from '../tasks-store.helpers';
import type { TasksState } from '../tasks-store.types';

type GamificationActions = Pick<TasksState,
  | 'claimDaily' | 'rerollDaily' | 'buySystemItem' | 'openChest' | 'buyFamilyReward'
  | 'createFamilyReward' | 'resolveRewardRequest' | 'redeemInventoryItem' | 'equipProfileItem'>;

export function createGamificationActions(set: TasksSet, get: TasksGet): GamificationActions {
  return {
    claimDaily: async (questId) => {
      set({ dailyPending: true });
      try {
        await claimRemoteDailyQuest(questId);
        set({ dailyPending: false, toast: toast('Daily получен', 'Coins начислены в кошелёк.', 'success') });
      } catch (errorValue) {
        set({ dailyPending: false, toast: toast('Награда недоступна', errorMessage(errorValue), 'warning') });
      }
    },
    rerollDaily: async () => {
      set({ dailyPending: true });
      try {
        await rerollRemoteDaily();
        set({ dailyPending: false, toast: toast('Daily обновлены', 'Новый набор готов.', 'neutral') });
      } catch (errorValue) {
        set({ dailyPending: false, toast: toast('Reroll недоступен', errorMessage(errorValue), 'warning') });
      }
    },
    buySystemItem: async (itemId) => {
      if (get().shopPending) return;
      set({ shopPending: true });
      try {
        const result = await purchaseRemoteSystemItem(itemId);
        set({ shopPending: false, toast: toast('Покупка получена', result, 'success') });
      } catch (errorValue) {
        set({ shopPending: false, toast: toast('Покупка не удалась', errorMessage(errorValue), 'warning') });
      }
    },
    openChest: async () => {
      if (get().shopPending) return;
      set({ shopPending: true });
      try {
        const result = await openRemoteMysteryChest();
        set({ shopPending: false, toast: toast('Сундук открыт', result, 'success'), celebration: { id: Date.now(), kind: 'chest', title: 'Сундук открыт!', detail: result } });
      } catch (errorValue) {
        set({ shopPending: false, toast: toast('Не удалось открыть сундук', errorMessage(errorValue), 'warning') });
      }
    },
    buyFamilyReward: async (rewardId) => {
      if (get().shopPending) return;
      set({ shopPending: true });
      try {
        await purchaseRemoteFamilyReward(rewardId);
        set({ shopPending: false, toast: toast('Награда в инвентаре', 'Используйте её, когда будете готовы.', 'success') });
      } catch (errorValue) {
        set({ shopPending: false, toast: toast('Покупка не удалась', errorMessage(errorValue), 'warning') });
      }
    },
    createFamilyReward: async (input) => {
      set({ shopPending: true });
      try {
        await createRemoteFamilyReward(input);
        set({ shopPending: false, toast: toast('Награда добавлена', input.title, 'success') });
      } catch (errorValue) {
        set({ shopPending: false, toast: toast('Не удалось добавить награду', errorMessage(errorValue), 'warning') });
        throw errorValue;
      }
    },
    resolveRewardRequest: async (requestId, decision) => {
      if (get().shopPending) return;
      set({ shopPending: true });
      try {
        await resolveRemoteRewardRequest(requestId, decision);
        set({ shopPending: false, toast: toast(decision === 'approved' ? 'Награда подтверждена' : 'Запрос отклонён', decision === 'approved' ? 'Договорённость отмечена выполненной.' : 'Награда возвращена владельцу.', 'success') });
      } catch (errorValue) {
        set({ shopPending: false, toast: toast('Не удалось обработать запрос', errorMessage(errorValue), 'warning') });
      }
    },
    redeemInventoryItem: async (inventoryId) => {
      set({ shopPending: true });
      try {
        await redeemRemoteInventoryItem(inventoryId);
        set({ shopPending: false, toast: toast('Запрос отправлен', 'Создатель семейной награды увидит запрос.', 'success') });
      } catch (errorValue) {
        set({ shopPending: false, toast: toast('Не удалось использовать', errorMessage(errorValue), 'warning') });
      }
    },
    equipProfileItem: async (inventoryId) => {
      set({ shopPending: true });
      try {
        await equipRemoteProfileItem(inventoryId);
        set({ shopPending: false, toast: toast('Профиль обновлён', 'Косметика видна всей семье.', 'success') });
      } catch (errorValue) {
        set({ shopPending: false, toast: toast('Не удалось экипировать', errorMessage(errorValue), 'warning') });
      }
    },
  };
}
