import { isValidDate } from './money-goals.ts';

export const flexibilityRegions = [
  { id: 'hamstrings', name: 'Hamstrings', group: 'Posterior chain', defaultIntervalDays: 2 },
  { id: 'calves', name: 'Calves', group: 'Posterior chain', defaultIntervalDays: 3 },
  { id: 'glutes', name: 'Glutes', group: 'Posterior chain', defaultIntervalDays: 2 },
  { id: 'abs', name: 'Abs', group: 'Core', defaultIntervalDays: 3 },
  { id: 'hip-flexors', name: 'Hip flexors', group: 'Front of hip and legs', defaultIntervalDays: 2 },
  { id: 'quads', name: 'Quads', group: 'Front of hip and legs', defaultIntervalDays: 3 },
  { id: 'chest', name: 'Chest', group: 'Upper body', defaultIntervalDays: 3 },
  { id: 'shoulders', name: 'Shoulders', group: 'Upper body', defaultIntervalDays: 3 },
  { id: 'back', name: 'Back', group: 'Upper body', defaultIntervalDays: 3 },
  { id: 'neck', name: 'Neck', group: 'Upper body', defaultIntervalDays: 2 }
] as const;

export type FlexibilityRegionId = (typeof flexibilityRegions)[number]['id'];

export type FlexibilitySession = {
  id: string;
  date: string;
  regionIds: FlexibilityRegionId[];
  minutes?: number;
  notes?: string;
};

export type FlexibilityRoutineSide = 'left' | 'right' | 'both';
export type FlexibilityTimerDirection = 'down' | 'up';
export type FlexibilityGuidedTimer = {
  phase: 'idle' | 'preparing' | 'holding' | 'paused' | 'complete';
  deadlineAt?: string;
  remainingMilliseconds?: number;
  holdStartedAt?: string;
  pausedFrom?: 'preparing' | 'holding';
  elapsedBeforePauseMilliseconds?: number;
};

export type FlexibilityRoutineStretch = {
  id: string;
  name: string;
  regionIds: FlexibilityRegionId[];
  sideMode: 'both' | 'each';
  holdSeconds: number;
  instructions?: string;
};

export type SavedFlexibilityRoutine = {
  id: string;
  name: string;
  stretches: FlexibilityRoutineStretch[];
  preparationSeconds: 0 | 3 | 5 | 10;
  timerDirection: FlexibilityTimerDirection;
};

export type FlexibilityGuidedHold = {
  id: string;
  stretchId: string;
  stretchName: string;
  regionIds: FlexibilityRegionId[];
  side: FlexibilityRoutineSide;
  round: number;
  targetSeconds: number;
  preparationSeconds?: 0 | 3 | 5 | 10;
  timerDirection?: FlexibilityTimerDirection;
  actualSeconds?: number;
  status: 'pending' | 'completed' | 'skipped';
  completedAt?: string;
};

export type FlexibilityGuidedSession = {
  id: string;
  routineId: string;
  routineName: string;
  routineSnapshot: SavedFlexibilityRoutine;
  date: string;
  startedAt: string;
  timeZone: string;
  holds: FlexibilityGuidedHold[];
  notes: string;
  linkedRhythmId?: string;
  rhythmOccurrence?: string;
  completionId?: string;
};

export type FlexibilityGuidedSessionDraft = FlexibilityGuidedSession & {
  currentHoldIndex: number;
  timer: FlexibilityGuidedTimer;
  preparationSeconds: 0 | 3 | 5 | 10;
  timerDirection: FlexibilityTimerDirection;
  soundEnabled: boolean;
};

export type FlexibilitySessionDraft = {
  date: string;
  regionIds: FlexibilityRegionId[];
  minutes: string;
  notes: string;
  editingSessionId?: string;
};

export type FlexibilityData = {
  settings: { intervals: Partial<Record<FlexibilityRegionId, number>> };
  sessions: FlexibilitySession[];
  draftSession?: FlexibilitySessionDraft;
  savedRoutines?: SavedFlexibilityRoutine[];
  guidedSessions?: FlexibilityGuidedSession[];
  guidedSessionDraft?: FlexibilityGuidedSessionDraft;
  timerPreferences?: {
    holdSeconds: number;
    preparationSeconds: 0 | 3 | 5 | 10;
    timerDirection: FlexibilityTimerDirection;
    soundEnabled: boolean;
  };
};

export type FlexibilityRegionStatus = {
  id: FlexibilityRegionId;
  name: string;
  group: string;
  intervalDays: number;
  lastStretched: string | null;
  daysSince: number | null;
  daysUntilDue: number | null;
  historyState: 'stretched' | 'never-stretched' | 'invalid';
  status: string;
};

export type FlexibilitySuggestion = {
  regionIds: FlexibilityRegionId[];
  text: string;
  reasonRegionId: FlexibilityRegionId | null;
};

const regionIds = new Set<string>(flexibilityRegions.map(region => region.id));
const suggestedStretchDefinitions = [
  { id: 'downward-dog', name: 'Downward Dog', regionIds: ['hamstrings', 'calves', 'shoulders'], sideMode: 'both' },
  { id: 'shoulder-stretch', name: 'Shoulder Stretch', regionIds: ['shoulders'], sideMode: 'each' },
  { id: 'chest-stretch', name: 'Chest Stretch', regionIds: ['chest'], sideMode: 'each' },
  { id: 'hamstring-stretch', name: 'Hamstring Stretch', regionIds: ['hamstrings'], sideMode: 'each' },
  { id: 'hip-flexor-stretch', name: 'Hip Flexor Stretch', regionIds: ['hip-flexors'], sideMode: 'each' },
  { id: 'straddle-stretch', name: 'Straddle Stretch', regionIds: ['hamstrings', 'glutes'], sideMode: 'both' }
] as const satisfies readonly Omit<FlexibilityRoutineStretch, 'holdSeconds'>[];

export const flexibilityRoutineSuggestions: readonly SavedFlexibilityRoutine[] = [
  { id: 'suggestion-daily-stretch', name: 'Daily Stretch', stretches: sixSuggestedStretches(60), preparationSeconds: 5, timerDirection: 'down' },
  { id: 'suggestion-quick-full-body', name: 'Quick Full Body', stretches: sixSuggestedStretches(30), preparationSeconds: 5, timerDirection: 'down' },
  { id: 'suggestion-upper-body', name: 'Upper Body', stretches: suggestedStretchDefinitions.slice(0, 3).map(stretch => ({ ...stretch, regionIds: [...stretch.regionIds], holdSeconds: 30 })), preparationSeconds: 5, timerDirection: 'down' },
  { id: 'suggestion-lower-body', name: 'Lower Body', stretches: suggestedStretchDefinitions.slice(3).map(stretch => ({ ...stretch, regionIds: [...stretch.regionIds], holdSeconds: 30 })), preparationSeconds: 5, timerDirection: 'down' }
];

export function createFlexibilityData(): FlexibilityData {
  return {
    settings: { intervals: {} },
    sessions: [],
    savedRoutines: [],
    guidedSessions: [],
    timerPreferences: {
      holdSeconds: 30,
      preparationSeconds: 5,
      timerDirection: 'down',
      soundEnabled: false
    }
  };
}

function sixSuggestedStretches(holdSeconds: number): FlexibilityRoutineStretch[] {
  return suggestedStretchDefinitions.map(stretch => ({
    ...stretch,
    regionIds: [...stretch.regionIds],
    holdSeconds
  }));
}

export function migrateFlexibilityData(value: FlexibilityData): FlexibilityData {
  return {
    ...value,
    settings: { intervals: { ...value.settings.intervals } },
    sessions: value.sessions.map(cloneSession),
    savedRoutines: (value.savedRoutines ?? []).map(cloneRoutine),
    guidedSessions: (value.guidedSessions ?? []).map(cloneGuidedSession),
    timerPreferences: { ...createFlexibilityData().timerPreferences!, ...value.timerPreferences },
    ...(value.guidedSessionDraft === undefined
      ? {}
      : { guidedSessionDraft: cloneGuidedDraft(value.guidedSessionDraft) }),
    ...(value.draftSession === undefined
      ? {}
      : { draftSession: { ...value.draftSession, regionIds: [...value.draftSession.regionIds] } })
  };
}

export function saveFlexibilityRoutine(
  routines: readonly SavedFlexibilityRoutine[],
  routine: SavedFlexibilityRoutine
): { valid: true; routines: SavedFlexibilityRoutine[] } | { valid: false; error: string } {
  if (!validateSavedRoutine(routine)
    || routine.id.startsWith('suggestion-')
    || routines.some(item => item.id === routine.id && item.name !== routine.name
      && item.id.startsWith('suggestion-'))) {
    return { valid: false, error: 'The saved stretch routine is invalid.' };
  }
  return {
    valid: true,
    routines: routines.some(item => item.id === routine.id)
      ? routines.map(item => item.id === routine.id ? cloneRoutine(routine) : cloneRoutine(item))
      : [...routines.map(cloneRoutine), cloneRoutine(routine)]
  };
}

export function deleteFlexibilityRoutine(
  routines: readonly SavedFlexibilityRoutine[],
  id: string
): { deleted: boolean; routines: SavedFlexibilityRoutine[] } {
  const next = routines.filter(routine => routine.id !== id);
  return { deleted: next.length !== routines.length, routines: next.map(cloneRoutine) };
}

export function defaultFlexibilityIntervals(): Record<FlexibilityRegionId, number> {
  return Object.fromEntries(flexibilityRegions.map(region => [
    region.id,
    region.defaultIntervalDays
  ])) as Record<FlexibilityRegionId, number>;
}

export function isFlexibilityRegionId(value: unknown): value is FlexibilityRegionId {
  return typeof value === 'string' && regionIds.has(value);
}

export function validateFlexibilityData(value: unknown, asOfDate: string): value is FlexibilityData {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'settings', 'sessions', 'draftSession', 'savedRoutines', 'guidedSessions',
    'guidedSessionDraft', 'timerPreferences'
  ])
    || !isRecord(value.settings) || !hasOnlyKeys(value.settings, ['intervals'])
    || !isRecord(value.settings.intervals) || !Array.isArray(value.sessions)
    || !isValidDate(asOfDate)) return false;
  for (const [id, interval] of Object.entries(value.settings.intervals)) {
    if (!isFlexibilityRegionId(id) || !Number.isInteger(interval)
      || (interval as number) < 1 || (interval as number) > 365) return false;
  }
  const sessionIds = new Set<string>();
  for (const session of value.sessions) {
    if (!isRecord(session) || !hasOnlyKeys(session, ['id', 'date', 'regionIds', 'minutes', 'notes'])
      || !isNonEmptyText(session.id, 160) || sessionIds.has(session.id)
      || typeof session.date !== 'string' || !isValidDate(session.date) || session.date > asOfDate
      || !Array.isArray(session.regionIds) || session.regionIds.length === 0
      || session.regionIds.some(id => !isFlexibilityRegionId(id))
      || new Set(session.regionIds).size !== session.regionIds.length
      || session.minutes !== undefined && (!Number.isInteger(session.minutes)
        || (session.minutes as number) < 1 || (session.minutes as number) > 1440)
      || session.notes !== undefined && !isOptionalText(session.notes, 1000)) return false;
    sessionIds.add(session.id);
  }
  if (value.draftSession !== undefined
    && (!validateDraft(value.draftSession, asOfDate)
      || value.draftSession.editingSessionId !== undefined
        && !sessionIds.has(value.draftSession.editingSessionId))) return false;
  if (value.savedRoutines !== undefined
    && (!Array.isArray(value.savedRoutines) || !value.savedRoutines.every(validateSavedRoutine))) return false;
  if (value.guidedSessions !== undefined
    && (!Array.isArray(value.guidedSessions) || !value.guidedSessions.every(validateGuidedSession))) return false;
  if (value.guidedSessionDraft !== undefined
    && !validateGuidedSessionDraft(value.guidedSessionDraft, asOfDate)) return false;
  if (value.timerPreferences !== undefined && (!isRecord(value.timerPreferences)
    || !hasOnlyKeys(value.timerPreferences, ['holdSeconds', 'preparationSeconds', 'timerDirection', 'soundEnabled'])
    || !Number.isInteger(value.timerPreferences.holdSeconds)
    || Number(value.timerPreferences.holdSeconds) < 1
    || Number(value.timerPreferences.holdSeconds) > 3600
    || ![0, 3, 5, 10].includes(Number(value.timerPreferences.preparationSeconds))
    || value.timerPreferences.timerDirection !== 'down' && value.timerPreferences.timerDirection !== 'up'
    || typeof value.timerPreferences.soundEnabled !== 'boolean')) return false;
  return true;
}

export function saveFlexibilityDraft(
  data: FlexibilityData,
  draftSession: FlexibilitySessionDraft,
  asOfDate: string
): { valid: true; data: FlexibilityData } | { valid: false; error: string } {
  if (!validateDraft(draftSession, asOfDate)) {
    return { valid: false, error: 'The stretch session draft is invalid.' };
  }
  const updated = {
    ...data,
    draftSession: { ...draftSession, regionIds: [...draftSession.regionIds] }
  };
  return validateFlexibilityData(updated, asOfDate)
    ? { valid: true, data: updated }
    : { valid: false, error: 'The stretch session draft does not match the saved history.' };
}

export function clearFlexibilityDraft(data: FlexibilityData): FlexibilityData {
  const { draftSession: _draft, ...rest } = data;
  return rest;
}

export function saveFlexibilitySession(
  sessions: readonly FlexibilitySession[],
  session: FlexibilitySession
): { valid: true; sessions: FlexibilitySession[] } | { valid: false; error: string } {
  if (!isNonEmptyText(session.id, 160) || !isValidDate(session.date)
    || !Array.isArray(session.regionIds) || session.regionIds.length === 0
    || session.regionIds.some(id => !isFlexibilityRegionId(id))
    || new Set(session.regionIds).size !== session.regionIds.length
    || session.minutes !== undefined && (!Number.isInteger(session.minutes)
      || session.minutes < 1 || session.minutes > 1440)
    || session.notes !== undefined && !isOptionalText(session.notes, 1000)) {
    return { valid: false, error: 'Choose a date and at least one stretch region.' };
  }
  return {
    valid: true,
    sessions: sessions.some(item => item.id === session.id)
      ? sessions.map(item => item.id === session.id ? cloneSession(session) : item)
      : [...sessions, cloneSession(session)]
  };
}

export function deleteFlexibilitySession(
  sessions: readonly FlexibilitySession[],
  id: string
): { deleted: boolean; sessions: FlexibilitySession[] } {
  const next = sessions.filter(session => session.id !== id);
  return { deleted: next.length !== sessions.length, sessions: next };
}

export function flexibilityDataIssues(data: FlexibilityData): string[] {
  const issues: string[] = [];
  if (!Array.isArray(data?.sessions)) return ['Stretch history is not available.'];
  const seenIds = new Set<string>();
  for (const session of data.sessions) {
    if (!session || typeof session !== 'object') {
      issues.push('A stretch session has an invalid record.');
      continue;
    }
    if (!isNonEmptyText(session.id, 160) || seenIds.has(session.id)) {
      issues.push('Stretch history contains a missing or duplicate session ID.');
    } else {
      seenIds.add(session.id);
    }
    if (!isValidDate(session.date)) issues.push(`Stretch session ${session.id || '(unknown)'} has an invalid date.`);
    if (!Array.isArray(session.regionIds) || session.regionIds.length === 0
      || session.regionIds.some(id => !isFlexibilityRegionId(id))) {
      issues.push(`Stretch session ${session.id || '(unknown)'} has unresolved regions.`);
    }
  }
  return issues;
}

export function selectFlexibilityRegionStatuses(
  data: FlexibilityData,
  asOfDate: string
): FlexibilityRegionStatus[] {
  const sessions = [
    ...(Array.isArray(data?.sessions) ? data.sessions : []),
    ...(Array.isArray(data?.guidedSessions) ? data.guidedSessions
      .filter(session => session.holds.some(hold => hold.status === 'completed'))
      .map(session => ({
        date: session.date,
        regionIds: [...new Set(session.holds
          .filter(hold => hold.status === 'completed')
          .flatMap(hold => hold.regionIds))]
      })) : [])
  ];
  const intervals = { ...defaultFlexibilityIntervals(), ...(data?.settings?.intervals ?? {}) };
  return flexibilityRegions.map(region => {
    const matching = sessions.filter(session =>
      Array.isArray(session?.regionIds) && session.regionIds.includes(region.id)
    );
    const invalidHistory = matching.some(session => !isValidDate(session.date));
    const lastStretched = matching
      .filter(session => isValidDate(session.date) && session.date <= asOfDate)
      .map(session => session.date)
      .sort()
      .at(-1) ?? null;
    const intervalDays = intervals[region.id];
    const daysSince = lastStretched ? calendarDaysBetween(lastStretched, asOfDate) : null;
    const daysUntilDue = daysSince === null ? null : intervalDays - daysSince;
    return {
      id: region.id,
      name: region.name,
      group: region.group,
      intervalDays,
      lastStretched,
      daysSince,
      daysUntilDue,
      historyState: invalidHistory
        ? 'invalid'
        : lastStretched ? 'stretched' : 'never-stretched',
      status: invalidHistory
        ? 'Stretch history unavailable.'
        : daysUntilDue === null
          ? 'Not logged yet.'
          : daysUntilDue > 0
            ? `Due in ${daysUntilDue} ${daysUntilDue === 1 ? 'day.' : 'days.'}`
            : daysUntilDue === 0
              ? 'Due today.'
              : `${Math.abs(daysUntilDue)} ${Math.abs(daysUntilDue) === 1 ? 'day' : 'days'} overdue.`
    };
  });
}

export function estimateFlexibilityRoutineSeconds(
  routine: Pick<SavedFlexibilityRoutine, 'stretches' | 'preparationSeconds'>,
  rounds = 1
): number {
  return routine.stretches.reduce((total, stretch) =>
    total + stretch.holdSeconds * (stretch.sideMode === 'each' ? 2 : 1)
      + routine.preparationSeconds * (stretch.sideMode === 'each' ? 2 : 1), 0
  ) * rounds;
}

export function createFlexibilityGuidedSession(
  routine: SavedFlexibilityRoutine,
  options: {
    id: string;
    date: string;
    startedAt: string;
    timeZone: string;
    preparationSeconds?: 0 | 3 | 5 | 10;
    timerDirection?: FlexibilityTimerDirection;
    linkedRhythmId?: string;
    rhythmOccurrence?: string;
    completionId?: string;
  }
): { valid: true; session: FlexibilityGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateSavedRoutine(routine) || !isNonEmptyText(options.id, 160)
    || !isValidDate(options.date) || !isCanonicalInstant(options.startedAt)
    || !isSupportedTimeZone(options.timeZone)) {
    return { valid: false, error: 'The saved stretch routine or session details are invalid.' };
  }
  const holds: FlexibilityGuidedHold[] = [];
  for (let round = 1; round <= 1; round += 1) {
    for (const stretch of routine.stretches) {
      const sides: FlexibilityRoutineSide[] = stretch.sideMode === 'each'
        ? ['left', 'right'] : ['both'];
      for (const side of sides) {
        holds.push({
          id: `${options.id}-hold-${holds.length + 1}`,
          stretchId: stretch.id,
          stretchName: stretch.name,
          regionIds: [...stretch.regionIds],
          side,
          round,
          targetSeconds: stretch.holdSeconds,
          preparationSeconds: options.preparationSeconds ?? routine.preparationSeconds,
          timerDirection: options.timerDirection ?? routine.timerDirection,
          status: 'pending'
        });
      }
    }
  }
  return {
    valid: true,
    session: {
      id: options.id,
      routineId: routine.id,
      routineName: routine.name,
      routineSnapshot: cloneRoutine(routine),
      date: options.date,
      startedAt: options.startedAt,
      timeZone: options.timeZone,
      holds,
      notes: '',
      currentHoldIndex: 0,
      timer: { phase: 'idle' },
      preparationSeconds: options.preparationSeconds ?? routine.preparationSeconds,
      timerDirection: options.timerDirection ?? routine.timerDirection,
      soundEnabled: false,
      ...(options.linkedRhythmId ? { linkedRhythmId: options.linkedRhythmId } : {}),
      ...(options.rhythmOccurrence ? { rhythmOccurrence: options.rhythmOccurrence } : {}),
      ...(options.completionId ? { completionId: options.completionId } : {})
    }
  };
}

export function addFlexibilityGuidedRound(
  session: FlexibilityGuidedSessionDraft,
  stretchId = session.holds[session.currentHoldIndex]?.stretchId
): { valid: true; session: FlexibilityGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateGuidedSessionDraft(session) || session.timer.phase === 'preparing'
    || session.timer.phase === 'holding' || session.timer.phase === 'paused') {
    return { valid: false, error: 'Pause or finish the current hold before adding a round.' };
  }
  const stretch = session.routineSnapshot.stretches.find(item => item.id === stretchId);
  if (!stretch) return { valid: false, error: 'That stretch is unavailable for another round.' };
  const stretchHolds = session.holds.filter(hold => hold.stretchId === stretch.id);
  const round = Math.max(...stretchHolds.map(hold => hold.round), 0) + 1;
  let nextHoldId = session.holds.length + 1;
  const sides: FlexibilityRoutineSide[] = stretch.sideMode === 'each'
    ? ['left', 'right'] : ['both'];
  const extra = sides.map(side => {
    const id = `${session.id}-hold-${nextHoldId}`;
    nextHoldId += 1;
    return {
      id,
      stretchId: stretch.id,
      stretchName: stretch.name,
      regionIds: [...stretch.regionIds],
      side,
      round,
      targetSeconds: stretch.holdSeconds,
      preparationSeconds: session.preparationSeconds,
      timerDirection: session.timerDirection,
      status: 'pending' as const
    };
  });
  return { valid: true, session: { ...session, holds: [...session.holds, ...extra] } };
}

export function selectFlexibilityGuidedHold(
  session: FlexibilityGuidedSessionDraft,
  index: number
): { valid: true; session: FlexibilityGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateGuidedSessionDraft(session) || !Number.isInteger(index)
    || index < 0 || index >= session.holds.length) {
    return { valid: false, error: 'That stretch hold is unavailable.' };
  }
  if (session.timer.phase === 'preparing' || session.timer.phase === 'holding' || session.timer.phase === 'paused') {
    return { valid: false, error: 'Pause or finish the active hold before changing stretches.' };
  }
  return { valid: true, session: { ...session, currentHoldIndex: index, timer: { phase: 'idle' } } };
}

export function startFlexibilityGuidedHold(
  session: FlexibilityGuidedSessionDraft,
  startedAt: string
): { valid: true; session: FlexibilityGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateGuidedSessionDraft(session) || !isCanonicalInstant(startedAt)
    || session.timer.phase === 'preparing' || session.timer.phase === 'holding'
    || session.timer.phase === 'paused' || session.holds[session.currentHoldIndex]?.status !== 'pending') {
    return { valid: false, error: 'The current stretch hold cannot be started.' };
  }
  const preparationMilliseconds = (session.holds[session.currentHoldIndex]!.preparationSeconds
    ?? session.preparationSeconds) * 1000;
  return {
    valid: true,
    session: {
      ...session,
      timer: preparationMilliseconds > 0
        ? {
            phase: 'preparing',
            deadlineAt: new Date(Date.parse(startedAt) + preparationMilliseconds).toISOString()
          }
        : {
            phase: 'holding',
            holdStartedAt: startedAt,
            deadlineAt: new Date(Date.parse(startedAt)
              + session.holds[session.currentHoldIndex]!.targetSeconds * 1000).toISOString()
          }
    }
  };
}

export function pauseFlexibilityGuidedHold(
  session: FlexibilityGuidedSessionDraft,
  pausedAt: string
): { valid: true; session: FlexibilityGuidedSessionDraft } | { valid: false; error: string } {
  const timer = session.timer;
  if (!validateGuidedSessionDraft(session) || !isCanonicalInstant(pausedAt)
    || (timer.phase !== 'preparing' && timer.phase !== 'holding') || !timer.deadlineAt) {
    return { valid: false, error: 'There is no active stretch timer to pause.' };
  }
  const remainingMilliseconds = Math.max(0, Date.parse(timer.deadlineAt) - Date.parse(pausedAt));
  const phase = timer.phase;
  const holdStartedAt = timer.holdStartedAt;
  const elapsedBeforePauseMilliseconds = phase === 'holding' && holdStartedAt
    ? Date.parse(pausedAt) - Date.parse(holdStartedAt)
    : undefined;
  return {
    valid: true,
    session: {
      ...session,
      timer: remainingMilliseconds === 0 && phase === 'holding'
        ? { phase: 'complete' }
        : {
            phase: 'paused',
            pausedFrom: phase,
            remainingMilliseconds,
            ...(holdStartedAt ? { holdStartedAt } : {}),
            ...(elapsedBeforePauseMilliseconds === undefined ? {} : { elapsedBeforePauseMilliseconds })
          }
    }
  };
}

export function resumeFlexibilityGuidedHold(
  session: FlexibilityGuidedSessionDraft,
  resumedAt: string
): { valid: true; session: FlexibilityGuidedSessionDraft } | { valid: false; error: string } {
  const timer = session.timer;
  if (!validateGuidedSessionDraft(session) || !isCanonicalInstant(resumedAt)
    || timer.phase !== 'paused' || timer.remainingMilliseconds === undefined || !timer.pausedFrom) {
    return { valid: false, error: 'There is no paused stretch timer to resume.' };
  }
  if (timer.pausedFrom === 'holding' && timer.remainingMilliseconds === 0) {
    return { valid: true, session: { ...session, timer: { phase: 'complete' } } };
  }
  const deadlineAt = new Date(Date.parse(resumedAt) + timer.remainingMilliseconds).toISOString();
  if (timer.pausedFrom === 'preparing') {
    return {
      valid: true,
      session: { ...session, timer: { phase: 'preparing', deadlineAt } }
    };
  }
  const elapsedBeforePause = timer.elapsedBeforePauseMilliseconds ?? 0;
  const holdStartedAt = new Date(Date.parse(resumedAt) - elapsedBeforePause).toISOString();
  return {
    valid: true,
    session: { ...session, timer: { phase: 'holding', deadlineAt, holdStartedAt } }
  };
}

export function advanceFlexibilityGuidedTimer(
  session: FlexibilityGuidedSessionDraft,
  now: string
): { valid: true; session: FlexibilityGuidedSessionDraft; changed: boolean }
  | { valid: false; error: string } {
  if (!validateGuidedSessionDraft(session) || !isCanonicalInstant(now)) {
    return { valid: false, error: 'The stretch timer state or current time is invalid.' };
  }
  const { timer } = session;
  if ((timer.phase !== 'preparing' && timer.phase !== 'holding') || !timer.deadlineAt
    || Date.parse(now) < Date.parse(timer.deadlineAt)) {
    return { valid: true, session, changed: false };
  }
  if (timer.phase === 'preparing') {
    const targetSeconds = session.holds[session.currentHoldIndex]!.targetSeconds;
    const holdDeadline = Date.parse(timer.deadlineAt) + targetSeconds * 1000;
    if (Date.parse(now) >= holdDeadline) {
      return { valid: true, changed: true, session: { ...session, timer: { phase: 'complete' } } };
    }
    return {
      valid: true,
      changed: true,
      session: {
        ...session,
        timer: {
          phase: 'holding',
          holdStartedAt: timer.deadlineAt,
          deadlineAt: new Date(holdDeadline).toISOString()
        }
      }
    };
  }
  return { valid: true, changed: true, session: { ...session, timer: { phase: 'complete' } } };
}

export function restartFlexibilityGuidedHold(
  session: FlexibilityGuidedSessionDraft
): { valid: true; session: FlexibilityGuidedSessionDraft } | { valid: false; error: string } {
  if (!validateGuidedSessionDraft(session) || session.holds[session.currentHoldIndex]?.status !== 'pending') {
    return { valid: false, error: 'The current stretch hold cannot be restarted.' };
  }
  return { valid: true, session: { ...session, timer: { phase: 'idle' } } };
}

export function completeFlexibilityGuidedHold(
  session: FlexibilityGuidedSessionDraft,
  completedAt: string,
  actualSeconds?: number
): { valid: true; session: FlexibilityGuidedSessionDraft } | { valid: false; error: string } {
  const hold = session.holds[session.currentHoldIndex];
  if (!validateGuidedSessionDraft(session) || !isCanonicalInstant(completedAt) || !hold
    || hold.status !== 'pending'
    || actualSeconds !== undefined && (!Number.isInteger(actualSeconds)
      || actualSeconds < 1 || actualSeconds > hold.targetSeconds)
    || actualSeconds === undefined && session.timer.phase !== 'complete') {
    return { valid: false, error: 'Confirm a completed hold and its actual duration.' };
  }
  const elapsed = actualSeconds ?? hold.targetSeconds;
  if (actualSeconds !== undefined && session.timer.phase !== 'holding'
    && !(session.timer.phase === 'paused' && session.timer.pausedFrom === 'holding')) {
    return { valid: false, error: 'Start and confirm the active hold before recording an early duration.' };
  }
  const holds = session.holds.map((item, index) => index === session.currentHoldIndex
    ? { ...item, status: 'completed' as const, actualSeconds: elapsed, completedAt }
    : item);
  return {
    valid: true,
    session: { ...session, holds, timer: { phase: 'idle' } }
  };
}

export function skipFlexibilityGuidedHold(
  session: FlexibilityGuidedSessionDraft
): { valid: true; session: FlexibilityGuidedSessionDraft } | { valid: false; error: string } {
  const hold = session.holds[session.currentHoldIndex];
  if (!validateGuidedSessionDraft(session) || !hold || hold.status !== 'pending') {
    return { valid: false, error: 'The current stretch hold cannot be skipped.' };
  }
  return {
    valid: true,
    session: {
      ...session,
      holds: session.holds.map((item, index) =>
        index === session.currentHoldIndex ? { ...item, status: 'skipped' } : item),
      timer: { phase: 'idle' }
    }
  };
}

export function selectCompletedGuidedRegions(session: FlexibilityGuidedSession): FlexibilityRegionId[] {
  return [...new Set(session.holds
    .filter(hold => hold.status === 'completed')
    .flatMap(hold => hold.regionIds))];
}

export function finishFlexibilityGuidedSession(
  data: FlexibilityData,
  session: FlexibilityGuidedSessionDraft
): { valid: true; data: FlexibilityData } | { valid: false; error: string } {
  const latestDate = data.sessions.reduce((latest, item) => item.date > latest ? item.date : latest, session.date);
  if (!validateFlexibilityData(data, latestDate) || !validateGuidedSessionDraft(session)) {
    return { valid: false, error: 'Complete and confirm at least one stretch hold before finishing.' };
  }
  if (session.holds.some(hold => hold.status === 'pending')) {
    return { valid: false, error: 'Complete or skip every hold before finishing.' };
  }
  if (!selectCompletedGuidedRegions(session).length) {
    return { valid: false, error: 'Complete and confirm at least one stretch hold before finishing.' };
  }
  const { currentHoldIndex: _index, timer: _timer, preparationSeconds: _preparation,
    timerDirection: _direction, soundEnabled: _sound, ...record } = session;
  const completed = cloneGuidedSession(record);
  const migrated = migrateFlexibilityData(data);
  const guidedSessions = migrated.guidedSessions ?? [];
  if (guidedSessions.some(item => item.id === completed.id)) {
    return { valid: false, error: 'This guided stretch session has already been saved.' };
  }
  const { guidedSessionDraft: _draft, ...dataWithoutDraft } = migrated;
  return {
    valid: true,
    data: {
      ...dataWithoutDraft,
      guidedSessions: [...guidedSessions.map(cloneGuidedSession), completed]
    }
  };
}

function validateSavedRoutine(value: unknown): value is SavedFlexibilityRoutine {
  return isRecord(value) && hasOnlyKeys(value, [
    'id', 'name', 'stretches', 'preparationSeconds', 'timerDirection'
  ]) && isNonEmptyText(value.id, 160) && isNonEmptyText(value.name, 120)
    && Array.isArray(value.stretches) && value.stretches.length > 0
    && value.stretches.every(stretch => isRecord(stretch)
      && hasOnlyKeys(stretch, ['id', 'name', 'regionIds', 'sideMode', 'holdSeconds', 'instructions'])
      && isNonEmptyText(stretch.id, 160) && isNonEmptyText(stretch.name, 120)
      && Array.isArray(stretch.regionIds) && stretch.regionIds.length > 0
      && stretch.regionIds.every(isFlexibilityRegionId)
      && new Set(stretch.regionIds).size === stretch.regionIds.length
      && (stretch.sideMode === 'each' || stretch.sideMode === 'both')
      && Number.isInteger(stretch.holdSeconds) && Number(stretch.holdSeconds) >= 1 && Number(stretch.holdSeconds) <= 3600
      && (stretch.instructions === undefined || isOptionalText(stretch.instructions, 500)))
    && [0, 3, 5, 10].includes(Number(value.preparationSeconds))
    && (value.timerDirection === 'down' || value.timerDirection === 'up');
}

function validateGuidedHold(value: unknown): value is FlexibilityGuidedHold {
  return isRecord(value) && hasOnlyKeys(value, [
    'id', 'stretchId', 'stretchName', 'regionIds', 'side', 'round', 'targetSeconds',
    'preparationSeconds', 'timerDirection', 'actualSeconds', 'status', 'completedAt'
  ]) && isNonEmptyText(value.id, 200) && isNonEmptyText(value.stretchId, 160)
    && isNonEmptyText(value.stretchName, 120) && Array.isArray(value.regionIds)
    && value.regionIds.length > 0 && value.regionIds.every(isFlexibilityRegionId)
    && new Set(value.regionIds).size === value.regionIds.length
    && ['left', 'right', 'both'].includes(String(value.side))
    && Number.isInteger(value.round) && Number(value.round) >= 1
    && Number.isInteger(value.targetSeconds) && Number(value.targetSeconds) >= 1 && Number(value.targetSeconds) <= 3600
    && (value.preparationSeconds === undefined || [0, 3, 5, 10].includes(Number(value.preparationSeconds)))
    && (value.timerDirection === undefined || value.timerDirection === 'down' || value.timerDirection === 'up')
    && (value.actualSeconds === undefined || Number.isInteger(value.actualSeconds)
      && Number(value.actualSeconds) >= 1 && Number(value.actualSeconds) <= Number(value.targetSeconds))
    && ['pending', 'completed', 'skipped'].includes(String(value.status))
    && (value.completedAt === undefined || isCanonicalInstant(value.completedAt))
    && (value.status === 'completed'
      ? value.actualSeconds !== undefined && value.completedAt !== undefined
      : value.actualSeconds === undefined && value.completedAt === undefined);
}

function validateGuidedSession(value: unknown): value is FlexibilityGuidedSession {
  return isRecord(value) && hasOnlyKeys(value, [
    'id', 'routineId', 'routineName', 'routineSnapshot', 'date', 'startedAt', 'timeZone',
    'holds', 'notes', 'linkedRhythmId', 'rhythmOccurrence', 'completionId'
  ]) && isNonEmptyText(value.id, 160) && isNonEmptyText(value.routineId, 160)
    && isNonEmptyText(value.routineName, 120) && validateSavedRoutine(value.routineSnapshot)
    && value.routineSnapshot.id === value.routineId
    && isNonEmptyText(value.date, 10) && isValidDate(value.date) && isCanonicalInstant(value.startedAt)
    && isSupportedTimeZone(value.timeZone) && Array.isArray(value.holds)
    && value.holds.every(validateGuidedHold)
    && new Set(value.holds.map(hold => isRecord(hold) ? hold.id : null)).size === value.holds.length
    && isOptionalText(value.notes, 1000)
    && (value.linkedRhythmId === undefined || isNonEmptyText(value.linkedRhythmId, 160))
    && (value.rhythmOccurrence === undefined || isNonEmptyText(value.rhythmOccurrence, 10)
      && isValidDate(value.rhythmOccurrence))
    && (value.completionId === undefined || isNonEmptyText(value.completionId, 160))
    && (value.linkedRhythmId === undefined) === (value.completionId === undefined)
    && (value.rhythmOccurrence === undefined
      || value.linkedRhythmId !== undefined && value.rhythmOccurrence === value.date);
}

function validateGuidedTimer(value: unknown): value is FlexibilityGuidedTimer {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'phase', 'deadlineAt', 'remainingMilliseconds', 'holdStartedAt', 'pausedFrom',
    'elapsedBeforePauseMilliseconds'
  ]) || !['idle', 'preparing', 'holding', 'paused', 'complete'].includes(String(value.phase))) return false;
  if (value.deadlineAt !== undefined && !isCanonicalInstant(value.deadlineAt)
    || value.holdStartedAt !== undefined && !isCanonicalInstant(value.holdStartedAt)
    || value.remainingMilliseconds !== undefined
      && (!Number.isInteger(value.remainingMilliseconds) || Number(value.remainingMilliseconds) < 0)
    || value.elapsedBeforePauseMilliseconds !== undefined
      && (!Number.isInteger(value.elapsedBeforePauseMilliseconds) || Number(value.elapsedBeforePauseMilliseconds) < 0)
    || value.pausedFrom !== undefined && value.pausedFrom !== 'preparing' && value.pausedFrom !== 'holding') return false;
  return value.phase === 'idle' || value.phase === 'complete'
    ? value.deadlineAt === undefined && value.remainingMilliseconds === undefined
    : value.phase === 'paused'
      ? value.deadlineAt === undefined && value.remainingMilliseconds !== undefined && value.pausedFrom !== undefined
      : value.deadlineAt !== undefined && value.remainingMilliseconds === undefined && value.pausedFrom === undefined;
}

function validateGuidedSessionDraft(value: unknown, asOfDate?: string): value is FlexibilityGuidedSessionDraft {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'id', 'routineId', 'routineName', 'routineSnapshot', 'date', 'startedAt', 'timeZone',
    'holds', 'notes', 'linkedRhythmId', 'rhythmOccurrence', 'completionId',
    'currentHoldIndex', 'timer', 'preparationSeconds', 'timerDirection', 'soundEnabled'
  ])) return false;
  const record = value as Record<string, unknown>;
  const {
    currentHoldIndex: _index,
    timer: _timer,
    preparationSeconds: _preparation,
    timerDirection: _direction,
    soundEnabled: _sound,
    ...baseSession
  } = record;
  if (!validateGuidedSession(baseSession)) return false;
  return (asOfDate === undefined || typeof record.date === 'string'
      && isValidDate(record.date) && record.date <= asOfDate)
    && Number.isInteger(record.currentHoldIndex) && Number(record.currentHoldIndex) >= 0
    && Number(record.currentHoldIndex) < (record.holds as FlexibilityGuidedHold[]).length
    && validateGuidedTimer(record.timer)
    && [0, 3, 5, 10].includes(Number(record.preparationSeconds))
    && (record.timerDirection === 'down' || record.timerDirection === 'up')
    && typeof record.soundEnabled === 'boolean';
}

function isCanonicalInstant(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function isSupportedTimeZone(value: unknown): value is string {
  if (!isNonEmptyText(value, 100)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

function cloneRoutine(routine: SavedFlexibilityRoutine): SavedFlexibilityRoutine {
  return {
    ...routine,
    stretches: routine.stretches.map(stretch => ({ ...stretch, regionIds: [...stretch.regionIds] }))
  };
}

function cloneGuidedSession(session: FlexibilityGuidedSession): FlexibilityGuidedSession {
  return {
    ...session,
    routineSnapshot: cloneRoutine(session.routineSnapshot),
    holds: session.holds.map(hold => ({ ...hold, regionIds: [...hold.regionIds] }))
  };
}

function cloneGuidedDraft(session: FlexibilityGuidedSessionDraft): FlexibilityGuidedSessionDraft {
  return {
    ...cloneGuidedSession(session),
    currentHoldIndex: session.currentHoldIndex,
    timer: { ...session.timer },
    preparationSeconds: session.preparationSeconds,
    timerDirection: session.timerDirection,
    soundEnabled: session.soundEnabled
  };
}

export function suggestNextFlexibilityStretch(
  regions: readonly FlexibilityRegionStatus[]
): FlexibilitySuggestion {
  const due = regions
    .filter(region => region.daysUntilDue !== null)
    .sort((left, right) =>
      left.daysUntilDue! - right.daysUntilDue!
      || flexibilityRegions.findIndex(region => region.id === left.id)
        - flexibilityRegions.findIndex(region => region.id === right.id)
    );
  const next = due[0];
  if (!next) {
    return {
      regionIds: [],
      text: 'Log your first stretch session to start a stretch schedule.',
      reasonRegionId: null
    };
  }
  const dueWithinGroup = due.filter(region =>
    region.group === next.group && region.daysUntilDue! <= 0
  );
  const recommended = next.daysUntilDue! <= 0 && dueWithinGroup.length
    ? dueWithinGroup
    : [next];
  const regionIds = recommended.map(region => region.id);
  const timeLabel = next.daysUntilDue! < 0
    ? `${Math.abs(next.daysUntilDue!)} ${Math.abs(next.daysUntilDue!) === 1 ? 'day' : 'days'} overdue`
    : next.daysUntilDue === 0 ? 'due today'
      : `due in ${next.daysUntilDue} ${next.daysUntilDue === 1 ? 'day' : 'days'}`;
  const joined = joinRegionNames(recommended.map(region => region.name));
  return {
    regionIds,
    reasonRegionId: next.id,
    text: `${next.name} ${next.name.endsWith('s') ? 'are' : 'is'} ${timeLabel}. ${joined} would be a good next stretch.`
  };
}

function validateDraft(value: unknown, asOfDate: string): value is FlexibilitySessionDraft {
  return isRecord(value)
    && hasOnlyKeys(value, ['date', 'regionIds', 'minutes', 'notes', 'editingSessionId'])
    && typeof value.date === 'string'
    && isValidDate(value.date)
    && value.date <= asOfDate
    && Array.isArray(value.regionIds)
    && value.regionIds.every(isFlexibilityRegionId)
    && new Set(value.regionIds).size === value.regionIds.length
    && typeof value.minutes === 'string'
    && value.minutes.length <= 4
    && /^\d*$/.test(value.minutes)
    && typeof value.notes === 'string'
    && value.notes.length <= 1000
    && (value.editingSessionId === undefined || isNonEmptyText(value.editingSessionId, 160));
}

function calendarDaysBetween(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  const startUtc = Date.UTC(startYear!, startMonth! - 1, startDay!);
  const endUtc = Date.UTC(endYear!, endMonth! - 1, endDay!);
  return Math.max(0, Math.floor((endUtc - startUtc) / 86_400_000));
}

function joinRegionNames(names: readonly string[]): string {
  if (names.length < 2) return names[0] ?? 'That region';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
}

function cloneSession(session: FlexibilitySession): FlexibilitySession {
  return { ...session, regionIds: [...session.regionIds] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(record).every(key => allowed.includes(key));
}

function isNonEmptyText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isOptionalText(value: unknown, maxLength: number): value is string | undefined {
  return value === undefined || typeof value === 'string' && value.length <= maxLength;
}
