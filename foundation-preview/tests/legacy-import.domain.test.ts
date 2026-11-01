import { describe, expect, it } from 'vitest';
import { analyzeLegacyTendImport } from '../src/domain/legacy-import.ts';

describe('Classic Tend import dry run', () => {
  it('converts arbitrary People identities, details, and explicit classifications without sample injection', () => {
    const source = JSON.stringify({
      version: 2,
      people: [
        {
          id: 'legacy person/one',
          name: 'Taylor Example',
          relation: 'Custom relationship',
          area: 'marriage',
          birthday: '02-29',
          anniversary: '2021-04-15'
        },
        {
          id: 'legacy-person-two',
          name: 'Taylor Example',
          relation: 'Neighbor',
          area: 'parenting'
        },
        { id: 'legacy-person-three', name: 'Morgan Example', area: 'friendships' }
      ]
    });

    const result = analyzeLegacyTendImport(source, '2026-10-31');
    expect(result.candidate).not.toBeNull();
    expect(result.report.supported).toEqual({ people: 3, details: 2, classifications: 3 });
    expect(result.report.remappedIds).toBe(1);
    expect(result.report.invalid).toEqual([]);
    expect(result.report.ambiguous).toEqual([]);
    expect(result.candidate?.people.map(person => person.displayName))
      .toEqual(['Taylor Example', 'Taylor Example', 'Morgan Example']);
    expect(result.candidate?.people.map(person => person.id)).not.toContain('sample-person-avery');
    expect(result.candidate?.personDetails).toEqual([
      {
        personId: result.candidate?.people[0]?.id,
        relationshipLabel: 'Custom relationship',
        birthday: { monthDay: '02-29' },
        anniversary: { monthDay: '04-15', year: 2021 }
      },
      {
        personId: 'legacy-person-two',
        relationshipLabel: 'Neighbor'
      }
    ]);
    expect(result.candidate?.peopleGroups.map(group => [group.id, group.memberIds]))
      .toEqual([
        ['marriage', [result.candidate?.people[0]?.id]],
        ['parenting', ['legacy-person-two']],
        ['friends', ['legacy-person-three']]
      ]);
    expect(analyzeLegacyTendImport(source, '2026-10-31').candidate?.people[0]?.id)
      .toBe(result.candidate?.people[0]?.id);
  });

  it('keeps unsupported source sections in the recovery package and separates their report', () => {
    const source = JSON.stringify({
      people: [{ id: 'person-one', name: 'Person One', rhythms: [{ id: 'rhythm-one' }] }],
      prayers: [{ id: 'prayer-one', personId: 'person-one', status: 'answered' }],
      events: [{ id: 'connection-one', personIds: ['person-one'] }],
      calendars: [{ id: 'calendar-one' }]
    });
    const result = analyzeLegacyTendImport(source, '2026-10-31');

    expect(result.candidate).not.toBeNull();
    expect(result.report.unsupported).toEqual(expect.arrayContaining([
      { path: '/people/0/rhythms', count: 1 },
      { path: '/prayers', count: 1 },
      { path: '/events', count: 1 },
      { path: '/calendars', count: 1 }
    ]));
    const recovery = JSON.parse(result.recoveryPackage) as { sourceText: string };
    expect(recovery.sourceText).toBe(source);
  });

  it('blocks duplicate IDs and invalid dates rather than guessing or dropping records', () => {
    const duplicateIds = analyzeLegacyTendImport(JSON.stringify({
      people: [
        { id: 'duplicate', name: 'First' },
        { id: 'duplicate', name: 'Second' }
      ]
    }), '2026-10-31');
    expect(duplicateIds.candidate).toBeNull();
    expect(duplicateIds.report.ambiguous).toEqual([{ path: '/people/1/id', count: 1 }]);

    const invalidDate = analyzeLegacyTendImport(JSON.stringify({
      people: [{ id: 'person-one', name: 'Person One', birthday: '2023-02-29' }]
    }), '2026-10-31');
    expect(invalidDate.candidate).toBeNull();
    expect(invalidDate.report.invalid.length).toBeGreaterThan(0);
  });

  it('uses a deterministic collision-safe ID when an invalid source ID maps onto an existing ID', () => {
    const mapped = analyzeLegacyTendImport(JSON.stringify({
      people: [{ id: 'legacy person/one', name: 'Mapped Person' }]
    }), '2026-10-31');
    const mappedId = mapped.candidate?.people[0]?.id;
    expect(mappedId).toBeTruthy();

    const collision = analyzeLegacyTendImport(JSON.stringify({
      people: [
        { id: 'legacy person/one', name: 'Mapped Person' },
        { id: mappedId, name: 'Existing Person' }
      ]
    }), '2026-10-31');
    expect(collision.candidate?.people.map(person => person.id)).toEqual([
      `${mappedId}-2`,
      mappedId
    ]);
  });

  it('rejects a missing People collection and malformed JSON without losing recovery text', () => {
    const missingPeople = analyzeLegacyTendImport('{"events":[]}', '2026-10-31');
    expect(missingPeople.candidate).toBeNull();
    expect(missingPeople.report.invalid).toEqual([{ path: '/people', count: 1 }]);

    const malformed = '{invalid';
    const malformedResult = analyzeLegacyTendImport(malformed, '2026-10-31');
    expect(malformedResult.candidate).toBeNull();
    expect(JSON.parse(malformedResult.recoveryPackage).sourceText).toBe(malformed);
  });
});
