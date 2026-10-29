import { describe, expect, it } from 'vitest';
import {
  foundationCatalogue,
  faithPractices,
  marriageRhythms,
  parentingFoundations,
  todayRhythms,
  type RhythmPreview
} from '../src/domain/preview-data.ts';
import {
  foundationOwnershipError,
  foundationRhythmIds,
  isRhythmLinkedToFoundation,
  removeFoundationLinksForCategory,
  saveFoundationRhythmAssociations
} from '../src/domain/foundation-rhythm-associations.ts';
import {
  applySavedRhythmOverrides,
  rhythmDraftFrom,
  saveRhythmDraft,
  type SavedRhythm,
  validateSavedRhythmsV12,
  validateSavedRhythmsV13
} from '../src/domain/rhythm-editor.ts';
import { rhythmTimeOptions } from '../src/domain/rhythm-schedule.ts';
import { PREVIEW_SCHEMA_VERSION } from '../src/domain/preview-state.ts';
import { createPreviewEnvelope, createSamplePreviewData, parsePreviewBackup } from '../src/domain/preview-state.ts';

function savedRhythmFor(rhythm: RhythmPreview): SavedRhythm {
  const timeLabel = rhythmTimeOptions.find(option => option.label === rhythm.timeLabel)!.label;
  return {
    id: rhythm.id,
    title: rhythm.title,
    ...(rhythm.description === undefined ? {} : { description: rhythm.description }),
    cadence: rhythm.cadence ?? 'Daily',
    timeLabel,
    personIds: [...(rhythm.personIds ?? [])],
    categoryIds: [...(rhythm.categoryIds ?? [])],
    ...(rhythm.primaryFoundationId === undefined ? {} : { primaryFoundationId: rhythm.primaryFoundationId }),
    ...(rhythm.secondaryFoundationIds === undefined
      ? {}
      : { secondaryFoundationIds: [...rhythm.secondaryFoundationIds] })
  };
}

describe('Marriage Foundation Rhythm associations', () => {
  it('uses stable Faith Practice ownership and preserves a shared Rhythm across Category removal and backup', () => {
    const rhythmId = 'user-rhythm-123e4567-e89b-42d3-a456-426614174099';
    const faithPractice = faithPractices[1]!;
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      id: rhythmId,
      title: 'Pray together',
      categoryIds: ['faith', 'marriage'],
      primaryFoundationId: faithPractice.id,
      secondaryFoundationIds: ['spiritual-growth']
    };
    const saved = savedRhythmFor(rhythm);

    expect(faithPractices.map(item => item.id)).toEqual([
      'faith-sabbath',
      'faith-prayer',
      'faith-fasting',
      'faith-solitude',
      'faith-generosity',
      'faith-community',
      'faith-service',
      'faith-witness',
      'faith-scripture'
    ]);
    expect(faithPractice.categoryId).toBe('faith');
    expect(foundationOwnershipError(['faith', 'marriage'], [
      faithPractice.id,
      'spiritual-growth'
    ])).toBeUndefined();
    expect(foundationOwnershipError(['marriage'], [faithPractice.id]))
      .toContain('Assign the Faith category');

    const removedFaith = removeFoundationLinksForCategory(rhythm, 'faith');
    expect(removedFaith).toEqual({
      primaryFoundationId: 'spiritual-growth',
      secondaryFoundationIds: [],
      removedIds: [faithPractice.id]
    });
    const removedMarriage = removeFoundationLinksForCategory(rhythm, 'marriage');
    expect(removedMarriage).toEqual({
      primaryFoundationId: faithPractice.id,
      secondaryFoundationIds: [],
      removedIds: ['spiritual-growth']
    });

    const linked = saveFoundationRhythmAssociations(
      [saved],
      [rhythm],
      [],
      faithPractices[8]!.id,
      [{ rhythmId, linked: true }]
    );
    expect('error' in linked).toBe(false);
    if ('error' in linked) return;
    expect(linked.savedRhythms).toMatchObject([{
      id: rhythmId,
      categoryIds: ['faith', 'marriage'],
      primaryFoundationId: faithPractice.id,
      secondaryFoundationIds: ['spiritual-growth', faithPractices[8]!.id]
    }]);

    const imported = parsePreviewBackup(JSON.stringify(createPreviewEnvelope({
      ...createSamplePreviewData(),
      savedRhythms: linked.savedRhythms
    })), '2026-10-27');
    expect(imported.valid).toBe(true);
    if (!imported.valid) return;
    expect(imported.envelope.data.savedRhythms).toMatchObject([{
      id: rhythmId,
      categoryIds: ['faith', 'marriage'],
      primaryFoundationId: faithPractice.id,
      secondaryFoundationIds: ['spiritual-growth', faithPractices[8]!.id]
    }]);
  });

  it('uses stable Parenting Category IDs for Foundation ownership and Category cleanup', () => {
    const parentingFoundation = parentingFoundations[0]!;
    expect(parentingFoundation.name).toBe('Connection & Belonging');
    expect(parentingFoundation.categoryId).toBe('parenting');
    expect(foundationOwnershipError(['parenting'], [parentingFoundation.id])).toBeUndefined();
    expect(foundationOwnershipError(['marriage'], [parentingFoundation.id])).toContain('Parenting category');

    const links = removeFoundationLinksForCategory({
      primaryFoundationId: parentingFoundation.id,
      secondaryFoundationIds: ['connection']
    }, 'parenting');
    expect(links).toEqual({
      primaryFoundationId: 'connection',
      secondaryFoundationIds: [],
      removedIds: [parentingFoundation.id]
    });
  });

  it('removes Parenting links when Parenting is removed while preserving Marriage links and Rhythm identity', () => {
    const rhythmId = 'user-rhythm-123e4567-e89b-42d3-a456-426614174001';
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      id: rhythmId,
      categoryIds: ['parenting', 'marriage'],
      primaryFoundationId: parentingFoundations[0]!.id,
      secondaryFoundationIds: ['connection']
    };
    const saved = savedRhythmFor(rhythm);
      const remainingLinks = removeFoundationLinksForCategory(rhythm, 'parenting');
      const result = saveRhythmDraft(
        [saved],
        {
          ...rhythmDraftFrom(rhythm, ['parenting', 'marriage']),
          categoryIds: ['marriage'],
          primaryFoundationId: remainingLinks.primaryFoundationId,
          secondaryFoundationIds: remainingLinks.secondaryFoundationIds
        },
      rhythmId,
      'edit'
    );

    expect(result.errors).toEqual({});
    expect(result.savedRhythms).toMatchObject([{
      id: rhythmId,
      categoryIds: ['marriage'],
      primaryFoundationId: 'connection',
      secondaryFoundationIds: []
    }]);
  });

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
    expect(validateSavedRhythmsV13([{
      ...v12Record,
      categoryIds: ['finances'],
      primaryFoundationId: 'finance-example-milestone',
      secondaryFoundationIds: []
    }])).toBe(true);
    expect(validateSavedRhythmsV13([{
      ...v12Record,
      categoryIds: [],
      primaryFoundationId: 'connection',
      secondaryFoundationIds: []
    }])).toBe(true);
  });

  it('saves and reloads explicit Category cleanup without changing Rhythm identity or other preview data', () => {
    const rhythmId = 'user-rhythm-123e4567-e89b-42d3-a456-426614174000';
    const originalRhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      id: rhythmId,
      categoryIds: ['marriage'],
      primaryFoundationId: 'connection',
      secondaryFoundationIds: ['communication']
    };
    const originalDraft = rhythmDraftFrom(originalRhythm, ['marriage']);
    const existing = savedRhythmFor(originalRhythm);
    const previewData = createSamplePreviewData();
    previewData.savedRhythms = [existing];
    previewData.completedRhythmIds = [rhythmId];
    previewData.rhythmHistoryIds = [rhythmId];

    const result = saveRhythmDraft([existing], {
      ...originalDraft,
      categoryIds: [],
      primaryFoundationId: null,
      secondaryFoundationIds: []
    }, rhythmId, 'edit');
    expect(result.errors).toEqual({});
    expect(result.savedRhythms).toBeDefined();
    if (!result.savedRhythms) return;

    const envelope = createPreviewEnvelope({
      ...previewData,
      savedRhythms: result.savedRhythms
    });
    const reloaded = parsePreviewBackup(JSON.stringify(envelope), '2026-10-21');
    expect(reloaded.valid).toBe(true);
    if (!reloaded.valid) return;
    expect(reloaded.envelope.data.savedRhythms).toMatchObject([{
      id: rhythmId,
      categoryIds: [],
      personIds: originalRhythm.personIds,
      primaryFoundationId: null,
      secondaryFoundationIds: []
    }]);
    expect(reloaded.envelope.data.completedRhythmIds).toEqual([rhythmId]);
    expect(reloaded.envelope.data.rhythmHistoryIds).toEqual([rhythmId]);
  });

  it('adds and removes a link by stable Rhythm identity without changing other relationships', () => {
    const rhythm = marriageRhythms.find(item => item.id === 'sample-marriage-prayer')!;
    const added = saveFoundationRhythmAssociations(
      [savedRhythmFor(rhythm)],
      [rhythm],
      [],
      'communication',
      [{ rhythmId: rhythm.id, linked: true }]
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

  it('uses catalogue ownership for direct link management and rejects orphan results', () => {
    const financeRhythm: RhythmPreview = {
      ...marriageRhythms[0]!,
      categoryIds: ['finances'],
      primaryFoundationId: null,
      secondaryFoundationIds: []
    };
    const financeSaved = savedRhythmFor(financeRhythm);
    const linkedFinance = saveFoundationRhythmAssociations(
      [financeSaved],
      [financeRhythm],
      [],
      'finance-example-milestone',
      [{ rhythmId: financeRhythm.id, linked: true }]
    );
    expect('error' in linkedFinance).toBe(false);
    if ('error' in linkedFinance) return;
    expect(linkedFinance.savedRhythms[0]).toMatchObject({
      categoryIds: ['finances'],
      primaryFoundationId: 'finance-example-milestone'
    });

    const orphanRhythm: RhythmPreview = {
      ...marriageRhythms[0]!,
      categoryIds: [],
      primaryFoundationId: 'connection',
      secondaryFoundationIds: ['communication']
    };
    expect(saveFoundationRhythmAssociations(
      [savedRhythmFor(orphanRhythm)],
      [orphanRhythm],
      [],
      'communication',
      [{ rhythmId: orphanRhythm.id, linked: false }]
    )).toMatchObject({
      error: 'Assign the Marriage category or unlink these Foundation links: Connection.'
    });

    const removedOrphan = saveFoundationRhythmAssociations(
      [savedRhythmFor({ ...orphanRhythm, secondaryFoundationIds: [] })],
      [{ ...orphanRhythm, secondaryFoundationIds: [] }],
      [],
      'connection',
      [{ rhythmId: orphanRhythm.id, linked: false }]
    );
    expect('error' in removedOrphan).toBe(false);
    if ('error' in removedOrphan) return;
    expect(removedOrphan.savedRhythms[0]).toMatchObject({
      primaryFoundationId: null,
      secondaryFoundationIds: []
    });
  });

  it('removes only links owned by the removed Category and retains unresolved references', () => {
    const result = removeFoundationLinksForCategory({
      primaryFoundationId: 'connection',
      secondaryFoundationIds: [
        'communication',
        'finance-example-milestone',
        'unresolved-fixture',
        'connection'
      ]
    }, 'marriage', foundationCatalogue);

    expect(result).toEqual({
      primaryFoundationId: 'finance-example-milestone',
      secondaryFoundationIds: ['unresolved-fixture'],
      removedIds: ['connection', 'communication']
    });
    expect(foundationOwnershipError(['finances'], ['finance-example-milestone'])).toBeUndefined();
    expect(foundationOwnershipError([], ['unresolved-fixture']))
      .toBe('Remove or resolve unavailable Foundation links before saving: unresolved-fixture.');
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
      [savedRhythmFor(rhythm)],
      [rhythm],
      [rhythm.id],
      'connection',
      [{ rhythmId: rhythm.id, linked: true }]
    );
    expect(unchanged).toEqual({ savedRhythms: [savedRhythmFor(rhythm)] });

    expect(saveFoundationRhythmAssociations(
      [savedRhythmFor(rhythm)],
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
    previewData.savedRhythms = [savedRhythmFor(renamedRhythm)];
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
    expect(imported.envelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
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
      [savedRhythmFor(rhythm)],
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
      [savedRhythmFor(rhythm)],
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

  it('does not turn an unadded illustrative fixture into a saved Rhythm through link management', () => {
    const rhythm = marriageRhythms[0]!;
    expect(saveFoundationRhythmAssociations(
      [],
      [rhythm],
      [],
      'connection',
      [{ rhythmId: rhythm.id, linked: true }]
    )).toEqual({ error: 'A selected Rhythm is no longer available.' });
  });

  it('retains unresolved Foundation references for explicit editor repair', () => {
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

    const parsed = parsePreviewBackup(JSON.stringify(envelope), '2026-10-21');
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.envelope.data.savedRhythms).toMatchObject([{
      id: 'sample-marriage-date-night',
      primaryFoundationId: 'deleted-foundation'
    }]);
  });
});
