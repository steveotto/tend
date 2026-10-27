import { describe, expect, it } from 'vitest';
import {
  marriageRhythms,
  type RhythmPreview
} from '../src/domain/preview-data.ts';
import {
  foundationRhythmIds,
  isRhythmLinkedToFoundation,
  saveFoundationRhythmAssociations
} from '../src/domain/foundation-rhythm-associations.ts';
import {
  applySavedRhythmOverrides,
  validateSavedRhythmsV12,
  validateSavedRhythmsV13
} from '../src/domain/rhythm-editor.ts';
import { rhythmTimeOptions } from '../src/domain/rhythm-schedule.ts';
import { createPreviewEnvelope, createSamplePreviewData, parsePreviewBackup } from '../src/domain/preview-state.ts';

function associationChanges(
  rhythms: readonly RhythmPreview[],
  updatedId: string,
  linked: boolean,
  foundationId: string
) {
  return rhythms.map(rhythm => ({
    rhythmId: rhythm.id,
    linked: rhythm.id === updatedId
      ? linked
      : isRhythmLinkedToFoundation(rhythm, foundationId)
  }));
}

describe('Marriage Foundation Rhythm associations', () => {
  it('accepts Marriage fixture overrides only in v13, leaving v12 validation unchanged', () => {
    const rhythm = marriageRhythms[0]!;
    const time = rhythmTimeOptions.find(option => option.label === rhythm.timeLabel)!;
    const v12Record = {
      id: rhythm.id,
      title: rhythm.title,
      cadence: rhythm.cadence!,
      timeLabel: time.label,
      timeOfDay: time.value,
      personIds: [...(rhythm.personIds ?? [])],
      categoryIds: [...(rhythm.categoryIds ?? [])]
    };

    expect(validateSavedRhythmsV12([v12Record])).toBe(false);
    expect(validateSavedRhythmsV13([{
      ...v12Record,
      primaryFoundationId: 'connection',
      secondaryFoundationIds: []
    }])).toBe(true);
  });

  it('adds and removes a link by stable Rhythm identity without changing other relationships', () => {
    const rhythm = marriageRhythms.find(item => item.id === 'sample-marriage-prayer')!;
    const added = saveFoundationRhythmAssociations(
      [],
      marriageRhythms,
      [],
      'communication',
      associationChanges(marriageRhythms, rhythm.id, true, 'communication')
    );
    expect('error' in added).toBe(false);
    if ('error' in added) return;

    const savedRhythm = added.savedRhythms.find(entry => entry.id === rhythm.id)!;
    expect(savedRhythm.primaryFoundationId).toBe('spiritual-growth');
    expect(savedRhythm.secondaryFoundationIds).toEqual(['connection', 'communication']);
    expect(savedRhythm.title).toBe('Pray Together');

    const removed = saveFoundationRhythmAssociations(
      added.savedRhythms,
      [applySavedRhythmOverrides(rhythm, savedRhythm)],
      [],
      'communication',
      [{ rhythmId: rhythm.id, linked: false }]
    );
    expect('error' in removed).toBe(false);
    if ('error' in removed) return;
    expect(removed.savedRhythms[0]).toMatchObject({
      id: rhythm.id,
      primaryFoundationId: 'spiritual-growth',
      secondaryFoundationIds: ['connection']
    });
  });

  it('prevents duplicate changes and refuses missing Rhythm references', () => {
    expect(saveFoundationRhythmAssociations(
      [],
      marriageRhythms,
      [],
      'connection',
      [
        { rhythmId: marriageRhythms[0]!.id, linked: true },
        { rhythmId: marriageRhythms[0]!.id, linked: false }
      ]
    )).toEqual({ error: 'A Rhythm can only have one association choice.' });

    expect(saveFoundationRhythmAssociations(
      [],
      marriageRhythms,
      [],
      'connection',
      [{ rhythmId: 'missing-rhythm', linked: true }]
    )).toEqual({ error: 'A selected Rhythm is no longer available.' });
  });

  it('keeps archived associations unchanged and blocks edits until the Rhythm is restored', () => {
    const rhythm = marriageRhythms[0]!;
    const unchanged = saveFoundationRhythmAssociations(
      [],
      [rhythm],
      [rhythm.id],
      'connection',
      [{ rhythmId: rhythm.id, linked: true }]
    );
    expect(unchanged).toEqual({ savedRhythms: [] });

    expect(saveFoundationRhythmAssociations(
      [],
      [rhythm],
      [rhythm.id],
      'connection',
      [{ rhythmId: rhythm.id, linked: false }]
    )).toEqual({ error: 'Restore this Rhythm before changing its Foundation associations.' });
  });

  it('uses stable IDs after a Rhythm title changes and preserves unrelated preview records', () => {
    const rhythm = marriageRhythms.find(item => item.id === 'sample-marriage-prayer')!;
    const renamedRhythm = { ...rhythm, title: 'Prayer, renamed' };
    const previewData = createSamplePreviewData();
    previewData.completedRhythmIds = ['sample-connect'];
    previewData.datedRhythmCompletions = [{
      id: 'preserved-date-log',
      rhythmId: 'sample-connect',
      effectiveDate: '2026-10-20',
      localTime: '08:00',
      timeZone: 'UTC',
      completedAt: '2026-10-20T08:00:00.000Z',
      recordedAt: '2026-10-20T08:05:00.000Z'
    }];
    previewData.rhythmHistoryIds = ['sample-connect'];

    const result = saveFoundationRhythmAssociations(
      previewData.savedRhythms,
      [renamedRhythm],
      [],
      'communication',
      [{ rhythmId: rhythm.id, linked: true }]
    );
    expect('error' in result).toBe(false);
    if ('error' in result) return;

    previewData.savedRhythms = result.savedRhythms;
    const exported = createPreviewEnvelope(previewData);
    const imported = parsePreviewBackup(JSON.stringify(exported), '2026-10-21');
    expect(imported.valid).toBe(true);
    if (!imported.valid) return;
    expect(imported.envelope.schemaVersion).toBe(13);
    expect(imported.envelope.data.completedRhythmIds).toEqual(['sample-connect']);
    expect(imported.envelope.data.datedRhythmCompletions).toEqual(previewData.datedRhythmCompletions);
    const association = imported.envelope.data.savedRhythms.find(item => item.id === rhythm.id)!;
    expect(association.title).toBe('Prayer, renamed');
    expect(association.primaryFoundationId).toBe('spiritual-growth');
    expect(association.secondaryFoundationIds).toEqual(['connection', 'communication']);

    const resolved = applySavedRhythmOverrides(renamedRhythm, association);
    expect(resolved.title).toBe('Prayer, renamed');
    expect(isRhythmLinkedToFoundation(resolved, 'communication')).toBe(true);
  });

  it('removes a former primary link and promotes the first surviving link deterministically', () => {
    const rhythm = marriageRhythms.find(item => item.id === 'sample-marriage-connection')!;
    const result = saveFoundationRhythmAssociations(
      [],
      [rhythm],
      [],
      'connection',
      [{ rhythmId: rhythm.id, linked: false }]
    );

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.savedRhythms[0]).toMatchObject({
      primaryFoundationId: 'communication',
      secondaryFoundationIds: ['intimacy']
    });
  });

  it('counts duplicate references once and removes the link without losing other links', () => {
    const rhythm = {
      ...marriageRhythms.find(item => item.id === 'sample-marriage-connection')!,
      secondaryFoundationIds: ['communication', 'intimacy', 'connection']
    };
    expect(foundationRhythmIds(rhythm)).toEqual(['connection', 'communication', 'intimacy']);
    expect(isRhythmLinkedToFoundation(rhythm, 'connection')).toBe(true);

    const result = saveFoundationRhythmAssociations(
      [],
      [rhythm],
      [],
      'connection',
      [{ rhythmId: rhythm.id, linked: false }]
    );
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.savedRhythms[0]).toMatchObject({
      primaryFoundationId: 'communication',
      secondaryFoundationIds: ['intimacy']
    });
  });

  it('rejects unknown Foundation references rather than silently dropping them', () => {
    const envelope = createPreviewEnvelope({
      ...createSamplePreviewData(),
      savedRhythms: [{
        id: 'sample-marriage-date-night',
        title: 'Date Night',
        cadence: 'Weekly',
        timeLabel: 'Evening',
        personIds: [],
        categoryIds: [],
        primaryFoundationId: 'deleted-foundation'
      }]
    });

    expect(parsePreviewBackup(JSON.stringify(envelope), '2026-10-21')).toMatchObject({
      valid: false,
      kind: 'invalid'
    });
  });
});
