export type CalendarSource = {
  id: string;
  name: string;
  url: string;
  enabled?: boolean;
  kind?: 'controlled-test';
};

export const CONTROLLED_CALENDAR_TEST_URL = 'tend-local-fixture://controlled-calendar';

export type CalendarSourcesValidation =
  | { valid: true; sources: CalendarSource[] }
  | { valid: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function calendarFeedUrlError(value: string): string | null {
  if (!value || value.length > 4096 || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    return 'Enter a complete iCloud public calendar link.';
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'Enter a complete iCloud public calendar link.';
  }
  const host = url.hostname.toLowerCase();
  const isICloudHost = host === 'icloud.com' || host.endsWith('.icloud.com');
  if ((url.protocol !== 'https:' && url.protocol !== 'webcal:')
    || !isICloudHost
    || !url.pathname
    || url.username
    || url.password
    || url.port
    || url.hash) {
    return 'Use an HTTPS or webcal public calendar link from iCloud. Private Apple Account sign-in is not supported.';
  }
  return null;
}

export function validateCalendarSources(value: unknown): CalendarSourcesValidation {
  if (!Array.isArray(value)) {
    return { valid: false, errors: ['Calendar sources must be a list.'] };
  }
  const ids = new Set<string>();
  const errors: string[] = [];
  const sources: CalendarSource[] = [];
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)
      || Object.keys(item).some(key => !['id', 'name', 'url', 'enabled', 'kind'].includes(key))
      || typeof item.id !== 'string'
      || !/^calendar-source-[a-zA-Z0-9-]{1,100}$/.test(item.id)
      || ids.has(item.id)
      || typeof item.name !== 'string'
      || !item.name.trim()
      || item.name.trim() !== item.name
      || item.name.length > 60
      || typeof item.url !== 'string'
      || ('enabled' in item && typeof item.enabled !== 'boolean')
      || ('kind' in item && item.kind !== 'controlled-test')) {
      errors.push(`Calendar source ${index + 1} has invalid fields or a duplicate ID.`);
      continue;
    }
    const urlError = item.kind === 'controlled-test'
      ? item.url === CONTROLLED_CALENDAR_TEST_URL
        ? null
        : 'The controlled calendar test source is invalid.'
      : calendarFeedUrlError(item.url);
    if (urlError) {
      errors.push(`Calendar source ${index + 1}: ${urlError}`);
      continue;
    }
    ids.add(item.id);
    sources.push({
      id: item.id,
      name: item.name,
      url: item.url,
      ...(typeof item.enabled === 'boolean' ? { enabled: item.enabled } : {}),
      ...(item.kind === 'controlled-test' ? { kind: item.kind } : {})
    });
  }
  return errors.length ? { valid: false, errors } : { valid: true, sources };
}

export function createCalendarSourceId(randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)): string | null {
  return randomUUID ? `calendar-source-${randomUUID()}` : null;
}

export function selectEnabledCalendarSources(sources: readonly CalendarSource[]): CalendarSource[] {
  return sources.filter(source => source.enabled !== false);
}
