export type CalendarSource = {
  id: string;
  name: string;
  url: string;
};

export type CalendarSourcesValidation =
  | { valid: true; sources: CalendarSource[] }
  | { valid: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function calendarFeedUrlError(value: string): string | null {
  if (!value || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
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
      || Object.keys(item).some(key => !['id', 'name', 'url'].includes(key))
      || typeof item.id !== 'string'
      || !/^calendar-source-[a-zA-Z0-9-]{1,100}$/.test(item.id)
      || ids.has(item.id)
      || typeof item.name !== 'string'
      || !item.name.trim()
      || item.name.trim() !== item.name
      || item.name.length > 60
      || typeof item.url !== 'string') {
      errors.push(`Calendar source ${index + 1} has invalid fields or a duplicate ID.`);
      continue;
    }
    const urlError = calendarFeedUrlError(item.url);
    if (urlError) {
      errors.push(`Calendar source ${index + 1}: ${urlError}`);
      continue;
    }
    ids.add(item.id);
    sources.push({ id: item.id, name: item.name, url: item.url });
  }
  return errors.length ? { valid: false, errors } : { valid: true, sources };
}

export function createCalendarSourceId(randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)): string | null {
  return randomUUID ? `calendar-source-${randomUUID()}` : null;
}
