import { describe, expect, it } from 'vitest';
import type { PersonPrayerRequest } from '../src/domain/person-prayers.ts';
import { createDefaultTimeBlockSettings } from '../src/domain/time-blocks.ts';
import {
  createPrayerSession,
  endPrayerSession,
  markPrayerSessionPrayed,
  movePrayerSession,
  isPrayerRequestScheduledOn,
  prayerScore,
  prayerTimeframeOptions,
  resolvePrayerTimeframeBlock,
  selectActivePrayerRequests,
  togglePrayerSelectionGroup
} from '../src/domain/prayer-session.ts';

function request(
  id: string,
  personId: string,
  options: Partial<PersonPrayerRequest> = {}
): PersonPrayerRequest {
  return {
    id,
    personId,
    title: id,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    prayerLogs: [],
    ...options
  };
}

describe('Prayer session selection', () => {
  it('resolves Now to the active time block, including the overnight last block', () => {
    const settings = createDefaultTimeBlockSettings();
    expect(resolvePrayerTimeframeBlock('now', new Date(2026, 0, 1, 10), settings)?.id)
      .toBe('morning');
    expect(resolvePrayerTimeframeBlock('now', new Date(2026, 0, 1, 2), settings)?.id)
      .toBe('bedtime');
    expect(resolvePrayerTimeframeBlock('all-day', new Date(2026, 0, 1, 10), settings))
      .toBeNull();
  });

  it('offers Now, every configured block, All Day, and all prayers today', () => {
    const requests = [
      request('morning', 'amy', { timeOfDay: 'morning' }),
      request('evening', 'amy', { timeOfDay: 'evening' }),
      request('anytime', 'amy'),
      request('all-day', 'amy', { timeOfDay: 'all-day' }),
      request('tomorrow', 'amy', { schedule: { frequency: 'weekly', weekdays: [5] } })
    ];
    const options = prayerTimeframeOptions(
      requests,
      ['amy'],
      new Date(2026, 0, 1, 10),
      createDefaultTimeBlockSettings(),
      'UTC'
    );
    expect(options.map(option => option.id)).toEqual([
      'now', 'early-morning', 'morning', 'lunch', 'afternoon', 'way-home',
      'evening', 'bedtime', 'all-day', 'all-prayers-today'
    ]);
    expect(options.find(option => option.id === 'morning')).toMatchObject({
      description: '9:00am – 11:30am',
      count: 2,
      isCurrent: true
    });
    expect(options.find(option => option.id === 'now')).toMatchObject({
      count: 2,
      isCurrent: true
    });
    expect(options.find(option => option.id === 'evening')?.count).toBe(2);
    expect(options.find(option => option.id === 'all-day')).toMatchObject({
      description: 'Any time today',
      count: 5
    });
    expect(options.find(option => option.id === 'all-prayers-today')).toMatchObject({
      description: 'Across every time block',
      count: 4
    });
  });

  it('selects only scheduled active requests owned by or shared with a selected person', () => {
    const requests = [
      request('owned', 'amy', { timeOfDay: 'morning' }),
      request('shared', 'lee', { sharedWith: ['amy'], timeOfDay: 'anytime' }),
      request('wrong-time', 'amy', { timeOfDay: 'evening' }),
      request('not-selected', 'lee'),
      request('answered', 'amy', { status: 'answered' })
    ];
    expect(selectActivePrayerRequests(
      requests, ['amy'], 'morning', new Date(2026, 0, 1, 10), createDefaultTimeBlockSettings(), 'UTC'
    ).map(item => item.id)).toEqual(['owned', 'shared']);
    expect(selectActivePrayerRequests(
      requests, [], 'all-day', new Date(2026, 0, 1, 10), createDefaultTimeBlockSettings(), 'UTC'
    )).toEqual([]);
  });

  it('matches Anytime in configured blocks, keeps All day out of them, and includes both in the full-day queue', () => {
    const requests = [
      request('morning', 'amy', { timeOfDay: 'morning' }),
      request('evening', 'amy', { timeOfDay: 'evening' }),
      request('anytime', 'amy', { timeOfDay: 'anytime' }),
      request('all-day', 'amy', { timeOfDay: 'all-day' }),
      request('tomorrow', 'amy', { schedule: { frequency: 'weekly', weekdays: [5] } })
    ];
    const instant = new Date(2026, 0, 1, 10);
    const settings = createDefaultTimeBlockSettings();
    const selectIds = (timeframe: 'morning' | 'evening' | 'all-day' | 'all-prayers-today') =>
      selectActivePrayerRequests(requests, ['amy'], timeframe, instant, settings, 'UTC')
        .map(item => item.id);

    expect(selectIds('morning')).toEqual(['morning', 'anytime']);
    expect(selectIds('evening')).toEqual(['evening', 'anytime']);
    expect(selectIds('all-day')).toEqual(expect.arrayContaining([
      'all-day', 'morning', 'evening', 'anytime', 'tomorrow'
    ]));
    expect(selectIds('all-prayers-today')).toEqual(['all-day', 'morning', 'evening', 'anytime']);
  });

  it('uses the shared recurrence selector to determine prayer due dates', () => {
    const weekly = request('weekly', 'amy', {
      schedule: { frequency: 'weekly', weekdays: [4] },
      timeOfDay: 'morning'
    });
    expect(isPrayerRequestScheduledOn(weekly, '2026-01-01', 'UTC')).toBe(true);
    expect(isPrayerRequestScheduledOn(weekly, '2026-01-02', 'UTC')).toBe(false);
    expect(isPrayerRequestScheduledOn(weekly, '2025-12-31', 'UTC')).toBe(false);
  });

  it('orders mixed-frequency requests by their shared-scheduler due score', () => {
    const requests = [
      request('monthly', 'amy', {
        schedule: { frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 10 } }
      }),
      request('weekly', 'amy', {
        schedule: { frequency: 'weekly', weekdays: [6] }
      }),
      request('daily', 'amy')
    ];
    expect(selectActivePrayerRequests(
      requests,
      ['amy'],
      'all-day',
      new Date('2026-01-10T12:00:00.000Z'),
      createDefaultTimeBlockSettings(),
      'UTC'
    ).map(item => item.id)).toEqual(['daily', 'weekly', 'monthly']);
  });

  it('clamps the classic due score to a request schedule end date', () => {
    const ended = request('ended', 'amy', {
      schedule: { frequency: 'daily', endDate: '2026-01-10' },
      prayerLogs: [{ id: 'last-log', prayedAt: '2026-01-08T12:00:00.000Z' }]
    });
    expect(prayerScore(ended, '2026-01-12', 'UTC')).toBe(80);
  });

  it('toggles a people group while retaining selections outside the group', () => {
    const group = { memberIds: ['amy', 'lee'] };
    expect(togglePrayerSelectionGroup(['amy', 'other'], group).sort())
      .toEqual(['amy', 'lee', 'other']);
    expect(togglePrayerSelectionGroup(['amy', 'lee', 'other'], group).sort())
      .toEqual(['other']);
  });

  it('orders by classic due score, time block, latest log timestamp, then title', () => {
    const requests = [
      request('recent', 'amy', {
        title: 'Recent log',
        timeOfDay: 'morning',
        prayerLogs: [{ id: 'log-3', prayedAt: '2026-01-09T00:00:00.000Z' }]
      }),
      request('newer-log', 'amy', {
        title: 'Newer log',
        timeOfDay: 'anytime',
        prayerLogs: [{ id: 'log-2', prayedAt: '2026-01-08T00:00:00.000Z' }]
      }),
      request('same-day-later', 'amy', {
        title: 'Later same-day log',
        timeOfDay: 'anytime',
        prayerLogs: [{ id: 'log-4', prayedAt: '2026-01-08T15:00:00.000Z' }]
      }),
      request('same-day-earlier', 'amy', {
        title: 'Earlier same-day log',
        timeOfDay: 'anytime',
        prayerLogs: [{ id: 'log-5', prayedAt: '2026-01-08T05:00:00.000Z' }]
      }),
      request('oldest', 'amy', { title: 'Oldest due', timeOfDay: 'evening' }),
      request('first-title', 'amy', { title: 'A due', timeOfDay: 'all-day' }),
      request('second-title', 'amy', { title: 'B due', timeOfDay: 'all-day' })
    ];
    expect(selectActivePrayerRequests(
      requests,
      ['amy'],
      'all-day',
      new Date('2026-01-10T12:00:00.000Z'),
      createDefaultTimeBlockSettings(),
      'UTC'
    ).map(item => item.id)).toEqual([
      'first-title', 'second-title', 'oldest', 'newer-log',
      'same-day-earlier', 'same-day-later', 'recent'
    ]);
  });
});

describe('Prayer session state', () => {
  it('records only the Prayed transition, once for the current request', () => {
    const session = createPrayerSession([request('one', 'amy'), request('two', 'lee')])!;
    const skipped = movePrayerSession(session, 1);
    expect(skipped.prayedIds).toEqual([]);
    expect(skipped.index).toBe(1);
    const backedUp = movePrayerSession(skipped, -1);
    const prayed = markPrayerSessionPrayed(backedUp, 'one');
    expect(prayed.prayedIds).toEqual(['one']);
    expect(prayed.index).toBe(1);
    expect(markPrayerSessionPrayed(prayed, 'one')).toBe(prayed);
    expect(markPrayerSessionPrayed(prayed, 'two').prayedIds).toEqual(['one', 'two']);
  });

  it('supports ending and completing a session without recording extra logs', () => {
    const session = createPrayerSession([request('one', 'amy')])!;
    const completed = markPrayerSessionPrayed(session, 'one');
    expect(completed.index).toBe(completed.requestIds.length);
    expect(endPrayerSession(session)).toMatchObject({ ended: true, prayedIds: [] });
    expect(createPrayerSession([])).toBeNull();
  });
});
