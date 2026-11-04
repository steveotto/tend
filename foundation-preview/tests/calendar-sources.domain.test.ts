import { describe, expect, it } from 'vitest';
import {
  calendarFeedUrlError,
  validateCalendarSources
} from '../src/domain/calendar-sources.ts';
import {
  createPreviewEnvelope,
  createSamplePreviewData,
  parsePreviewBackup,
  PREVIEW_SCHEMA_VERSION,
  validatePreviewEnvelope
} from '../src/domain/preview-state.ts';

describe('calendar source contract', () => {
  it('accepts public iCloud subscription URLs and preserves their exact entered form', () => {
    const url = 'webcal://p123-caldav.icloud.com/published/2/synthetic-token';
    const result = validateCalendarSources([{
      id: 'calendar-source-test-1',
      name: 'Work',
      url
    }]);

    expect(result).toEqual({
      valid: true,
      sources: [{ id: 'calendar-source-test-1', name: 'Work', url }]
    });
  });

  it('rejects non-iCloud, insecure, credential-bearing, and malformed URLs', () => {
    expect(calendarFeedUrlError('http://p123-caldav.icloud.com/published/test')).not.toBeNull();
    expect(calendarFeedUrlError('https://example.com/calendar.ics')).not.toBeNull();
    expect(calendarFeedUrlError('https://user:password@icloud.com/calendar')).not.toBeNull();
    expect(calendarFeedUrlError('not a URL')).not.toBeNull();
  });

  it('validates unique IDs and bounded non-empty names', () => {
    const source = {
      id: 'calendar-source-test-1',
      name: 'Work',
      url: 'https://p123-caldav.icloud.com/published/test'
    };
    expect(validateCalendarSources([source, source]).valid).toBe(false);
    expect(validateCalendarSources([{ ...source, name: ' ' }]).valid).toBe(false);
    expect(validateCalendarSources([{ ...source, name: 'x'.repeat(61) }]).valid).toBe(false);
  });
});

describe('calendar source backup schema', () => {
  it('migrates schema 35 to 37 with empty sources while retaining existing collections', () => {
    const data = createSamplePreviewData();
    data.personNotes = [{
      id: 'person-note-synthetic',
      personId: 'sample-person-morgan',
      content: 'Synthetic note',
      createdAt: '2026-11-06T12:00:00.000Z',
      updatedAt: '2026-11-06T12:00:00.000Z'
    }];
    const previous = createPreviewEnvelope(data);
    const oldData = { ...previous.data } as Record<string, unknown>;
    delete oldData.calendarSources;
    const raw = JSON.stringify({ ...previous, schemaVersion: 35, data: oldData });
    const parsed = validatePreviewEnvelope(JSON.parse(raw), '2026-11-06');

    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.sourceSchemaVersion).toBe(35);
    expect(parsed.envelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(parsed.envelope.data.calendarSources).toEqual([]);
    expect(parsed.envelope.data.personNotes).toEqual(data.personNotes);
    expect(parsed.envelope.data.people).toEqual(data.people);
    expect(parsed.envelope.data.prayerRequests).toEqual(data.prayerRequests);
  });

  it('validates and round-trips calendar sources in supported backups', () => {
    const data = createSamplePreviewData();
    data.calendarSources = [{
      id: 'calendar-source-test-2',
      name: 'Personal',
      url: 'https://p123-caldav.icloud.com/published/synthetic-token'
    }];
    const envelope = createPreviewEnvelope(data);

    expect(envelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(parsePreviewBackup(JSON.stringify(envelope), '2026-11-06')).toMatchObject({
      valid: true,
      envelope: { data: { calendarSources: data.calendarSources } }
    });
    expect(validatePreviewEnvelope({
      ...envelope,
      data: { ...envelope.data, calendarSources: [{ ...data.calendarSources[0], url: 'http://example.com' }] }
    }, '2026-11-06')).toMatchObject({ valid: false, kind: 'invalid' });
  });
});
