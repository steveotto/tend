import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarAgendaSection } from '../src/components/CalendarAgendaSection.tsx';
import { CalendarSourcesSettings } from '../src/components/CalendarSourcesSettings.tsx';
import { CONTROLLED_CALENDAR_TEST_URL } from '../src/domain/calendar-sources.ts';
import type { CalendarSource } from '../src/domain/calendar-sources.ts';
import { createLocalCalendarReaderServer } from '../local-calendar-reader.mjs';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function CalendarReaderHarness({ readerOrigin }: { readerOrigin: string }) {
  const [sources, setSources] = useState<CalendarSource[]>([{
    id: 'calendar-source-controlled-fixture',
    name: 'Controlled test calendar',
    url: CONTROLLED_CALENDAR_TEST_URL,
    enabled: true,
    kind: 'controlled-test'
  }]);
  return (
    <>
      <CalendarSourcesSettings
        sources={sources}
        localReaderEnabled
        onSave={next => {
          setSources(next);
          return null;
        }}
      />
      <CalendarAgendaSection
        sources={sources}
        timeZone="UTC"
        readerEnabled
      />
      <output hidden>{readerOrigin}</output>
    </>
  );
}

describe('Calendar settings to local-reader flow', () => {
  it('uses a test-only controlled source fixture to read ICS over HTTP and display parsed events', async () => {
    const reader = createLocalCalendarReaderServer();
    await new Promise<void>(resolve => reader.listen(0, '127.0.0.1', resolve));
    const address = reader.address();
    if (!address || typeof address === 'string') throw new Error('Reader did not bind to a local port.');
    const readerOrigin = `http://127.0.0.1:${address.port}`;
    const nativeFetch = globalThis.fetch.bind(globalThis);

    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === 'string' && input.startsWith('/')
        ? new URL(input, readerOrigin).href
        : String(input);
      const headers = new Headers(init?.headers);
      headers.set('origin', 'http://127.0.0.1:5303');
      return nativeFetch(new URL(requestUrl, readerOrigin), { ...init, headers });
    });

    try {
      render(<CalendarReaderHarness readerOrigin={readerOrigin} />);

      expect(await screen.findByText('Controlled all-day event')).toBeTruthy();
      expect(screen.getByText('Controlled timed event')).toBeTruthy();
      expect(screen.getByText('Controlled recurring event')).toBeTruthy();
      const eventTimes = [...screen.getByRole('list', { name: 'Calendar events for today' })
        .querySelectorAll('.calendar-event__date-time')]
        .map(element => element.textContent);
      expect(eventTimes).toHaveLength(3);
      expect(eventTimes?.[0]).toMatch(/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2} · All day$/);
      expect(eventTimes?.[1]).toMatch(/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2} · \d{1,2}:\d{2} [AP]M–(?:[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}, )?\d{1,2}:\d{2} [AP]M$/);
      expect(eventTimes?.[2]).toMatch(/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2} · \d{1,2}:\d{2} [AP]M–(?:[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}, )?\d{1,2}:\d{2} [AP]M$/);
    } finally {
      vi.unstubAllGlobals();
      await new Promise<void>((resolve, reject) => {
        reader.close(error => error ? reject(error) : resolve());
      });
    }
  });
});
