import { describe, expect, it } from 'vitest';
import { syntheticPrayerRequests } from '../src/domain/preview-data.ts';
import {
  createPrayerSession,
  currentPrayerTimeframe,
  markPrayerSessionPrayed,
  movePrayerSession,
  recordPreviewPrayer,
  selectActivePrayerRequests
} from '../src/domain/prayer-session.ts';

const afternoon = new Date('2026-11-11T13:30:00.000Z');

describe('Today Prayer domain', () => {
  it('selects active requests by synthetic people, timeframe, and shared association', () => {
    expect(currentPrayerTimeframe(afternoon, 'UTC')).toBe('afternoon');
    expect(selectActivePrayerRequests(
      syntheticPrayerRequests,
      ['sample-person-jordan'],
      'now',
      afternoon,
      'UTC'
    ).map(request => request.id)).toEqual(['sample-prayer-request-family']);
    expect(selectActivePrayerRequests(
      syntheticPrayerRequests,
      ['sample-person-avery'],
      'morning',
      afternoon,
      'UTC'
    )).toEqual([]);
    expect(selectActivePrayerRequests(
      syntheticPrayerRequests,
      ['sample-person-avery', 'sample-person-morgan', 'sample-person-jordan'],
      'allrequests',
      afternoon,
      'UTC'
    ).map(request => request.id)).toEqual([
      'sample-prayer-request-family',
      'sample-prayer-request-friend'
    ]);
  });

  it('keeps session movement bounded and records only the current active request', () => {
    const active = syntheticPrayerRequests.filter(request => request.status === 'active');
    const session = createPrayerSession(active);
    expect(session).not.toBeNull();
    if (!session) return;

    expect(movePrayerSession(session, -1).index).toBe(0);
    const marked = markPrayerSessionPrayed(session, active[0]!.id);
    expect(marked.prayedIds).toEqual([active[0]!.id]);
    expect(marked.index).toBe(1);
    expect(markPrayerSessionPrayed(marked, active[0]!.id)).toBe(marked);
    expect(movePrayerSession(marked, 1).index).toBe(1);
  });

  it('updates synthetic prayer history without changing other requests', () => {
    const result = recordPreviewPrayer(
      syntheticPrayerRequests,
      'sample-prayer-request-family',
      '2026-11-11T13:30:00.000Z'
    );
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.requests[0]).toMatchObject({
      prayedCount: 2,
      lastPrayedAt: '2026-11-11T13:30:00.000Z'
    });
    expect(result.requests[1]).toEqual(syntheticPrayerRequests[1]);
    expect(recordPreviewPrayer(result.requests, 'sample-prayer-request-answered', '2026-11-11T13:30:00.000Z'))
      .toEqual({ valid: false, error: 'This prayer request is no longer active.' });
  });
});
