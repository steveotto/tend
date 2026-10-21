/** Shared interactions, explicit category capabilities; no scoring policy implied. */
export type FoundationCapabilities = {
  rhythms: boolean;
  numericGoals: boolean;
  completion: 'ongoing' | 'milestone' | 'mixed';
};
export type GoalMeasure = {
  kind: 'money' | 'weight';
  direction: 'increase' | 'decrease';
  unit: string;
};
export type FoundationLifecycle = 'not-started' | 'active' | 'paused' | 'completed' | 'not-applicable';
export type RhythmAutomation = 'manual' | 'external';
// External automation is metadata, never evidence that money moved or an occurrence completed.
