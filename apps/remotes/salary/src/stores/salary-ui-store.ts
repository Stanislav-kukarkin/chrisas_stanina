import {
  clampYearMonth,
  isYearMonthInLocalCalendarRange,
  type SalarySettings,
} from '@chrisasstanina/salary-flow-core';
import { create } from 'zustand';

export type SalaryPeriod = 'today' | 'week' | 'month';

interface SalaryUiState {
  period: SalaryPeriod;
  viewMonth: string;
  sessionSettings: SalarySettings | null;
  settingsOpen: boolean;
  immersiveOpen: boolean;
  setPeriod: (period: SalaryPeriod) => void;
  setViewMonth: (yearMonth: string) => void;
  shiftViewMonth: (delta: -1 | 1) => void;
  setSessionSettings: (settings: SalarySettings | null) => void;
  openSettings: () => void;
  closeSettings: () => void;
  openImmersive: () => void;
  closeImmersive: () => void;
}

function shiftYearMonth(yearMonth: string, delta: -1 | 1): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${nextYear}-${nextMonth}`;
}

export const useSalaryUiStore = create<SalaryUiState>((set, get) => ({
  period: 'today',
  viewMonth: '',
  sessionSettings: null,
  settingsOpen: false,
  immersiveOpen: false,
  setPeriod: (period) => set({ period }),
  setSessionSettings: (sessionSettings) => set({ sessionSettings }),
  setViewMonth: (viewMonth) => set({ viewMonth: clampYearMonth(viewMonth) }),
  shiftViewMonth: (delta) => {
    const current = get().viewMonth;
    if (!current) {
      return;
    }
    const next = shiftYearMonth(current, delta);
    if (!isYearMonthInLocalCalendarRange(next)) {
      return;
    }
    set({ viewMonth: next });
  },
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  openImmersive: () => set({ immersiveOpen: true }),
  closeImmersive: () => set({ immersiveOpen: false }),
}));
