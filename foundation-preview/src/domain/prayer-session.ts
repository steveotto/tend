import type { PersonId } from './preview-data.ts';

export type PrayerTimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';
export type PrayerTimeframeId =
  | 'now'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'allday'
  | 'allrequests';

export type PrayerRequestPreview = {
  id: string;
  personId: PersonId;
  sharedWith?: readonly PersonId[];
  title: string;
  details?: string;
  status: 'active' | 'answered' | 'archived';
  timeOfDay: PrayerTimeOfDay;
  prayedCount: number;
  lastPrayedAt?: string;
};

export type PrayerTimeframeOption = {
  id: PrayerTimeframeId;
  label: string;
  timeDescription: string;
  count: number;
  isCurrent?: boolean;
};

export type PrayerSession = {
  requestIds: string[];
  index: number;
  prayedIds: string[];
  ended: boolean;
};

const timeframeDefinitions: readonly Omit<PrayerTimeframeOption, 'count' | 'isCurrent'>[] = [
  { id: 'morning', label: 'Morning', timeDescription: '12:00am - 11:59am' },
  { id: 'afternoon', label: 'Afternoon', timeDescription: '12:00pm - 4:59pm' },
  { id: 'evening', label: 'Evening', timeDescription: '5:00pm - 11:59pm' }
];

export function prayerTimeOfDayLabel(timeOfDay: PrayerTimeOfDay): string {
  switch (timeOfDay) {
    case 'morning': return 'Morning';
    case 'afternoon': return 'Afternoon';
    case 'evening': return 'Evening';
    case 'anytime': return 'Anytime';
  }
}

export function currentPrayerTimeframe(instant: Date, timeZone: string): Exclude<PrayerTimeframeId, 'allday' | 'allrequests'> {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone
  }).format(instant));
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function requestMatchesPeople(request: PrayerRequestPreview, selectedPeople: readonly PersonId[]): boolean {
  return selectedPeople.includes(request.personId)
    || request.sharedWith?.some(personId => selectedPeople.includes(personId)) === true;
}

function requestMatchesTimeframe(
  request: PrayerRequestPreview,
  timeframe: PrayerTimeframeId,
  instant: Date,
  timeZone: string
): boolean {
  if (timeframe === 'allday' || timeframe === 'allrequests') return true;
  const selectedTimeframe = timeframe === 'now' ? currentPrayerTimeframe(instant, timeZone) : timeframe;
  return request.timeOfDay === 'anytime' || request.timeOfDay === selectedTimeframe;
}

export function selectActivePrayerRequests(
  requests: readonly PrayerRequestPreview[],
  selectedPeople: readonly PersonId[],
  timeframe: PrayerTimeframeId,
  instant: Date,
  timeZone: string
): PrayerRequestPreview[] {
  return requests.filter(request =>
    request.status === 'active'
    && requestMatchesPeople(request, selectedPeople)
    && requestMatchesTimeframe(request, timeframe, instant, timeZone)
  );
}

export function prayerTimeframeOptions(
  requests: readonly PrayerRequestPreview[],
  selectedPeople: readonly PersonId[],
  instant: Date,
  timeZone: string
): PrayerTimeframeOption[] {
  const nowBlock = currentPrayerTimeframe(instant, timeZone);
  const options: PrayerTimeframeOption[] = [{
    id: 'now',
    label: 'Now',
    timeDescription: timeframeDefinitions.find(option => option.id === nowBlock)?.timeDescription ?? '',
    count: selectActivePrayerRequests(requests, selectedPeople, 'now', instant, timeZone).length,
    isCurrent: true
  }];
  for (const definition of timeframeDefinitions) {
    options.push({
      ...definition,
      count: selectActivePrayerRequests(requests, selectedPeople, definition.id, instant, timeZone).length,
      isCurrent: definition.id === nowBlock
    });
  }
  options.push({
    id: 'allday',
    label: 'All Day',
    timeDescription: 'Any time today',
    count: selectActivePrayerRequests(requests, selectedPeople, 'allday', instant, timeZone).length
  });
  options.push({
    id: 'allrequests',
    label: 'All requests',
    timeDescription: 'Any active request, regardless of schedule',
    count: selectActivePrayerRequests(requests, selectedPeople, 'allrequests', instant, timeZone).length
  });
  return options;
}

export function createPrayerSession(requests: readonly PrayerRequestPreview[]): PrayerSession | null {
  if (requests.length === 0) return null;
  return { requestIds: requests.map(request => request.id), index: 0, prayedIds: [], ended: false };
}

export function movePrayerSession(session: PrayerSession, direction: -1 | 1): PrayerSession {
  if (session.ended || session.requestIds.length === 0) return session;
  return {
    ...session,
    index: Math.max(0, Math.min(session.requestIds.length - 1, session.index + direction))
  };
}

export function markPrayerSessionPrayed(session: PrayerSession, requestId: string): PrayerSession {
  if (session.ended || session.requestIds[session.index] !== requestId || session.prayedIds.includes(requestId)) {
    return session;
  }
  return {
    ...session,
    index: session.index + 1,
    prayedIds: [...session.prayedIds, requestId]
  };
}

export function endPrayerSession(session: PrayerSession): PrayerSession {
  return session.ended ? session : { ...session, ended: true };
}

export function recordPreviewPrayer(
  requests: readonly PrayerRequestPreview[],
  requestId: string,
  prayedAt: string
): { valid: true; requests: PrayerRequestPreview[] } | { valid: false; error: string } {
  const request = requests.find(item => item.id === requestId);
  if (!request || request.status !== 'active') {
    return { valid: false, error: 'This prayer request is no longer active.' };
  }
  return {
    valid: true,
    requests: requests.map(item => item.id === requestId
      ? { ...item, prayedCount: item.prayedCount + 1, lastPrayedAt: prayedAt }
      : item)
  };
}
