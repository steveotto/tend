import { isRhythmRelevantOnDate } from './category-rhythms.ts';
import { effectiveRhythmSchedule } from './rhythm-schedule.ts';
import type { RhythmPreview } from './preview-data.ts';
import type { PersonId } from './preview-data.ts';

export function selectPersonRhythmsDueToday(
  rhythms: readonly RhythmPreview[],
  personId: PersonId,
  date: string
): RhythmPreview[] {
  return rhythms.filter(rhythm => {
    if (!rhythm.personIds?.includes(personId)) return false;
    if (effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence)) {
      return isRhythmRelevantOnDate(rhythm, date);
    }
    return rhythm.status === 'Due today';
  });
}
