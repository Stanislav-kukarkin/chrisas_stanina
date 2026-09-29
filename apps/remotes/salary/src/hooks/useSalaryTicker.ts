import { useEffect, useState } from 'react';
import { buildSalaryProgressState, type ProductionCalendar, type SalarySettings } from '@chrisasstanina/salary-flow-core';

export function useSalaryTicker(
  settings: SalarySettings | undefined,
  calendar: ProductionCalendar | undefined,
) {
  const [timestamp, setTimestamp] = useState(() => Date.now());

  useEffect(() => {
    let frameId = 0;

    const tick = () => {
      setTimestamp(Date.now());
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimestamp(Date.now());
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  if (!settings || !calendar) {
    return null;
  }

  return buildSalaryProgressState(settings, calendar, timestamp);
}
