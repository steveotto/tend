import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarSourcesSettings } from '../src/components/CalendarSourcesSettings.tsx';
import { CONTROLLED_CALENDAR_TEST_URL } from '../src/domain/calendar-sources.ts';
import type { CalendarSource } from '../src/domain/calendar-sources.ts';

afterEach(cleanup);

function CalendarSettingsHarness({
  initial = [],
  initialShowOnToday = true,
  localReaderEnabled = false
}: {
  initial?: CalendarSource[];
  initialShowOnToday?: boolean;
  localReaderEnabled?: boolean;
}) {
  const [sources, setSources] = useState(initial);
  const [showOnToday, setShowOnToday] = useState(initialShowOnToday);
  return (
    <CalendarSourcesSettings
      sources={sources}
      showOnToday={showOnToday}
      onShowOnTodayChange={setShowOnToday}
      localReaderEnabled={localReaderEnabled}
      onSave={next => {
        setSources(next);
        return null;
      }}
    />
  );
}

describe('synthetic calendar settings', () => {
  it('shows accessible iCloud setup steps and a primary Add calendar action when empty', () => {
    render(<CalendarSettingsHarness localReaderEnabled />);

    const steps = screen.getByRole('list', { name: 'Calendar setup steps' });
    expect([...steps.querySelectorAll('li')].map(step => step.textContent?.replace(/^[123]/, '').trim())).toEqual([
      "Open your calendar's sharing settings on iCloud.com.",
      'Turn on Public Calendar and copy its link.',
      'Select Add calendar and paste the link.'
    ]);
    expect(screen.getByText('Supports public iCloud calendars.')).toBeTruthy();
    expect(screen.getByText('No calendars added yet.')).toBeTruthy();
    expect(screen.getByText('Keep your calendar link private—anyone with it may be able to view its events.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add calendar' }).className).not.toContain('ghost');
    expect(screen.queryByRole('button', { name: 'Add controlled test feed' })).toBeNull();
    expect(screen.getByText(/configured same-origin reader/)).toBeTruthy();
  });

  it('exposes the Today visibility preference and preserves calendar source settings', async () => {
    const user = userEvent.setup();
    const source: CalendarSource = {
      id: 'calendar-source-existing',
      name: 'Synthetic calendar',
      url: 'https://p123-caldav.icloud.com/published/synthetic-token',
      enabled: true
    };
    render(<CalendarSettingsHarness initial={[source]} />);

    const showOnToday = screen.getByRole('checkbox', { name: 'Show calendar on Today' }) as HTMLInputElement;
    expect(showOnToday.checked).toBe(true);
    await user.click(showOnToday);
    expect(showOnToday.checked).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'Use Synthetic calendar' })).toBeTruthy();
    expect(screen.getByText('Enabled · public iCloud feed')).toBeTruthy();
    const setupDisclosure = screen.getByText('How to add a calendar').closest('details');
    expect(setupDisclosure?.open).toBe(false);
    await user.click(screen.getByText('How to add a calendar'));
    expect(setupDisclosure?.open).toBe(true);
    expect(screen.getByRole('list', { name: 'Calendar setup steps' })).toBeTruthy();
  });

  it('adds a public iCloud source without displaying its saved link', async () => {
    const user = userEvent.setup();
    render(<CalendarSettingsHarness />);

    await user.click(screen.getByRole('button', { name: 'Add calendar' }));
    await user.type(screen.getByLabelText('Calendar name'), 'Work');
    const url = 'webcal://p123-caldav.icloud.com/published/synthetic-token';
    await user.type(screen.getByLabelText('Public iCloud calendar link'), url);
    await user.click(screen.getByRole('button', { name: 'Save calendar' }));

    expect(await screen.findByText('Work')).toBeTruthy();
    expect(screen.getByText('Enabled · public iCloud feed')).toBeTruthy();
    expect(screen.queryByText(url)).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Calendar added.');
  });

  it('validates unsupported sources without saving or echoing the supplied URL', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    render(<CalendarSourcesSettings sources={[]} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Add calendar' }));
    await user.type(screen.getByLabelText('Calendar name'), 'Other provider');
    const unsupportedUrl = 'https://calendar.example.test/private.ics';
    await user.type(screen.getByLabelText('Public iCloud calendar link'), unsupportedUrl);
    await user.click(screen.getByRole('button', { name: 'Save calendar' }));

    expect(screen.getByRole('alert').textContent).toMatch(/iCloud/);
    expect(screen.getByRole('alert').textContent).not.toContain(unsupportedUrl);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('enables, edits, and explicitly removes a configured source while preserving its raw URL', async () => {
    const user = userEvent.setup();
    const url = 'https://p123-caldav.icloud.com/published/unchanged-token';
    render(<CalendarSettingsHarness initial={[{
      id: 'calendar-source-existing',
      name: 'Personal',
      url,
      enabled: false
    }]} />);

    expect(screen.queryByText(url)).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Use Personal' }));
    expect(screen.getByText('Personal enabled.')).toBeTruthy();
    await user.click(screen.getByRole('checkbox', { name: 'Use Personal' }));
    expect(screen.getByText('Personal disabled.')).toBeTruthy();
    await user.click(screen.getByRole('checkbox', { name: 'Use Personal' }));
    expect(screen.getByText('Personal enabled.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Edit Personal' }));
    expect((screen.getByLabelText('Public iCloud calendar link') as HTMLInputElement).value).toBe(url);
    await user.clear(screen.getByLabelText('Calendar name'));
    await user.type(screen.getByLabelText('Calendar name'), 'Personal calendar');
    await user.click(screen.getByRole('button', { name: 'Save calendar' }));
    expect(await screen.findByText('Personal calendar')).toBeTruthy();
    expect(screen.getByText('Enabled · public iCloud feed')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    const item = within(screen.getByRole('list', { name: 'Calendar sources' })).getByRole('listitem');
    await user.click(within(item).getByRole('button', { name: 'Confirm removal of Personal calendar' }));
    expect(await screen.findByText('No calendars added yet.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Calendar removed.');
  });

  it('keeps controlled reader fixtures available to tests without exposing a Settings action', async () => {
    const user = userEvent.setup();
    render(<CalendarSettingsHarness
      localReaderEnabled
      initial={[{
        id: 'calendar-source-controlled-fixture',
        name: 'Controlled test calendar',
        url: CONTROLLED_CALENDAR_TEST_URL,
        enabled: true,
        kind: 'controlled-test'
      }]}
    />);

    expect(screen.getByText('Controlled test calendar')).toBeTruthy();
    expect(screen.getByText('Enabled · controlled test feed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add controlled test feed' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Edit Controlled test calendar' }));
    expect(screen.queryByLabelText('Public iCloud calendar link')).toBeNull();
    expect(screen.getByText('Uses a fixed synthetic feed from the local reader. It cannot access a personal calendar.')).toBeTruthy();
  });
});
