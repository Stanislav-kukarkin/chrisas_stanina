import { create } from 'zustand';

interface ShoppingUiState {
  expandedItemId: string | null;
  setExpandedItemId: (id: string | null) => void;
  toggleExpandedItem: (id: string) => void;
}

export const useShoppingUiStore = create<ShoppingUiState>((set) => ({
  expandedItemId: null,
  setExpandedItemId: (id) => set({ expandedItemId: id }),
  toggleExpandedItem: (id) =>
    set((state) => ({ expandedItemId: state.expandedItemId === id ? null : id })),
}));
