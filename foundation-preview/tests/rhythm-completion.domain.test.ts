import { describe, expect, it } from 'vitest';
import {
  deleteDatedCompletion,
  localDateTimeInZone,
  prepareDatedRhythmCompletion,
  prepareUndatedRhythmCompletionEdit,
  removeActionCompletion
} from '../src/domain/rhythm-completion.ts';

const now = new Date('2026-11-01T12:00:00.000Z');

function draft(overrides: Partial<Parameters<typeof prepareDatedRhythmCompletion>[0]> = {}) {
  return {
    id: 'record-one',
    rhythmId: 'sample-pray-together',
    effectiveDate: '2026-11-01',
    hour: 11,
    minute: 59,
    period: 'AM' as const,
    memory: '',
    timeZone: 'UTC',
    ...overrides
  };
}

describe('dated Rhythm completion preparation', () => {
  it('converts midnight, noon, and minute boundaries into the correct local times', () => {
    const midnight = prepareDatedRhythmCompletion(draft({ hour: 12, minute: 0, period: 'AM' }), now);
    const noon = prepareDatedRhythmCompletion(draft({ hour: 12, minute: 0, period: 'PM' }), now);
    const lastMinute = prepareDatedRhythmCompletion(draft({ hour: 11, minute: 59, period: 'AM' }), now);

    expect(midnight.valid && midnight.record).toMatchObject({
      localTime: '00:00',
      completedAt: '2026-11-01T00:00:00.000Z'
    });
    expect(noon.valid && noon.record).toMatchObject({
      localTime: '12:00',
      completedAt: '2026-11-01T12:00:00.000Z'
    });
    expect(lastMinute.valid && lastMinute.record.localTime).toBe('11:59');
  });

  it('preserves backdated local calendar dates, timezone context, and optional memory', () => {
    const result = prepareDatedRhythmCompletion(draft({
      effectiveDate: '2026-10-31',
      hour: 8,
      minute: 5,
      period: 'PM',
      memory: '  Talked about the week.  ',
      timeZone: 'America/Los_Angeles'
    }), now);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.record).toMatchObject({
      effectiveDate: '2026-10-31',
      localTime: '20:05',
      timeZone: 'America/Los_Angeles',
      completedAt: '2026-11-01T03:05:00.000Z',
      memory: '  Talked about the week.  ',
      recordedAt: now.toISOString()
    });
  });

  it('rejects future and nonexistent daylight-saving local times', () => {
    expect(prepareDatedRhythmCompletion(draft({
      hour: 12,
      minute: 1,
      period: 'PM'
    }), now)).toMatchObject({
      valid: false,
      errors: { time: 'Choose a time that is not in the future.' }
    });

    expect(prepareDatedRhythmCompletion(draft({
      effectiveDate: '2026-03-08',
      hour: 2,
      minute: 30,
      period: 'AM',
      timeZone: 'America/New_York'
    }), now)).toMatchObject({ valid: false, errors: { time: expect.any(String) } });
  });

  it('keeps local calendar reconstruction separate from UTC date formatting', () => {
    const instant = localDateTimeInZone('2026-01-01', '00:15', 'America/Los_Angeles');
    expect(instant.toISOString()).toBe('2026-01-01T08:15:00.000Z');
  });

  it('undoes only the record linked to this completion action', () => {
    const records = [
      { ...preparedRecord(), id: 'linked' },
      {
        id: 'unrelated',
        rhythmId: 'sample-connect',
        effectiveDate: '2026-10-31',
        localTime: '10:00',
        timeZone: 'UTC',
        completedAt: '2026-10-31T10:00:00.000Z',
        recordedAt: '2026-10-31T10:01:00.000Z'
      }
    ];
    const result = removeActionCompletion(records, [
      { rhythmId: 'sample-pray-together', completionId: 'linked' }
    ], 'sample-pray-together');

    expect(result.records.map(record => record.id)).toEqual(['unrelated']);
    expect(result.active).toEqual([]);
    expect(result.removedRecordId).toBe('linked');
  });

  it('deletes only the selected record and keeps Tend state consistent with remaining and legacy records', () => {
    const linked = { ...preparedRecord(), id: 'linked' };
    const unrelated = {
      ...preparedRecord(),
      id: 'unrelated',
      effectiveDate: '2026-10-31'
    };
    const active = [{ rhythmId: linked.rhythmId, completionId: linked.id }];
    const completed = [linked.rhythmId];

    expect(deleteDatedCompletion([linked, unrelated], active, completed, linked.id)).toEqual({
      records: [unrelated],
      active: [],
      completedRhythmIds: [linked.rhythmId]
    });
    expect(deleteDatedCompletion([linked], active, completed, linked.id)).toEqual({
      records: [],
      active: [],
      completedRhythmIds: []
    });
    expect(deleteDatedCompletion([unrelated], [], completed, unrelated.id)).toEqual({
      records: [],
      active: [],
      completedRhythmIds: [linked.rhythmId]
    });
  });
});

describe('date-only Rhythm completion edits', () => {
  it('updates the date and memory without creating missing time metadata', () => {
    const result = prepareUndatedRhythmCompletionEdit({
      id: 'sample-connect-2026-10-17',
      rhythmId: 'sample-connect',
      effectiveDate: '2026-10-16',
      memory: 'A remembered moment.'
    }, now);
    expect(result).toEqual({
      valid: true,
      record: {
        id: 'sample-connect-2026-10-17',
        rhythmId: 'sample-connect',
        effectiveDate: '2026-10-16',
        memory: 'A remembered moment.'
      }
    });
  });

  it('rejects an invalid date and oversized memory without normalizing the input', () => {
    expect(prepareUndatedRhythmCompletionEdit({
      id: 'sample-connect-2026-10-17',
      rhythmId: 'sample-connect',
      effectiveDate: '2026-11-02',
      memory: 'x'.repeat(1001)
    }, now)).toMatchObject({
      valid: false,
      errors: {
        effectiveDate: expect.any(String),
        memory: expect.any(String)
      }
    });
  });
});

function preparedRecord() {
  const result = prepareDatedRhythmCompletion(draft(), now);
  if (!result.valid) throw new Error('Expected the example completion to be valid.');
  return result.record;
}
