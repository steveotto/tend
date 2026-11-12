import { describe, expect, it } from 'vitest';
import { marriageRhythms, todayRhythms, type RhythmPreview } from '../src/domain/preview-data.ts';
import {
  foundationRhythmIds,
  foundationRhythmRole,
  saveFoundationRhythmAssociations
} from '../src/domain/foundation-rhythm-associations.ts';
import {
  validateSavedRhythmsV12,
  validateSavedRhythmsV13
} from '../src/domain/rhythm-editor.ts';
import {
  createPreviewEnvelope,
  createSamplePreviewData,
  parsePreviewBackup
} from '../src/domain/preview-state.ts';
import { rhythmTimeOptions } from '../src/domain/rhythm-schedule.ts';

function changesFor(
  rhythms: readonly RhythmPreview[],
  targetId: string,
  role: 'none' | 'primary' | 'supporting',
  foundationId: string
) {
  return rhythms.map(rhythm => ({
    rhythmId: rhythm.id,
    role: rhythm.id === targetId ? role : foundationRhythmRole(rhythm, foundationId)
  }));
}

describe('Marriage Foundation Rhythm associations', () => {
  it('preserves malformed and duplicate association references for review', () => {
    expect(foundationRhythmIds({
      primaryFoundationId: '',
      secondaryFoundationIds: ['connection', 'connection']
    })).toEqual(['', 'connection', 'connection']);
  });

  it('updates roles by stable Rhythm ID and round-trips the association in schema 13', () => {
    const rhythm = marriageRhythms.find(item => item.id === 'sample-marriage-prayer')!;
    const result = saveFoundationRhythmAssociations(
      [],
      marriageRhythms,
      [],
      'communication',
      changesFor(marriageRhythms, rhythm.id, 'supporting', 'communication')
    );
    expect('error' in result).toBe(false);
    if ('error' in result) return;

    const saved = result.savedRhythms.find(item => item.id === rhythm.id)!;
    expect(saved).toMatchObject({
      title: rhythm.title,
      primaryFoundationId: rhythm.primaryFoundationId,
      secondaryFoundationIds: [...(rhythm.secondaryFoundationIds ?? []), 'communication']
    });

    const today = todayRhythms[0]!;
    const timeOfDay = rhythmTimeOptions.find(option => option.label === today.timeLabel)!.value;
    const v12Shape = [{
      id: today.id,
      title: today.title,
      cadence: today.cadence!,
      timeLabel: today.timeLabel!,
      timeOfDay,
      personIds: [],
      categoryIds: []
    }];
    expect(validateSavedRhythmsV12(v12Shape)).toBe(true);
    expect(validateSavedRhythmsV12([{
      ...v12Shape[0]!,
      primaryFoundationId: 'connection'
    }])).toBe(false);
    expect(validateSavedRhythmsV13([{
      ...v12Shape[0]!,
      primaryFoundationId: 'connection',
      secondaryFoundationIds: []
    }])).toBe(true);

    const envelope = createPreviewEnvelope({
      ...createSamplePreviewData(),
      savedRhythms: result.savedRhythms
    });
    const imported = parsePreviewBackup(JSON.stringify(envelope), '2026-10-21');
    expect(imported.valid).toBe(true);
    if (!imported.valid) return;
    expect(imported.envelope.schemaVersion).toBe(13);
    expect(imported.envelope.data.savedRhythms.find(item => item.id === rhythm.id)).toMatchObject({
      primaryFoundationId: rhythm.primaryFoundationId,
      secondaryFoundationIds: [...(rhythm.secondaryFoundationIds ?? []), 'communication']
    });
  });

  it('rejects duplicate or unavailable Rhythm changes without changing input data', () => {
    const original = marriageRhythms[0]!;
    const before = JSON.stringify(original);
    expect(saveFoundationRhythmAssociations(
      [],
      marriageRhythms,
      [],
      'connection',
      [
        { rhythmId: original.id, role: 'primary' },
        { rhythmId: original.id, role: 'supporting' }
      ]
    )).toEqual({ error: 'A Rhythm can only have one association choice.' });
    expect(saveFoundationRhythmAssociations(
      [],
      marriageRhythms,
      [],
      'connection',
      [{ rhythmId: 'missing-rhythm', role: 'supporting' }]
    )).toEqual({ error: 'A selected Rhythm is no longer available.' });
    expect(JSON.stringify(original)).toBe(before);
  });

  it('keeps archived selections unchanged and blocks attempts to edit them', () => {
    const rhythm = marriageRhythms[0]!;
    const currentRole = foundationRhythmRole(rhythm, 'connection');
    const unchanged = saveFoundationRhythmAssociations(
      [],
      [rhythm],
      [rhythm.id],
      'connection',
      [{ rhythmId: rhythm.id, role: currentRole }]
    );
    expect(unchanged).toEqual({ savedRhythms: [] });

    const changedRole = currentRole === 'none' ? 'supporting' : 'none';
    expect(saveFoundationRhythmAssociations(
      [],
      [rhythm],
      [rhythm.id],
      'connection',
      [{ rhythmId: rhythm.id, role: changedRole }]
    )).toEqual({ error: 'Restore this Rhythm before changing its Foundation associations.' });
  });

  it('rejects unknown Foundation references rather than silently dropping them', () => {
    const data = createSamplePreviewData();
    data.savedRhythms = [{
      id: marriageRhythms[0]!.id,
      title: marriageRhythms[0]!.title,
      cadence: marriageRhythms[0]!.cadence!,
      timeLabel: marriageRhythms[0]!.timeLabel as 'Morning',
      personIds: [],
      categoryIds: [],
      primaryFoundationId: 'deleted-foundation'
    }];
    const envelope = createPreviewEnvelope(data);

    expect(parsePreviewBackup(JSON.stringify(envelope), '2026-10-21')).toMatchObject({
      valid: false,
      kind: 'invalid'
    });
  });
});
