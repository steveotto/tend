import { describe, expect, it } from 'vitest';
import {
  clearFlexibilityDraft,
  addFlexibilityGuidedRound,
  advanceFlexibilityGuidedTimer,
  completeFlexibilityGuidedHold,
  createFlexibilityData,
  createFlexibilityGuidedSession,
  deleteFlexibilitySession,
  flexibilityRoutineSuggestions,
  finishFlexibilityGuidedSession,
  flexibilityRegions,
  pauseFlexibilityGuidedHold,
  resumeFlexibilityGuidedHold,
  restartFlexibilityGuidedHold,
  saveFlexibilityDraft,
  saveFlexibilityRoutine,
  saveFlexibilitySession,
  selectCompletedGuidedRegions,
  selectFlexibilityGuidedHold,
  selectFlexibilityRegionStatuses,
  startFlexibilityGuidedHold,
  suggestNextFlexibilityStretch,
  skipFlexibilityGuidedHold,
  validateFlexibilityData
} from '../src/domain/flexibility.ts';
import type { FlexibilitySession } from '../src/domain/flexibility.ts';

describe('Flexibility diagnostic schedule and records', () => {
  it('uses configured intervals to report last-stretched recency and due status', () => {
    const data = {
      ...createFlexibilityData(),
      sessions: [{ id: 'stretch-a', date: '2026-10-20', regionIds: ['hamstrings' as const] }]
    };
    const regionStatuses = selectFlexibilityRegionStatuses(data, '2026-10-23');

    expect(regionStatuses.find(region => region.id === 'hamstrings')).toMatchObject({
      intervalDays: 2,
      daysSince: 3,
      daysUntilDue: -1,
      status: '1 day overdue.'
    });
    expect(regionStatuses.find(region => region.id === 'calves')).toMatchObject({
      lastStretched: null,
      daysSince: null,
      daysUntilDue: null,
      historyState: 'never-stretched'
    });
  });

  it('recalculates the last-stretched date when a session is edited or deleted', () => {
    const original: FlexibilitySession = {
      id: 'stretch-a',
      date: '2026-10-20',
      regionIds: ['hamstrings']
    };
    const newer: FlexibilitySession = {
      id: 'stretch-b',
      date: '2026-10-22',
      regionIds: ['hamstrings']
    };
    const edited = saveFlexibilitySession([original, newer], {
      ...newer,
      date: '2026-10-21'
    });
    expect(edited.valid).toBe(true);
    if (!edited.valid) return;
    expect(selectFlexibilityRegionStatuses({ ...createFlexibilityData(), sessions: edited.sessions }, '2026-10-23')
      .find(region => region.id === 'hamstrings')?.lastStretched).toBe('2026-10-21');

    const deleted = deleteFlexibilitySession(edited.sessions, 'stretch-b');
    expect(selectFlexibilityRegionStatuses({ ...createFlexibilityData(), sessions: deleted.sessions }, '2026-10-23')
      .find(region => region.id === 'hamstrings')).toMatchObject({
        lastStretched: '2026-10-20',
        daysSince: 3,
        daysUntilDue: -1
      });
  });

  it('provides grouped first-session and due-region recommendations', () => {
    const empty = suggestNextFlexibilityStretch(
      selectFlexibilityRegionStatuses(createFlexibilityData(), '2026-10-23')
    );
    expect(empty.text).toContain('Log your first stretch session');

    const data = {
      ...createFlexibilityData(),
      sessions: [{ id: 'stretch-a', date: '2026-10-20', regionIds: ['hamstrings' as const] }]
    };
    const suggestion = suggestNextFlexibilityStretch(
      selectFlexibilityRegionStatuses(data, '2026-10-23')
    );
    expect(suggestion.regionIds).toContain('hamstrings');
    expect(suggestion.text).toContain('Hamstrings are 1 day overdue');
  });

  it('preserves existing region data while supplying the new Abs default', () => {
    const existingData = {
      settings: { intervals: { hamstrings: 5, calves: 4 } },
      sessions: [{ id: 'existing-stretch', date: '2026-10-20', regionIds: ['hamstrings' as const] }],
      draftSession: {
        date: '2026-10-21',
        regionIds: ['calves' as const],
        minutes: '12',
        notes: 'Existing draft'
      }
    };
    expect(validateFlexibilityData(existingData, '2026-10-23')).toBe(true);

    const regionStatuses = selectFlexibilityRegionStatuses(existingData, '2026-10-23');
    expect(regionStatuses.find(region => region.id === 'hamstrings')).toMatchObject({
      intervalDays: 5,
      lastStretched: '2026-10-20',
      daysUntilDue: 2
    });
    expect(regionStatuses.find(region => region.id === 'calves')?.intervalDays).toBe(4);
    expect(regionStatuses.find(region => region.id === 'abs')).toMatchObject({
      intervalDays: 3,
      lastStretched: null,
      daysUntilDue: null
    });
    expect(existingData.sessions[0]?.regionIds).toEqual(['hamstrings']);
    expect(existingData.draftSession.regionIds).toEqual(['calves']);
  });

  it('supports Abs intervals, recommendations, and history recalculation', () => {
    const logged = saveFlexibilitySession([], {
      id: 'abs-stretch',
      date: '2026-10-19',
      regionIds: ['abs']
    });
    expect(logged.valid).toBe(true);
    if (!logged.valid) return;

    const data = {
      ...createFlexibilityData(),
      settings: { intervals: { abs: 4 } },
      sessions: logged.sessions
    };
    expect(selectFlexibilityRegionStatuses(data, '2026-10-23').find(region => region.id === 'abs'))
      .toMatchObject({ intervalDays: 4, daysSince: 4, daysUntilDue: 0, status: 'Due today.' });
    expect(suggestNextFlexibilityStretch(selectFlexibilityRegionStatuses(data, '2026-10-23')))
      .toMatchObject({ regionIds: ['abs'], reasonRegionId: 'abs' });

    const edited = saveFlexibilitySession(data.sessions, {
      ...data.sessions[0]!,
      date: '2026-10-18'
    });
    expect(edited.valid).toBe(true);
    if (!edited.valid) return;
    expect(selectFlexibilityRegionStatuses({ ...data, sessions: edited.sessions }, '2026-10-23')
      .find(region => region.id === 'abs')).toMatchObject({ daysSince: 5, daysUntilDue: -1 });

    const deleted = deleteFlexibilitySession(edited.sessions, 'abs-stretch');
    expect(deleted.deleted).toBe(true);
    expect(selectFlexibilityRegionStatuses({ ...data, sessions: deleted.sessions }, '2026-10-23')
      .find(region => region.id === 'abs')).toMatchObject({
        lastStretched: null,
        daysUntilDue: null,
        historyState: 'never-stretched'
      });
  });

  it('validates all ten regions, default intervals, and explicit draft clearing', () => {
    expect(flexibilityRegions).toHaveLength(10);
    expect(Object.fromEntries(flexibilityRegions.map(region => [region.id, region.defaultIntervalDays])))
      .toEqual({
        hamstrings: 2,
        calves: 3,
        glutes: 2,
        abs: 3,
        'hip-flexors': 2,
        quads: 3,
        chest: 3,
        shoulders: 3,
        back: 3,
        neck: 2
      });
    const data = createFlexibilityData();
    expect(validateFlexibilityData(data, '2026-10-23')).toBe(true);

    const saved = saveFlexibilityDraft(data, {
      date: '2026-10-23',
      regionIds: ['hip-flexors'],
      minutes: '15',
      notes: 'Easy session'
    }, '2026-10-23');
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    expect(clearFlexibilityDraft(saved.data).draftSession).toBeUndefined();
    expect(saveFlexibilityDraft(data, {
      date: '2026-10-24',
      regionIds: [],
      minutes: '',
      notes: ''
    }, '2026-10-23')).toMatchObject({
      valid: false,
      error: 'The stretch session draft is invalid.'
    });
  });

  it('keeps suggested routines source-aligned and estimates side-specific holds and preparation', () => {
      expect(flexibilityRoutineSuggestions.map(routine => [
        routine.name,
        routine.stretches.map(stretch => stretch.name)
      ])).toEqual([
        ['Daily Stretch', ['Downward Dog', 'Shoulder Stretch', 'Chest Stretch', 'Hamstring Stretch', 'Hip Flexor Stretch', 'Straddle Stretch']],
        ['Quick Full Body', ['Downward Dog', 'Shoulder Stretch', 'Chest Stretch', 'Hamstring Stretch', 'Hip Flexor Stretch', 'Straddle Stretch']],
        ['Upper Body', ['Downward Dog', 'Shoulder Stretch', 'Chest Stretch']],
        ['Lower Body', ['Hamstring Stretch', 'Hip Flexor Stretch', 'Straddle Stretch']]
      ]);
      const daily = flexibilityRoutineSuggestions[0]!;
      expect(daily.stretches.map(stretch => stretch.sideMode))
        .toEqual(['both', 'each', 'each', 'each', 'each', 'both']);
      expect(daily.stretches.every(stretch => stretch.holdSeconds === 60)).toBe(true);
      const saved = saveFlexibilityRoutine([], { ...daily, id: 'saved-daily' });
      expect(saved.valid).toBe(true);
      expect((saved.valid ? saved.routines[0] : null)?.id).toBe('saved-daily');
    });

  it('runs preparation and hold timers from deadlines, including pause, resume, and both directions', () => {
      const routine = {
        ...flexibilityRoutineSuggestions[0]!,
        id: 'timer-routine',
        stretches: [flexibilityRoutineSuggestions[0]!.stretches[0]!]
      };
      const created = createFlexibilityGuidedSession(routine, {
        id: 'timer-session',
        date: '2026-10-23',
        startedAt: '2026-10-23T12:00:00.000Z',
        timeZone: 'UTC',
        preparationSeconds: 5,
        timerDirection: 'up'
      });
      expect(created.valid).toBe(true);
      if (!created.valid) return;
      const started = startFlexibilityGuidedHold(created.session, '2026-10-23T12:00:00.000Z');
      expect(started.valid).toBe(true);
      if (!started.valid) return;
      expect(started.session.timer).toMatchObject({
        phase: 'preparing',
        deadlineAt: '2026-10-23T12:00:05.000Z'
      });
      const delayed = advanceFlexibilityGuidedTimer(started.session, '2026-10-23T12:02:00.000Z');
      expect(delayed.valid && delayed.session.timer.phase).toBe('complete');
      const holding = advanceFlexibilityGuidedTimer(started.session, '2026-10-23T12:00:05.000Z');
      expect(holding.valid && holding.session.timer).toMatchObject({
        phase: 'holding',
        holdStartedAt: '2026-10-23T12:00:05.000Z',
        deadlineAt: '2026-10-23T12:01:05.000Z'
      });
      if (!holding.valid) return;
      const paused = pauseFlexibilityGuidedHold(holding.session, '2026-10-23T12:00:25.000Z');
      expect(paused.valid && paused.session.timer).toMatchObject({
        phase: 'paused',
        remainingMilliseconds: 40_000,
        elapsedBeforePauseMilliseconds: 20_000
      });
      if (!paused.valid) return;
      const resumed = resumeFlexibilityGuidedHold(paused.session, '2026-10-23T12:10:00.000Z');
      expect(resumed.valid && resumed.session.timer).toMatchObject({
        phase: 'holding',
        holdStartedAt: '2026-10-23T12:09:40.000Z',
        deadlineAt: '2026-10-23T12:10:40.000Z'
      });
      if (!resumed.valid) return;
      const complete = advanceFlexibilityGuidedTimer(resumed.session, '2026-10-23T12:10:40.000Z');
      expect(complete.valid && complete.session.timer.phase).toBe('complete');
    });

  it('supports restart, extra rounds, explicit early duration, skips, and exactly-once session saving', () => {
      const routine = {
        ...flexibilityRoutineSuggestions[0]!,
        id: 'finish-routine',
        stretches: [flexibilityRoutineSuggestions[0]!.stretches[1]!]
      };
      const created = createFlexibilityGuidedSession(routine, {
        id: 'finish-session',
        date: '2026-10-23',
        startedAt: '2026-10-23T12:00:00.000Z',
        timeZone: 'UTC',
        preparationSeconds: 0
      });
      expect(created.valid).toBe(true);
      if (!created.valid) return;

      const extraRound = addFlexibilityGuidedRound(created.session);
      expect(extraRound.valid).toBe(true);
      if (!extraRound.valid) return;
      expect(extraRound.session.holds.map(hold => hold.id)).toEqual([
        'finish-session-hold-1', 'finish-session-hold-2',
        'finish-session-hold-3', 'finish-session-hold-4'
      ]);
      expect(completeFlexibilityGuidedHold(created.session, '2026-10-23T12:00:10.000Z', 8).valid)
        .toBe(false);
      const started = startFlexibilityGuidedHold(extraRound.session, '2026-10-23T12:00:00.000Z');
      expect(started.valid).toBe(true);
      if (!started.valid) return;
      const paused = pauseFlexibilityGuidedHold(started.session, '2026-10-23T12:00:10.000Z');
      expect(paused.valid).toBe(true);
      if (!paused.valid) return;
      const restarted = restartFlexibilityGuidedHold(paused.session);
      expect(restarted.valid && restarted.session.timer.phase).toBe('idle');
      const early = completeFlexibilityGuidedHold(paused.session, '2026-10-23T12:00:10.000Z', 8);
      expect(early.valid).toBe(true);
      if (!early.valid) return;
      expect(selectCompletedGuidedRegions(early.session)).toEqual(['shoulders']);
      expect(finishFlexibilityGuidedSession(createFlexibilityData(), early.session)).toMatchObject({
        valid: false,
        error: 'Complete or skip every hold before finishing.'
      });
      let allHoldsResolved = early.session;
      for (let index = 1; index < allHoldsResolved.holds.length; index += 1) {
        const selected = selectFlexibilityGuidedHold(allHoldsResolved, index);
        expect(selected.valid).toBe(true);
        if (!selected.valid) return;
        const skipped = skipFlexibilityGuidedHold(selected.session);
        expect(skipped.valid).toBe(true);
        if (!skipped.valid) return;
        allHoldsResolved = skipped.session;
      }
      expect(allHoldsResolved.holds.filter(hold => hold.status === 'skipped')).toHaveLength(3);
      const data = createFlexibilityData();
      const finished = finishFlexibilityGuidedSession({ ...data, sessions: [
        { id: 'manual-history', date: '2026-10-20', regionIds: ['hamstrings'] }
      ] }, allHoldsResolved);
      expect(finished.valid).toBe(true);
      if (!finished.valid) return;
      expect(finished.data.guidedSessions).toHaveLength(1);
      expect(finished.data.guidedSessionDraft).toBeUndefined();
      expect(finished.data.sessions).toHaveLength(1);
      expect(selectFlexibilityRegionStatuses(finished.data, '2026-10-23')
        .find(region => region.id === 'shoulders')?.lastStretched).toBe('2026-10-23');
      expect(finishFlexibilityGuidedSession(finished.data, allHoldsResolved)).toMatchObject({
        valid: false,
        error: 'This guided stretch session has already been saved.'
    });
  });

  it('adds only the selected stretch as a new round and preserves side order', () => {
    const base = flexibilityRoutineSuggestions[0]!;
    const routine = {
    ...base,
    id: 'per-stretch-rounds',
    stretches: [base.stretches[0]!, base.stretches[3]!]
    };
    const created = createFlexibilityGuidedSession(routine, {
    id: 'per-stretch-rounds-session',
    date: '2026-10-23',
    startedAt: '2026-10-23T12:00:00.000Z',
    timeZone: 'UTC',
    preparationSeconds: 0
    });
    expect(created.valid).toBe(true);
    if (!created.valid) return;

    const bilateralRound = addFlexibilityGuidedRound(created.session);
    expect(bilateralRound.valid).toBe(true);
    if (!bilateralRound.valid) return;
    expect(bilateralRound.session.holds.slice(3).map(hold => ({
    stretchId: hold.stretchId,
    side: hold.side,
    round: hold.round
    }))).toEqual([{ stretchId: 'downward-dog', side: 'both', round: 2 }]);

    const selectedHamstring = selectFlexibilityGuidedHold(bilateralRound.session, 1);
    expect(selectedHamstring.valid).toBe(true);
    if (!selectedHamstring.valid) return;
    const pairedRound = addFlexibilityGuidedRound(selectedHamstring.session);
    expect(pairedRound.valid).toBe(true);
    if (!pairedRound.valid) return;
    expect(pairedRound.session.holds.slice(4).map(hold => ({
    stretchId: hold.stretchId,
    side: hold.side,
    round: hold.round
    }))).toEqual([
    { stretchId: 'hamstring-stretch', side: 'left', round: 2 },
    { stretchId: 'hamstring-stretch', side: 'right', round: 2 }
    ]);
  });
});
