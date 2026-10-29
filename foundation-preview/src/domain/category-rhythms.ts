import type { RhythmPreview } from './preview-data.ts';
import { areas } from './preview-data.ts';
import { effectiveRhythmSchedule } from './rhythm-schedule.ts';
import type { RhythmSchedule } from './rhythm-schedule.ts';
import { selectNextScheduledOccurrence } from './rhythm-occurrences.ts';

export type CategoryRhythmGroupId = 'daily' | 'weekly' | 'seasonal' | 'custom';

const legacyMarriageSuggestionRhythmIds: Readonly<Record<string, string>> = {
  'marriage.daily-connection': 'user-rhythm-00000000-0000-4000-8000-000000000001',
  'marriage.date-night': 'user-rhythm-00000000-0000-4000-8000-000000000002',
  'marriage.pray-together': 'user-rhythm-00000000-0000-4000-8000-000000000003',
  'marriage.dream-together': 'user-rhythm-00000000-0000-4000-8000-000000000004',
  'marriage.marriage-check-in': 'user-rhythm-00000000-0000-4000-8000-000000000005',
  'marriage.thoughtful-act-of-love': 'user-rhythm-00000000-0000-4000-8000-000000000006',
  'marriage.overnight-away': 'user-rhythm-00000000-0000-4000-8000-000000000007',
  'marriage.marriage-enrichment': 'user-rhythm-00000000-0000-4000-8000-000000000008',
  'marriage.week-away-together': 'user-rhythm-00000000-0000-4000-8000-000000000009'
};

export function activeIdForMarriageSuggestion(templateId: string): string | undefined {
  return legacyMarriageSuggestionRhythmIds[templateId];
}

const legacySuggestionSourceByRhythmId = new Map(
  Object.entries(legacyMarriageSuggestionRhythmIds).map(([sourceId, rhythmId]) => [rhythmId, sourceId])
);
const knownCategoryIds = new Set<string>(areas.map(area => area.id));

export function legacySuggestionSourceForRhythmId(rhythmId: string): string | undefined {
  return legacySuggestionSourceByRhythmId.get(rhythmId);
}

export function isValidSuggestionSourceId(sourceId: unknown): sourceId is string {
  if (typeof sourceId !== 'string') return false;
  const separator = sourceId.indexOf('.');
  if (separator <= 0 || separator === sourceId.length - 1) return false;
  const categoryId = sourceId.slice(0, separator);
  const templateId = sourceId.slice(separator + 1);
  return knownCategoryIds.has(categoryId) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(templateId);
}

export function rhythmsForSuggestionSource(
  rhythms: readonly RhythmPreview[],
  sourceId: string
): RhythmPreview[] {
  return rhythms.filter(rhythm => rhythm.suggestionSourceId === sourceId);
}

export function categoryRhythmGroup(
  rhythm: Pick<RhythmPreview, 'schedule' | 'cadence'>
): CategoryRhythmGroupId | null {
  const schedule = effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
  if (schedule) return groupForSchedule(schedule);
  if (rhythm.cadence === 'Weekly' || rhythm.cadence === '3 times a week'
    || rhythm.cadence === '5 times a week') return 'weekly';
  if (rhythm.cadence === 'Quarterly') return 'seasonal';
  return null;
}

function groupForSchedule(schedule: RhythmSchedule): CategoryRhythmGroupId {
  if (schedule.frequency === 'daily') return 'daily';
  if (schedule.frequency === 'weekly') return 'weekly';
  if (schedule.frequency === 'monthly' || schedule.frequency === 'quarterly'
    || schedule.frequency === 'yearly') return 'seasonal';
  return 'custom';
}

export function isRhythmRelevantOnDate(
  rhythm: Pick<RhythmPreview, 'schedule' | 'cadence' | 'scoring' | 'createdLocalDate'>,
  asOfDate: string
): boolean {
  const schedule = effectiveRhythmSchedule(rhythm.schedule, rhythm.cadence);
  if (!schedule) return false;
  const next = selectNextScheduledOccurrence({
    schedule,
    ...(rhythm.scoring ? { scoring: rhythm.scoring } : {}),
    ...(rhythm.createdLocalDate ? { trackingStartDate: rhythm.createdLocalDate } : {}),
    asOfDate
  });
  return next.kind === 'found' && next.date === asOfDate;
}
