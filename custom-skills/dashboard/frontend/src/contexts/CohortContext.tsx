import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface Cohort {
  id: string;
  label: string;
  startDate: Date;
  monthsAvailable: number; // How many complete months of data we have
}

// Available cohorts (most recent first)
const AVAILABLE_COHORTS: Cohort[] = [
  { id: '2026-01', label: 'Ene 2026', startDate: new Date(2026, 0, 1), monthsAvailable: 1 },
  { id: '2025-12', label: 'Dic 2025', startDate: new Date(2025, 11, 1), monthsAvailable: 2 },
  { id: '2025-11', label: 'Nov 2025', startDate: new Date(2025, 10, 1), monthsAvailable: 3 },
  { id: '2025-10', label: 'Oct 2025', startDate: new Date(2025, 9, 1), monthsAvailable: 4 },
  { id: '2025-09', label: 'Sep 2025', startDate: new Date(2025, 8, 1), monthsAvailable: 5 },
  { id: '2025-08', label: 'Ago 2025', startDate: new Date(2025, 7, 1), monthsAvailable: 6 },
];

interface CohortContextType {
  selectedCohort: Cohort;
  setSelectedCohort: (cohort: Cohort) => void;
  availableCohorts: Cohort[];
}

const CohortContext = createContext<CohortContextType | undefined>(undefined);

export function CohortProvider({ children }: { children: ReactNode }) {
  const [selectedCohort, setSelectedCohort] = useState<Cohort>(AVAILABLE_COHORTS[0]);

  return (
    <CohortContext.Provider value={{
      selectedCohort,
      setSelectedCohort,
      availableCohorts: AVAILABLE_COHORTS
    }}>
      {children}
    </CohortContext.Provider>
  );
}

export function useCohort() {
  const context = useContext(CohortContext);
  if (!context) {
    throw new Error('useCohort must be used within a CohortProvider');
  }
  return context;
}
