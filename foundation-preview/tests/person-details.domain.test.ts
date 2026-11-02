import { describe, expect, it } from 'vitest';
import {
  annualDateSummary,
  birthdayCardSummary,
  birthdaySummary,
  connectionStyleLabel,
  isStandardRelationship,
  personDetailsDraft,
  savePersonDetailsCommand,
  validatePersonDetailsCollection,
  validatePersonDetailsDraft
} from '../src/domain/person-details.ts';
import { createSamplePreviewData, createPreviewEnvelope, parsePreviewBackup } from '../src/domain/preview-state.ts';

describe('person details domain', () => {
  it('saves optional person-owned details, preserves relationship text, and clears editable fields', () => {
    const data = createSamplePreviewData();
    const groupsBefore = structuredClone(data.peopleGroups);
    const current = [{ personId: 'sample-person-avery', relationshipLabel: 'Sister' }];
    const draft = {
      categoryIds: [],
      categoryChanged: false,
      relationshipChoice: 'not-set',
      relationshipLabel: '',
      relationshipChanged: false,
      birthdayDate: '2000-02-29',
      birthdayYearUnknown: true,
      anniversaryDate: '2000-12-31',
      anniversaryYearUnknown: true,
      connectionStyle: 'wa',
      connectionCadence: '',
      photoDataUrl: ''
    };
    const saved = savePersonDetailsCommand(current, 'sample-person-avery', draft, '2026-10-31');
    expect(saved).toEqual({
      valid: true,
      details: [{
        personId: 'sample-person-avery',
        relationshipLabel: 'Sister',
        birthday: { monthDay: '02-29' },
        anniversary: { monthDay: '12-31' },
        connectionStyle: 'wa'
      }]
    });
    if (!saved.valid) throw new Error('Expected valid Person details draft.');
    const cleared = savePersonDetailsCommand(
      saved.details,
      'sample-person-avery',
      personDetailsDraft(),
      '2026-10-31'
    );
    expect(cleared).toEqual({
      valid: true,
      details: [{ personId: 'sample-person-avery', relationshipLabel: 'Sister' }]
    });
    expect(data.peopleGroups).toEqual(groupsBefore);
    expect(data.friendships.connections).toEqual([]);
    expect(data.savedRhythms).toEqual([]);
  });

  it('validates combined date-picker values and disallows future or impossible known birthdays', () => {
    const base = personDetailsDraft();
    expect(validatePersonDetailsDraft({ ...base, birthdayDate: '2026-02-30' }, '2026-10-31').valid).toBe(false);
    expect(validatePersonDetailsDraft({ ...base, birthdayDate: '2025-02-28' }, '2026-10-31').valid).toBe(true);
    expect(validatePersonDetailsDraft({ ...base, birthdayDate: '2000-02-29' }, '2026-10-31').valid).toBe(true);
    expect(validatePersonDetailsDraft({ ...base, birthdayDate: '2027-12-01' }, '2026-10-31').valid).toBe(false);
    expect(validatePersonDetailsDraft({ ...base, birthdayDate: '2000-02-29', birthdayYearUnknown: false }, '2026-10-31')
      .valid).toBe(true);
    expect(validatePersonDetailsDraft({
      ...base,
      birthdayDate: '2000-02-29',
      birthdayYearUnknown: true
    }, '2026-10-31')).toMatchObject({
      valid: true,
      details: { birthday: { monthDay: '02-29' } }
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

  it('retains full and unknown-year anniversaries, love-language labels and relationship values', () => {
    expect(annualDateSummary('12-31', '2026-12-31')?.daysUntil).toBe(0);
    expect(connectionStyleLabel('pt')).toBe('Physical Touch');
    expect(connectionStyleLabel('qt')).toBe('Quality Time');
    expect(isStandardRelationship('Spouse')).toBe(true);
    expect(isStandardRelationship('Other')).toBe(true);
    expect(isStandardRelationship('Great-aunt')).toBe(false);
    const fullAnniversary = validatePersonDetailsDraft({
      ...personDetailsDraft(),
      anniversaryDate: '2010-03-15'
    }, '2026-10-31');
    expect(fullAnniversary).toMatchObject({
      valid: true,
      details: { anniversary: { monthDay: '03-15', year: 2010 } }
    });
    const unknownAnniversary = personDetailsDraft({
      personId: 'sample-person-avery',
      anniversary: { monthDay: '02-29' }
    });
    expect(unknownAnniversary.anniversaryDate).toBe('02-29');
    expect(unknownAnniversary.anniversaryYearUnknown).toBe(true);
    expect(validatePersonDetailsCollection([{
      personId: 'sample-person-avery',
      anniversary: { monthDay: '03-15', year: 2010 },
      connectionStyle: 'as'
    }], '2026-10-31')).toBe(true);
    expect(validatePersonDetailsCollection([{
      personId: 'sample-person-avery',
      anniversary: { monthDay: '02-29' }
    }], '2026-10-31', ['sample-person-avery', 'sample-person-morgan', 'sample-person-jordan'])).toBe(true);
    expect(validatePersonDetailsCollection([{
      personId: 'unresolved-person',
      anniversary: { monthDay: '02-29' }
    }], '2026-10-31', ['sample-person-avery', 'sample-person-morgan', 'sample-person-jordan'])).toBe(false);
    expect(validatePersonDetailsCollection([{
      personId: 'sample-person-avery',
      birthday: { monthDay: '02-29', year: 2025 }
    }], '2026-10-31')).toBe(false);
    expect(validatePersonDetailsCollection([{
      personId: 'sample-person-avery',
      birthday: { monthDay: '02-29', year: 2000 }
    }], '2026-10-31')).toBe(true);
  });

  it('preserves partial dates during unrelated edits and exposes concise card countdown wording', () => {
    const partial = [{
      personId: 'sample-person-avery',
      relationshipLabel: 'Sister',
      birthday: { monthDay: '12-02' },
      anniversary: { monthDay: '03-15' }
    }];
    const draft = personDetailsDraft(partial[0]);
    expect(draft.birthdayDate).toBe('12-02');
    expect(draft.anniversaryDate).toBe('03-15');
    expect(savePersonDetailsCommand(partial, 'sample-person-avery', {
      ...draft,
    }, '2026-10-31')).toEqual({
      valid: true,
      details: [partial[0]]
    });

    expect(birthdayCardSummary({ monthDay: '12-02' }, '2026-10-31')).toMatchObject({
      dateLabel: 'December 2',
      countdownLabel: 'in 32d'
    });
    expect(birthdayCardSummary({ monthDay: '10-31' }, '2026-10-31')?.countdownLabel).toBe('today');
    expect(birthdayCardSummary({ monthDay: '11-01' }, '2026-10-31')?.countdownLabel).toBe('tomorrow');
    expect(birthdayCardSummary({ monthDay: '02-29' }, '2026-02-28')?.countdownLabel).toBe('tomorrow');
  });

  it('validates explicit single-category replacement while preserving untouched multiple memberships', () => {
    const current = [{ personId: 'sample-person-avery', relationshipLabel: 'Daughter' }];
    const initial = personDetailsDraft(current[0], null, ['marriage', 'friends']);
    expect(initial.categoryChanged).toBe(false);
    expect(savePersonDetailsCommand(current, 'sample-person-avery', initial, '2026-10-31')).toMatchObject({
      valid: true,
      details: [{ personId: 'sample-person-avery', relationshipLabel: 'Daughter' }]
    });

    const selected = {
      ...initial,
      categoryIds: ['parenting'] as ('marriage' | 'parenting' | 'friends')[],
      categoryChanged: true
    };
    expect(validatePersonDetailsDraft(selected, '2026-10-31').valid).toBe(true);
    expect(validatePersonDetailsDraft({
      ...selected,
      categoryIds: ['marriage', 'friends']
    }, '2026-10-31')).toMatchObject({
      valid: false,
      errors: { categoryIds: 'Choose one supported category.' }
    });
  });

  it('saves, clears, and reloads standard or custom relationships independently of category membership', () => {
    const current = [{ personId: 'sample-person-avery', relationshipLabel: 'Aunt-by-choice' }] as const;
    const draft = personDetailsDraft(current[0], null, ['marriage']);
    expect(draft.relationshipChoice).toBe('custom');
    expect(savePersonDetailsCommand(current, 'sample-person-avery', draft, '2026-10-31')).toMatchObject({
      valid: true,
      details: [{ personId: 'sample-person-avery', relationshipLabel: 'Aunt-by-choice' }]
    });

    const chooseSon = {
      ...draft,
      relationshipChoice: 'Son',
      relationshipLabel: 'Son',
      relationshipChanged: true
    };
    const savedSon = savePersonDetailsCommand(current, 'sample-person-avery', chooseSon, '2026-10-31');
    expect(savedSon).toMatchObject({
      valid: true,
      details: [{ personId: 'sample-person-avery', relationshipLabel: 'Son' }]
    });

    const custom = {
      ...draft,
      relationshipLabel: 'Aunt-by-choice',
      relationshipChanged: true
    };
    const savedCustom = savePersonDetailsCommand(current, 'sample-person-avery', custom, '2026-10-31');
    expect(savedCustom).toMatchObject({
      valid: true,
      details: [{ personId: 'sample-person-avery', relationshipLabel: 'Aunt-by-choice' }]
    });

    const editedCustom = {
      ...draft,
      relationshipLabel: 'Godmother',
      relationshipChanged: true
    };
    expect(savePersonDetailsCommand(current, 'sample-person-avery', editedCustom, '2026-10-31'))
      .toMatchObject({
        valid: true,
        details: [{ personId: 'sample-person-avery', relationshipLabel: 'Godmother' }]
      });

    const clear = { ...draft, relationshipChoice: 'not-set', relationshipChanged: true };
    expect(savePersonDetailsCommand(current, 'sample-person-avery', clear, '2026-10-31'))
      .toEqual({ valid: true, details: [] });
    expect(validatePersonDetailsDraft({
      ...draft,
      relationshipChoice: 'custom',
      relationshipLabel: '',
      relationshipChanged: true
    }, '2026-10-31')).toMatchObject({
      valid: false,
      errors: { relationshipLabel: 'Enter a custom relationship or choose an established option.' }
    });
  });

  it('validates and saves a yearless month/day directly without inventing a year', () => {
    const draft = personDetailsDraft();
    expect(validatePersonDetailsDraft({
      ...draft,
      birthdayDate: '02-29',
      birthdayYearUnknown: true,
      anniversaryDate: '12-02',
      anniversaryYearUnknown: true
    }, '2026-10-31')).toMatchObject({
      valid: true,
      details: {
        birthday: { monthDay: '02-29' },
        anniversary: { monthDay: '12-02' }
      }
    });
    expect(validatePersonDetailsDraft({
      ...draft,
      birthdayDate: '02-30',
      birthdayYearUnknown: true
    }, '2026-10-31')).toMatchObject({
      valid: false,
      errors: { birthdayDate: 'Choose a valid month and day.' }
    });
  });

  it('round-trips optional details in schema v31 and rejects unresolved or malformed records', () => {
    const data = createSamplePreviewData();
    data.personDetails = [{
      personId: 'sample-person-morgan',
      birthday: { monthDay: '02-29' },
      anniversary: { monthDay: '03-15', year: 2010 },
      connectionStyle: 'gf',
      photoDataUrl: 'data:image/jpeg;base64,/9j/2Q=='
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
    malformed.data.personDetails = [{
      personId: 'sample-person-morgan',
      photoDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+'
    }];
    expect(parsePreviewBackup(JSON.stringify(malformed), '2026-10-31')).toMatchObject({
      valid: false,
      message: expect.stringContaining('Person details')
    });
  });
});
