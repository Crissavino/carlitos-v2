import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type DateRangeType = 'period' | 'cohort';

export interface DateRange {
  id: string;
  label: string;
  type: DateRangeType;
  // For periods (últimos N días)
  days?: number;
  // For cohorts (mes específico)
  startDate?: Date;
  monthsAvailable?: number;
}

// Available options - periods first, then cohorts
const AVAILABLE_OPTIONS: DateRange[] = [
  // Time periods
  { id: '7d', label: 'Últimos 7 días', type: 'period', days: 7 },
  { id: '14d', label: 'Últimos 14 días', type: 'period', days: 14 },
  { id: '30d', label: 'Últimos 30 días', type: 'period', days: 30 },
  { id: '60d', label: 'Últimos 60 días', type: 'period', days: 60 },
  // Cohorts (most recent first) - Today is Feb 7, 2026
  { id: '2026-02', label: 'Cohorte Feb 2026', type: 'cohort', startDate: new Date(2026, 1, 1), monthsAvailable: 0 },
  { id: '2026-01', label: 'Cohorte Ene 2026', type: 'cohort', startDate: new Date(2026, 0, 1), monthsAvailable: 1 },
  { id: '2025-12', label: 'Cohorte Dic 2025', type: 'cohort', startDate: new Date(2025, 11, 1), monthsAvailable: 2 },
  { id: '2025-11', label: 'Cohorte Nov 2025', type: 'cohort', startDate: new Date(2025, 10, 1), monthsAvailable: 3 },
  { id: '2025-10', label: 'Cohorte Oct 2025', type: 'cohort', startDate: new Date(2025, 9, 1), monthsAvailable: 4 },
  { id: '2025-09', label: 'Cohorte Sep 2025', type: 'cohort', startDate: new Date(2025, 8, 1), monthsAvailable: 5 },
  { id: '2025-08', label: 'Cohorte Ago 2025', type: 'cohort', startDate: new Date(2025, 7, 1), monthsAvailable: 6 },
];

interface DateRangeContextType {
  selectedRange: DateRange;
  setSelectedRange: (range: DateRange) => void;
  availableOptions: DateRange[];
  // Helper to check type
  isPeriod: boolean;
  isCohort: boolean;
  // For backwards compatibility and easy access
  days: number; // For periods: actual days, for cohorts: monthsAvailable * 30
  monthsAvailable: number; // For cohorts: actual months, for periods: days / 30
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

export function CohortProvider({ children }: { children: ReactNode }) {
  const [selectedRange, setSelectedRange] = useState<DateRange>(AVAILABLE_OPTIONS[0]); // Default: 7 days

  const isPeriod = selectedRange.type === 'period';
  const isCohort = selectedRange.type === 'cohort';

  // Normalize values for easy use in components
  const days = isPeriod ? (selectedRange.days || 7) : ((selectedRange.monthsAvailable || 0) * 30);
  const monthsAvailable = isCohort ? (selectedRange.monthsAvailable || 0) : Math.floor((selectedRange.days || 7) / 30);

  return (
    <DateRangeContext.Provider value={{
      selectedRange,
      setSelectedRange,
      availableOptions: AVAILABLE_OPTIONS,
      isPeriod,
      isCohort,
      days,
      monthsAvailable,
    }}>
      {children}
    </DateRangeContext.Provider>
  );
}

// Keep the old name for compatibility but also export new name
export function useCohort() {
  const context = useContext(DateRangeContext);
  if (!context) {
    throw new Error('useCohort must be used within a CohortProvider');
  }

  // Return a compatible interface for existing components
  return {
    selectedCohort: {
      ...context.selectedRange,
      monthsAvailable: context.monthsAvailable,
    },
    setSelectedCohort: context.setSelectedRange,
    availableCohorts: context.availableOptions,
    // New properties
    selectedRange: context.selectedRange,
    setSelectedRange: context.setSelectedRange,
    availableOptions: context.availableOptions,
    isPeriod: context.isPeriod,
    isCohort: context.isCohort,
    days: context.days,
    monthsAvailable: context.monthsAvailable,
  };
}

export const useDateRange = useCohort; // Alias
