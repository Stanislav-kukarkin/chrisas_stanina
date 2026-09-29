import { useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  buildMonthViewStats,
  clampYearMonth,
  DEFAULT_SALARY_SETTINGS,
  getDateIsoInTimezone,
  resolveSalarySettings,
  LOCAL_CALENDAR_MAX_MONTH,
  LOCAL_CALENDAR_MIN_MONTH,
} from '@chrisasstanina/salary-flow-core';
import {
  getFirebaseConfigFromEnv,
  initializeFirebase,
  useFirebaseUser,
  useSalarySettings,
  useUpdateSalarySettings,
} from '@chrisasstanina/firebase';
import { Aurora, BlurText, FadeIn, GlassPanel } from '@chrisasstanina/ui';
import { DailyRateCard } from './components/DailyRateCard';
import { HowItWorksSection } from './components/HowItWorksSection';
import { MonthCalendar } from './components/MonthCalendar';
import { MonthProgress } from './components/MonthProgress';
import { PeriodSwitcher } from './components/PeriodSwitcher';
import { SalaryImmersiveView } from './components/SalaryImmersiveView';
import { SalaryWidget } from './components/SalaryWidget';
import { SettingsModal } from './components/SettingsModal';
import { WeekView } from './components/WeekView';
import { useProductionCalendar } from './hooks/useProductionCalendar';
import { useSalaryTicker } from './hooks/useSalaryTicker';
import { useSalaryUiStore } from './stores/salary-ui-store';

initializeFirebase(getFirebaseConfigFromEnv());

export default function App() {
  const user = useFirebaseUser();
  const { data: persistedSettings, isLoading: settingsLoading } = useSalarySettings(user?.uid);
  const sessionSettings = useSalaryUiStore((store) => store.sessionSettings);
  const setSessionSettings = useSalaryUiStore((store) => store.setSessionSettings);
  const rawSettings = sessionSettings ?? persistedSettings ?? DEFAULT_SALARY_SETTINGS;
  const settings = useMemo(() => resolveSalarySettings(rawSettings), [rawSettings]);
  const updateSettings = useUpdateSalarySettings(user?.uid);
  const { data: calendar, isLoading: calendarLoading } = useProductionCalendar();
  const state = useSalaryTicker(settings, calendar);
  const period = useSalaryUiStore((store) => store.period);
  const settingsOpen = useSalaryUiStore((store) => store.settingsOpen);
  const openSettings = useSalaryUiStore((store) => store.openSettings);
  const closeSettings = useSalaryUiStore((store) => store.closeSettings);
  const immersiveOpen = useSalaryUiStore((store) => store.immersiveOpen);
  const closeImmersive = useSalaryUiStore((store) => store.closeImmersive);
  const viewMonth = useSalaryUiStore((store) => store.viewMonth);
  const setViewMonth = useSalaryUiStore((store) => store.setViewMonth);
  const shiftViewMonth = useSalaryUiStore((store) => store.shiftViewMonth);

  const todayIso = getDateIsoInTimezone(Date.now(), settings.timezone);
  const currentYearMonth = todayIso.slice(0, 7);
  const activeYearMonth = viewMonth || currentYearMonth;

  useEffect(() => {
    const initialMonth = clampYearMonth(viewMonth || currentYearMonth);
    if (viewMonth !== initialMonth) {
      setViewMonth(initialMonth);
    }
  }, [currentYearMonth, setViewMonth, viewMonth]);

  useEffect(() => {
    setSessionSettings(null);
  }, [user?.uid, setSessionSettings]);

  const monthLabel = format(parseISO(`${activeYearMonth}-01`), 'LLLL yyyy', { locale: ru });
  const monthDays =
    calendar?.days.filter((day) => day.date.startsWith(activeYearMonth)) ?? [];
  const monthStats = useMemo(() => {
    if (!calendar) {
      return null;
    }
    return buildMonthViewStats(settings, calendar, activeYearMonth, Date.now());
  }, [activeYearMonth, calendar, settings]);

  if (settingsLoading || calendarLoading || !state || !calendar) {
    return (
      <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
        <Aurora />
        <div className="relative z-10 flex flex-1 items-center justify-center text-zinc-400">
          Загрузка Salary Flow...
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <Aurora />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <BlurText text="Salary Flow" as="h1" align="left" className="text-3xl md:text-4xl" />
            <p className="mt-2 text-sm text-zinc-400">Сколько ты уже заработал сегодня</p>
          </div>
          <button
            type="button"
            onClick={openSettings}
            className="self-start rounded-xl border border-zinc-700 bg-zinc-900/70 px-4 py-2 text-sm text-zinc-300 hover:border-teal-500/40 hover:text-teal-200"
          >
            Настройки
          </button>
        </div>

        {state.isFallbackCalendar && (
          <GlassPanel className="border-amber-500/20 p-4 text-sm text-amber-100/90">
            Для этого года нет локального календаря — используется упрощённый (пн–пт без
            праздников).
          </GlassPanel>
        )}

        <PeriodSwitcher />

        <FadeIn index={0}>
          {period === 'today' && (
            <SalaryWidget
              state={state}
              currency={settings.currency}
              visualizationType={rawSettings.visualizationType}
            />
          )}
          {period === 'week' && (
            <WeekView
              settings={settings}
              calendar={calendar}
              state={state}
              currency={settings.currency}
            />
          )}
          {period === 'month' && monthStats && (
            <div className="space-y-6">
              <MonthProgress
                stats={monthStats}
                currency={settings.currency}
                monthLabel={monthLabel}
                monthlySalary={settings.monthlySalary}
                currentYearMonth={currentYearMonth}
              />
              <DailyRateCard
                dailyRate={monthStats.dailyRate}
                workingDaysInMonth={monthStats.workingDaysInMonth}
                currency={settings.currency}
              />
              <MonthCalendar
                days={monthDays}
                monthLabel={monthLabel}
                todayIso={todayIso}
                onPreviousMonth={() => shiftViewMonth(-1)}
                onNextMonth={() => shiftViewMonth(1)}
                canGoPrevious={activeYearMonth > LOCAL_CALENDAR_MIN_MONTH}
                canGoNext={activeYearMonth < LOCAL_CALENDAR_MAX_MONTH}
              />
            </div>
          )}
        </FadeIn>

        <HowItWorksSection settings={settings} state={state} />
      </div>

      <SettingsModal
        open={settingsOpen}
        draftSettings={rawSettings}
        userId={user?.uid}
        isSaving={updateSettings.isPending}
        onClose={closeSettings}
        onSave={async (update, { remember }) => {
          if (remember) {
            await updateSettings.mutateAsync(update);
            setSessionSettings(null);
            return;
          }

          setSessionSettings({ ...update, source: update.source ?? 'personal' });
        }}
      />

      <SalaryImmersiveView
        open={immersiveOpen}
        state={state}
        currency={settings.currency}
        visualizationType={rawSettings.visualizationType}
        onClose={closeImmersive}
      />
    </div>
  );
}
