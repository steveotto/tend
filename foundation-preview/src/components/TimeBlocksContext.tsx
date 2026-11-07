import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { createDefaultTimeBlockSettings, rhythmTimeOptionsForBlocks } from '../domain/time-blocks.ts';
import type { TimeBlockSettings } from '../domain/time-blocks.ts';

const TimeBlocksContext = createContext<TimeBlockSettings>(createDefaultTimeBlockSettings());

export function TimeBlocksProvider({ children, settings }: { children: ReactNode; settings: TimeBlockSettings }) {
  return <TimeBlocksContext.Provider value={settings}>{children}</TimeBlocksContext.Provider>;
}

export function useTimeBlockSettings(): TimeBlockSettings {
  return useContext(TimeBlocksContext);
}

export function useRhythmTimeOptions() {
  return rhythmTimeOptionsForBlocks(useTimeBlockSettings());
}
