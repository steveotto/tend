import { describe, expect, it } from 'vitest';
import {
  selectActiveUserRhythms,
  selectArchivedUserRhythms
} from '../src/domain/active-user-rhythms.ts';
import { marriageRhythms, type RhythmPreview } from '../src/domain/preview-data.ts';

describe('active user Rhythm selector', () => {
  it('excludes illustrative candidates and identifies saved Rhythms by stable ID, not title', () => {
    const illustrative = marriageRhythms.find(rhythm => rhythm.id === 'sample-marriage-connection')!;
    const added = {
      ...illustrative,
      id: 'user-rhythm-00000000-0000-4000-8000-000000000001'
    };

    expect(added.title).toBe(illustrative.title);
    expect(selectActiveUserRhythms(
      [illustrative, added],
      [added.id],
      []
    )).toEqual([added]);
  });

  it('retains a saved sample-backed override while excluding its unowned siblings', () => {
    const savedOverride: RhythmPreview = {
      ...marriageRhythms[0]!,
      title: 'My saved connection',
      categoryIds: ['marriage']
    };

    expect(selectActiveUserRhythms(
      [savedOverride, ...marriageRhythms.slice(1)],
      [savedOverride.id],
      []
    )).toEqual([savedOverride]);
  });

  it('excludes archived records and prevents one identity from entering twice through source composition', () => {
    const candidate = {
      ...marriageRhythms[0]!,
      id: 'user-rhythm-00000000-0000-4000-8000-000000000001'
    };

    expect(selectActiveUserRhythms(
      [candidate, { ...candidate }],
      [candidate.id],
      [candidate.id]
    )).toEqual([]);
    expect(selectActiveUserRhythms(
      [candidate, { ...candidate }],
      [candidate.id],
      []
    )).toEqual([candidate]);
    expect(selectArchivedUserRhythms(
      [candidate, { ...candidate }],
      [candidate.id],
      [candidate.id]
    )).toEqual([candidate]);
  });
});
