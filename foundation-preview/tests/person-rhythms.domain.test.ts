import { describe, expect, it } from 'vitest';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import { selectPersonRhythmsDueToday } from '../src/domain/person-rhythms.ts';

const rhythm = (overrides: Partial<RhythmPreview>): RhythmPreview => ({
  id: 'user-rhythm-11111111-1111-4111-8111-111111111111',
  title: 'Avery rhythm',
  description: 'A synthetic linked Rhythm.',
  automation: 'manual',
  status: 'Not confirmed',
  cadence: 'Weekly',
  timeLabel: 'Morning',
  personIds: ['sample-person-avery'],
  categoryIds: [],
  primaryFoundationId: null,
  secondaryFoundationIds: [],
  ...overrides
});

describe('person-scoped due Rhythm selection', () => {
  it('includes only associated scheduled occurrences and preserves unscheduled Due today records', () => {
    const daily = rhythm({
      id: 'user-rhythm-11111111-1111-4111-8111-111111111111',
      schedule: { frequency: 'daily' }
    });
    const scheduledToday = rhythm({
      id: 'user-rhythm-22222222-2222-4222-8222-222222222222',
      schedule: { frequency: 'weekly', weekdays: [3] }
    });
    const notScheduledToday = rhythm({
      id: 'user-rhythm-33333333-3333-4333-8333-333333333333',
      schedule: { frequency: 'weekly', weekdays: [1] }
    });
    const legacyDue = rhythm({
      id: 'user-rhythm-44444444-4444-4444-8444-444444444444',
      status: 'Due today'
    });
    const unassociated = rhythm({
      id: 'user-rhythm-55555555-5555-4555-8555-555555555555',
      schedule: { frequency: 'daily' },
      personIds: ['sample-person-morgan']
    });

    expect(selectPersonRhythmsDueToday(
      [daily, scheduledToday, notScheduledToday, legacyDue, unassociated],
      'sample-person-avery',
      '2026-10-21'
    ).map(item => item.id)).toEqual([daily.id, scheduledToday.id, legacyDue.id]);
  });
});
