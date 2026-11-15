import { foundationRhythmIds } from './foundation-rhythm-associations.ts';
import { hasRhythmOccurrenceForCompletion } from './rhythm-occurrences.ts';
import { rhythmScheduleForDate } from './rhythm-schedule.ts';
import type { DatedRhythmCompletion } from './rhythm-completion.ts';
import type { RhythmPreview } from './preview-data.ts';
import type { StrengthMode } from './strength.ts';

export type StrengthRhythmSetting = {
  rhythm: RhythmPreview;
  mode: StrengthMode;
  workoutId?: string;
};

export type StrengthWorkoutRhythmOption = {
  rhythm: RhythmPreview;
  eligible: boolean;
  suggested: boolean;
  explicit: boolean;
  reason?: string;
};

export function selectStrengthWorkoutRhythmOptions(
  rhythms: readonly StrengthRhythmSetting[],
  archivedRhythms: readonly RhythmPreview[],
  completions: readonly DatedRhythmCompletion[],
  date: string,
  savedWorkoutId?: string,
  explicitRhythmId?: string
): StrengthWorkoutRhythmOption[] {
  const candidates = [
    ...rhythms.filter(item =>
      foundationRhythmIds(item.rhythm).includes('health-strength')
      || item.rhythm.id === explicitRhythmId
    ),
    ...archivedRhythms
      .filter(rhythm => rhythm.id === explicitRhythmId)
      .map(rhythm => ({ rhythm, mode: 'custom' as const }))
  ];

  return candidates
    .filter(({ rhythm }) => rhythm.healthLogCapability === 'workout'
      && rhythm.categoryIds?.includes('health'))
    .map(candidate => {
      const { rhythm } = candidate;
      const explicit = rhythm.id === explicitRhythmId;
      let reason: string | undefined;
      const schedule = rhythmScheduleForDate(rhythm, date);
      if (archivedRhythms.some(item => item.id === rhythm.id)) {
        reason = 'Restore this Rhythm before linking a workout.';
      } else if (!schedule) {
        reason = 'This Rhythm’s schedule for this date is unavailable.';
      } else if (!hasRhythmOccurrenceForCompletion(schedule, date, rhythm.scoring?.trackingStartDate)) {
        reason = 'This date is not a scheduled occurrence.';
      } else if (completions.some(completion =>
        completion.rhythmId === rhythm.id && completion.effectiveDate === date
      )) {
        reason = 'A completion already exists for this Rhythm on this date.';
      }
      return {
        rhythm,
        eligible: reason === undefined,
        suggested: candidate.mode === 'specific'
          && savedWorkoutId !== undefined
          && candidate.workoutId === savedWorkoutId,
        explicit,
        ...(reason === undefined ? {} : { reason })
      };
    });
}
