import { useQuery } from '@tanstack/react-query';
import type { ProductionCalendar } from '@chrisasstanina/salary-flow-core';
import { fetchAvailableProductionCalendar } from '../lib/calendar-client';

export function useProductionCalendar() {
  return useQuery({
    queryKey: ['salary', 'calendar', 'ru', 'available'],
    queryFn: (): Promise<ProductionCalendar> => fetchAvailableProductionCalendar(),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
}
