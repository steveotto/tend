import { parsePreviewBackup, PREVIEW_SCHEMA_VERSION } from './preview-state.ts';
import type { PreviewData } from './preview-state.ts';
import { rhythmTimeValueFromLabel, rhythmTimeValueFromLegacyLabel } from './rhythm-schedule.ts';
import type { RhythmTimeLabel, RhythmTimeValue, RhythmSchedule } from './rhythm-schedule.ts';
import type { SavedRhythm } from './rhythm-editor.ts';

export const PROPOSED_PREVIEW_SCHEMA_VERSION = PREVIEW_SCHEMA_VERSION;

export type ProposedSavedRhythmV4 = Omit<SavedRhythm, 'cadence' | 'timeLabel'> & {
  cadence: string;
  timeLabel: RhythmTimeLabel;
  timeOfDay: RhythmTimeValue;
  schedule?: RhythmSchedule;
  personal?: boolean;
};

export type ProposedPreviewDataV4 = Omit<PreviewData, 'savedRhythms'> & {
  savedRhythms: ProposedSavedRhythmV4[];
};

export type ProposedPreviewEnvelopeV4 = {
  format: 'tend.synthetic-preview';
  schemaVersion: typeof PROPOSED_PREVIEW_SCHEMA_VERSION;
  data: ProposedPreviewDataV4;
};

export type PreviewV4MigrationResult =
  | {
      valid: true;
      envelope: ProposedPreviewEnvelopeV4;
      sourceSchemaVersion: 1 | 2 | 3 | 4;
    }
  | { valid: false; kind: 'invalid' | 'unsupported'; message: string };

export function migratePreviewToProposedV4(raw: string, currentDate: string): PreviewV4MigrationResult {
  const parsed = parsePreviewBackup(raw, currentDate);
  if (!parsed.valid) return parsed;
  if (parsed.sourceSchemaVersion === 4) {
    const savedRhythms: ProposedSavedRhythmV4[] = [];
    for (const rhythm of parsed.envelope.data.savedRhythms) {
      const timeOfDay = rhythm.timeOfDay ?? rhythmTimeValueFromLabel(rhythm.timeLabel);
      if (!timeOfDay) {
        return { valid: false, kind: 'invalid', message: `No v4 time value is mapped for "${rhythm.timeLabel}".` };
      }
      savedRhythms.push({ ...rhythm, timeOfDay });
    }
    return {
      valid: true,
      envelope: { ...parsed.envelope, data: { ...parsed.envelope.data, savedRhythms } },
      sourceSchemaVersion: 4
    };
  }

  const savedRhythms: ProposedSavedRhythmV4[] = [];
  for (const rhythm of parsed.envelope.data.savedRhythms) {
    const timeOfDay = rhythmTimeValueFromLegacyLabel(rhythm.timeLabel);
    if (!timeOfDay) {
      return {
        valid: false,
        kind: 'invalid',
        message: `The existing time value "${rhythm.timeLabel}" has no supported v4 mapping.`
      };
    }
    savedRhythms.push({ ...rhythm, timeOfDay });
  }

  return {
    valid: true,
    sourceSchemaVersion: parsed.sourceSchemaVersion,
    envelope: {
      format: parsed.envelope.format,
      schemaVersion: PROPOSED_PREVIEW_SCHEMA_VERSION,
      data: {
        goals: parsed.envelope.data.goals,
        completedRhythmIds: parsed.envelope.data.completedRhythmIds,
        savedRhythms,
        archivedRhythmIds: parsed.envelope.data.archivedRhythmIds
      }
    }
  };
}
