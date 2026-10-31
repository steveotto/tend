import { describe, expect, it } from 'vitest';
import {
  annualDateSummary,
  birthdaySummary,
  connectionStyleLabel,
  personDetailsDraft,
  savePersonDetailsCommand,
  validatePersonDetailsCollection,
  validatePersonDetailsDraft
} from '../src/domain/person-details.ts';
import { createSamplePreviewData, createPreviewEnvelope, parsePreviewBackup } from '../src/domain/preview-state.ts';

describe('person details domain', () => {
  it('saves optional person-owned details and clears every field without changing classifications', () => {
    const data = createSamplePreviewData();
    const groupsBefore = structuredClone(data.peopleGroups);
    const draft = {
      relationshipLabel: '  Sister  ',
      birthdayMonthDay: '02-29',
      birthdayYear: '',
      anniversaryMonthDay: '12-31',
      connectionStyle: 'wa'
    };
    const saved = savePersonDetailsCommand([], 'sample-person-avery', draft, '2026-10-31');
    expect(saved).toEqual({
      valid: true,
      details: [{
        personId: 'sample-person-avery',
        relationshipLabel: '  Sister  ',
        birthday: { monthDay: '02-29' },
        anniversary: { monthDay: '12-31' },
        connectionStyle: 'wa'
      }]
    });
    if (!saved.valid) throw new Error('Expected valid Person details draft.');
    const cleared = savePersonDetailsCommand(saved.details, 'sample-person-avery', personDetailsDraft(), '2026-10-31');
    expect(cleared).toEqual({ valid: true, details: [] });
    expect(data.peopleGroups).toEqual(groupsBefore);
    expect(data.friendships.connections).toEqual([]);
    expect(data.savedRhythms).toEqual([]);
  });

  it('validates calendar dates and disallows future or impossible known birthdays', () => {
    const base = personDetailsDraft();
    expect(validatePersonDetailsDraft({ ...base, birthdayMonthDay: '02-30' }, '2026-10-31').valid).toBe(false);
    expect(validatePersonDetailsDraft({ ...base, birthdayMonthDay: '02-29', birthdayYear: '2025' }, '2026-10-31').valid).toBe(false);
    expect(validatePersonDetailsDraft({ ...base, birthdayMonthDay: '02-29', birthdayYear: '2000' }, '2026-10-31').valid).toBe(true);
    expect(validatePersonDetailsDraft({ ...base, birthdayMonthDay: '12-01', birthdayYear: '2027' }, '2026-10-31').valid).toBe(false);
    expect(validatePersonDetailsDraft({ ...base, birthdayYear: '1990' }, '2026-10-31')).toMatchObject({
      valid: false,
      errors: { birthdayMonthDay: expect.any(String) }
    });
  });

  it('calculates age only with a known year and treats today as the upcoming date', () => {
    expect(birthdaySummary({ monthDay: '10-31', year: 2000 }, '2026-10-31')).toEqual({
      label: '26 · Birthday today',
      age: 26
    });
    expect(birthdaySummary({ monthDay: '11-01', year: 2000 }, '2026-10-31')).toEqual({
      label: '25 · Birthday in 1 day',
      age: 25
    });
    expect(birthdaySummary({ monthDay: '10-31' }, '2026-10-31')).toEqual({ label: 'Birthday today' });
  });

  it('handles year rollover, leap-day boundaries, and the approved March 1 observance', () => {
    expect(annualDateSummary('01-01', '2026-12-31')).toEqual({
      date: '2027-01-01',
      daysUntil: 1
    });
    expect(annualDateSummary('02-29', '2024-02-28')).toEqual({
      date: '2024-02-29',
      daysUntil: 1
    });
    expect(annualDateSummary('02-29', '2026-02-28')).toEqual({
      date: '2026-03-01',
      daysUntil: 1
    });
    expect(annualDateSummary('02-29', '2026-03-01')).toEqual({
      date: '2026-03-01',
      daysUntil: 0
    });
    expect(birthdaySummary({ monthDay: '02-29', year: 2000 }, '2026-02-28')).toMatchObject({
      label: '25 · Birthday in 1 day',
      age: 25
    });
  });

  it('uses date-only anniversaries and the supported legacy connection-style labels', () => {
    expect(annualDateSummary('12-31', '2026-12-31')?.daysUntil).toBe(0);
    expect(connectionStyleLabel('pt')).toBe('Physical Touch');
    expect(connectionStyleLabel('qt')).toBe('Quality Time');
    expect(validatePersonDetailsCollection([{
      personId: 'sample-person-avery',
      anniversary: { monthDay: '03-15' },
      connectionStyle: 'as'
    }], '2026-10-31')).toBe(true);
    expect(validatePersonDetailsCollection([{
      personId: 'sample-person-avery',
      birthday: { monthDay: '02-29', year: 2025 }
    }], '2026-10-31')).toBe(false);
    expect(validatePersonDetailsCollection([{
      personId: 'sample-person-avery',
      birthday: { monthDay: '02-29', year: 2000 }
    }], '2026-10-31')).toBe(true);
  });

  it('round-trips optional details in schema v29 and rejects unresolved or malformed records', () => {
    const data = createSamplePreviewData();
    data.personDetails = [{
      personId: 'sample-person-morgan',
      birthday: { monthDay: '02-29' },
      connectionStyle: 'gf'
    }];
    const raw = JSON.stringify(createPreviewEnvelope(data));
    const parsed = parsePreviewBackup(raw, '2026-10-31');
    expect(parsed.valid).toBe(true);
    if (parsed.valid) expect(parsed.envelope.data.personDetails).toEqual(data.personDetails);

    const malformed = JSON.parse(raw) as { data: { personDetails: unknown[] } };
    malformed.data.personDetails = [{ personId: 'unknown-person', relationshipLabel: 'Friend' }];
    expect(parsePreviewBackup(JSON.stringify(malformed), '2026-10-31')).toMatchObject({
      valid: false,
      message: expect.stringContaining('Person details')
    });
  });
});
