import { createSamplePreviewData } from '../../src/domain/preview-state.ts';
import { rhythmTimeValueFromLabel } from '../../src/domain/rhythm-schedule.ts';
import { prepareDatedRhythmCompletion } from '../../src/domain/rhythm-completion.ts';
import { saveStrengthWorkoutLog } from '../../src/domain/strength.ts';
import type { PreviewData } from '../../src/domain/preview-state.ts';

export function brokenLowerBodyWorkoutData(): PreviewData {
  const date = '2026-10-19';
  const rhythmId = 'user-rhythm-00000000-0000-4000-8000-000000000091';
  const data = createSamplePreviewData();
  const timeOfDay = rhythmTimeValueFromLabel('Anytime');
  if (timeOfDay === undefined) throw new Error('Could not create synthetic Rhythm time fixture.');
  data.savedRhythms = [{
    id: rhythmId,
    title: 'Synthetic Strength Rhythm',
    description: 'Synthetic linked workout fixture',
    cadence: 'Daily',
    timeLabel: 'Anytime',
    timeOfDay,
    personIds: [],
    categoryIds: ['health'],
    schedule: { frequency: 'daily' },
    personal: false,
    createdLocalDate: date,
    createdTimeZone: 'UTC',
    primaryFoundationId: 'health-strength',
    secondaryFoundationIds: [],
    healthLogCapability: 'workout'
  }];
  data.rhythmHistoryIds = [rhythmId];
  data.completedRhythmIds = [];
  data.activeRhythmCompletions = [];
  data.datedRhythmCompletions = [];
  data.strength = {
    ...data.strength,
    workouts: [{
      id: 'synthetic-lower-body',
      date,
      muscleIds: ['hamstrings'],
      workoutName: 'Lower Body',
      notes: 'Keep synthetic workout details.',
      rhythmId,
      rhythmOccurrence: date,
      completionId: 'synthetic-missing-completion'
    }]
  };
  return data;
}

export function repairedAccountWithHistory(currentDate: string): PreviewData {
  const date = '2026-10-19';
  const now = new Date(`${currentDate}T23:59:00.000Z`);
  const timeOfDay = rhythmTimeValueFromLabel('Anytime');
  if (timeOfDay === undefined) throw new Error('Could not create synthetic Rhythm time fixture.');
  const rhythmIds = Array.from({ length: 19 }, (_, index) =>
    `user-rhythm-00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`);
  const rhythms: PreviewData['savedRhythms'] = rhythmIds.map((id, index) => ({
    id,
    title: `Synthetic Strength Rhythm ${index + 1}`,
    description: 'Synthetic linked workout fixture',
    cadence: 'Daily',
    timeLabel: 'Anytime',
    timeOfDay,
    personIds: [],
    categoryIds: ['health'],
    schedule: { frequency: 'daily' },
    personal: false,
    createdLocalDate: date,
    createdTimeZone: 'UTC',
    primaryFoundationId: 'health-strength',
    secondaryFoundationIds: [],
    healthLogCapability: 'workout'
  }));
  const completions = Array.from({ length: 92 }, (_, index) => {
    const effectiveDate = index === 0
      ? date
      : new Date(Date.UTC(2026, 7, index)).toISOString().slice(0, 10);
    const completion = prepareDatedRhythmCompletion({
      id: `synthetic-restore-completion-${String(index + 1).padStart(3, '0')}`,
      rhythmId: rhythmIds[index % rhythmIds.length]!,
      effectiveDate,
      hour: 10,
      minute: index % 60,
      period: 'AM',
      timeZone: 'UTC',
      memory: `Synthetic recovery history ${index + 1}`
    }, now);
    if (!completion.valid) throw new Error('Could not create synthetic Rhythm completion history.');
    return completion.record;
  });
  let workouts: PreviewData['strength']['workouts'] = [];
  for (let index = 0; index < 7; index += 1) {
    const workout = index === 0
      ? saveStrengthWorkoutLog(workouts, {
        id: 'synthetic-repaired-lower-body',
        date,
        muscleIds: ['hamstrings'],
        workoutName: 'Lower Body',
        notes: 'Synthetic repaired workout.',
        rhythmId: rhythmIds[0]!,
        rhythmOccurrence: date,
        completionId: completions[0]!.id
      })
      : saveStrengthWorkoutLog(workouts, {
        id: `synthetic-other-workout-${index}`,
        date: `2026-10-${String(19 + index).padStart(2, '0')}`,
        muscleIds: ['hamstrings'],
        workoutName: `Synthetic workout ${index + 1}`
      });
    if (!workout.valid) throw new Error('Could not create synthetic workout history.');
    workouts = workout.workouts;
  }

  const data = createSamplePreviewData();
  data.savedRhythms = rhythms;
  data.rhythmHistoryIds = rhythmIds;
  data.completedRhythmIds = rhythmIds;
  data.datedRhythmCompletions = completions;
  data.activeRhythmCompletions = rhythms.map((rhythm, index) => ({
    rhythmId: rhythm.id,
    completionId: completions[index]!.id
  }));
  data.rhythmCompletionOverrides = [];
  data.removedSeedCompletionIds = [];
  data.archivedRhythmIds = [];
  data.strength = { ...data.strength, workouts };
  return data;
}
