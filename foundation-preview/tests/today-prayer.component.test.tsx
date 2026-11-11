import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayPrayerModule } from '../src/components/TodayPrayerModule.tsx';
import type { PersonPrayerRequest } from '../src/domain/person-prayers.ts';
import type { PersonPickerGroup, PersonPreview } from '../src/domain/preview-data.ts';
import { createDefaultTimeBlockSettings } from '../src/domain/time-blocks.ts';

afterEach(cleanup);

function expectPresent(element: HTMLElement) {
  expect(element).toBeTruthy();
}

const people: PersonPreview[] = [
  { id: 'amy', displayName: 'Amy Adams' },
  { id: 'morgan', displayName: 'Morgan Reed' },
  { id: 'jordan', displayName: 'Jordan Bell' }
];

const peopleGroups: PersonPickerGroup[] = [
  { id: 'marriage', label: 'Marriage', memberIds: ['amy', 'morgan'] },
  { id: 'parenting', label: 'Parenting', memberIds: ['morgan', 'jordan'] },
  { id: 'friends', label: 'Friends', memberIds: ['amy', 'jordan'] }
];

function request(
  id: string,
  personId: string,
  title: string,
  sharedWith: string[] = []
): PersonPrayerRequest {
  return {
    id,
    personId,
    sharedWith,
    title,
    details: `${title} details`,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    prayerLogs: []
  };
}

function renderPrayer(
  requests: readonly PersonPrayerRequest[],
  onPray = vi.fn(),
  prayerPeople: readonly PersonPreview[] = people
) {
  return {
    onPray,
    ...render(
      <TodayPrayerModule
        people={prayerPeople}
        peopleGroups={peopleGroups}
        requests={requests}
        evaluationInstant={new Date(2026, 0, 1, 10)}
        timeZone="UTC"
        timeBlocks={createDefaultTimeBlockSettings()}
        onPray={onPray}
      />
    )
  };
}

describe('Today Prayer module', () => {
  it('shows the request count and adapts an empty selection to a customize prompt', async () => {
    const user = userEvent.setup();
    renderPrayer([]);
    expectPresent(screen.getByRole('heading', { name: 'Prayer' }));
    expectPresent(screen.getByText('3 people selected · Now · 0 requests'));
    expect((screen.getByRole('button', { name: 'Focused Prayer · 0' }) as HTMLButtonElement).disabled)
      .toBe(true);
    await user.click(screen.getByRole('button', { name: 'Customize' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expectPresent(screen.getByText('0 requests selected'));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expectPresent(screen.getByText('No active requests match this selection.'));
  });

  it('uses the Today card layout with a summary and two side-by-side actions', () => {
    renderPrayer([]);
    const card = screen.getByRole('region', { name: 'Prayer' });
    const header = card.querySelector('.prayer-entry-card__heading');
    const summary = card.querySelector('.prayer-entry-card__summary');
    expect(header?.querySelector('h3')?.textContent).toBe('Prayer');
    expect(header?.nextElementSibling).toBe(summary);
    expect(summary?.textContent).toBe('3 people selected · Now · 0 requests');
    const startButton = card.querySelector('.prayer-entry-card__session-start');
    const actions = card.querySelector('.prayer-entry-card__actions');
    expect(summary?.nextElementSibling?.textContent).toBe('No active requests match this selection.');
    expect(actions?.children[0]?.textContent).toBe('Customize');
    expect(actions?.children[1]).toBe(startButton);
    expect(startButton?.textContent).toBe('Focused Prayer · 0');
  });

  it('toggles group chips, supports select all/clear, and updates the footer count', async () => {
    const user = userEvent.setup();
    renderPrayer([
      request('amy-request', 'amy', 'A request'),
      request('shared-request', 'jordan', 'Shared request', ['morgan'])
    ]);
    await user.click(screen.getByRole('button', { name: 'Customize' }));
    const selectionDialog = screen.getByRole('dialog');
    const timeframeRow = selectionDialog.querySelector('.tend2-prayer-selection-timeframe');
    const peopleSection = selectionDialog.querySelector('.tend2-prayer-selection-section');
    const chipRow = selectionDialog.querySelector('.tend2-prayer-selection-groups');
    const categoryChips = within(selectionDialog).getAllByRole('checkbox');
    expect(timeframeRow?.nextElementSibling).toBe(peopleSection);
    expect(chipRow?.parentElement).toBe(peopleSection);
    expect(categoryChips.map(chip => chip.textContent)).toEqual(['Marriage', 'Parenting', 'Friends']);
    expect(categoryChips.every(chip => chip.parentElement === chipRow)).toBe(true);
    expect(categoryChips.every(chip => chip.childElementCount === 0)).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    const marriage = screen.getByRole('checkbox', { name: 'Marriage' });
    await user.click(marriage);
    expect(marriage.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('button', { name: /Amy/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Morgan/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Jordan/ }).getAttribute('aria-pressed')).toBe('false');
    expectPresent(screen.getByText('2 requests selected'));
    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expectPresent(screen.getByText('2 requests selected'));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expectPresent(screen.getByText('0 requests selected'));
  });

  it('shows Now, highlights the selected block, and keeps timeframe actions in the footer', async () => {
    const user = userEvent.setup();
    renderPrayer([request('one', 'amy', 'One request')]);
    await user.click(screen.getByRole('button', { name: 'Customize' }));
    const timeframeHeading = screen.getByRole('heading', { name: 'Timeframe' });
    const peopleHeading = screen.getByRole('heading', { name: 'People' });
    const timeframeTrigger = screen.getByRole('button', { name: /Change timeframe: Now/ });
    expect(timeframeHeading.className).toBe(peopleHeading.className);
    expect(timeframeHeading.parentElement?.nextElementSibling).toBe(timeframeTrigger);
    const timeframeCopy = timeframeTrigger.querySelector('.tend2-prayer-selection-timeframe-copy');
    expect(timeframeCopy?.firstElementChild?.textContent).toBe('Now');
    expect(timeframeCopy?.lastElementChild?.textContent).toBe('Morning · 9:00am – 11:30am');
    await user.click(timeframeTrigger);
    expect(screen.getByRole('dialog').classList.contains('tend2-prayer-selection-dialog--timeframes'))
      .toBe(true);
    const currentBlock = screen.getAllByRole('radio')
      .find(option => option.querySelector('strong')?.textContent === 'Morning')!;
    expect(currentBlock.getAttribute('aria-current')).toBe('true');
    expect(currentBlock.textContent).toContain('9:00am – 11:30am');
    expect(screen.getByRole('radio', { name: /Now/ }).getAttribute('aria-checked')).toBe('true');
    const options = screen.getAllByRole('radio');
    expect(options.filter(option => option.classList.contains('is-selected'))).toHaveLength(1);
    expect(options.every(option => !option.classList.contains('is-current'))).toBe(true);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start prayer' })).toBeTruthy();
    const footer = screen.getByRole('dialog').querySelector('.tend2-prayer-selection-footer');
    expect(footer?.querySelector('p')?.textContent).toBe('1 request selected');
    expect(footer?.contains(screen.getByRole('button', { name: 'Done' }))).toBe(true);
    expect(footer?.contains(screen.getByRole('button', { name: 'Start prayer' }))).toBe(true);
    await user.click(screen.getByRole('radio', { name: /All Day/ }));
    expect(screen.getByRole('radio', { name: /All Day/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByRole('radio').filter(option => option.classList.contains('is-selected')))
      .toHaveLength(1);
    expect(screen.getByRole('dialog').querySelector('.tend2-prayer-selection-footer'))
      .toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expectPresent(screen.getByText('3 people selected · All Day · 1 request'));
  });

  it('applies the chosen timeframe and people when Done is pressed', async () => {
    const user = userEvent.setup();
    renderPrayer([
      request('amy-request', 'amy', 'Amy request'),
      request('shared-request', 'jordan', 'Shared request', ['morgan'])
    ]);
    await user.click(screen.getByRole('button', { name: 'Customize' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(screen.getByRole('checkbox', { name: 'Marriage' }));
    await user.click(screen.getByRole('button', { name: /Change timeframe: Now/ }));
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    const morning = screen.getAllByRole('radio')
      .find(option => option.querySelector('strong')?.textContent === 'Morning')!;
    await user.click(morning);
    expect(morning.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('dialog')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expectPresent(screen.getByText('2 people selected · Morning · 2 requests'));
  });

  it('shows different scheduled counts for each timeframe', async () => {
    const user = userEvent.setup();
    renderPrayer([
      { ...request('morning', 'amy', 'Morning'), timeOfDay: 'morning' },
      { ...request('evening', 'morgan', 'Evening'), timeOfDay: 'evening' },
      {
        ...request('tomorrow', 'amy', 'Tomorrow'),
        schedule: { frequency: 'weekly', weekdays: [5] }
      }
    ]);
    await user.click(screen.getByRole('button', { name: 'Customize' }));
    await user.click(screen.getByRole('button', { name: /Change timeframe: Now/ }));
    const options = screen.getAllByRole('radio');
    expect(options.find(option => option.querySelector('strong')?.textContent === 'Morning')?.textContent)
      .toContain('1 request');
    expect(options.find(option => option.querySelector('strong')?.textContent === 'Evening')?.textContent)
      .toContain('1 request');
    expect(options.find(option => option.querySelector('strong')?.textContent === 'All Day')?.textContent)
      .toContain('3 requests');
    expect(options.find(option => option.querySelector('strong')?.textContent === 'All prayers today')?.textContent)
      .toContain('2 requests');
  });

  it('starts an all-prayers-today session with requests from every block, Anytime, and All day', async () => {
    const user = userEvent.setup();
    renderPrayer([
      { ...request('morning', 'amy', 'Morning'), timeOfDay: 'morning' },
      { ...request('evening', 'morgan', 'Evening'), timeOfDay: 'evening' },
      { ...request('anytime', 'jordan', 'Anytime'), timeOfDay: 'anytime' },
      { ...request('all-day', 'amy', 'All day'), timeOfDay: 'all-day' }
    ]);
    await user.click(screen.getByRole('button', { name: 'Customize' }));
    await user.click(screen.getByRole('button', { name: /Change timeframe: Now/ }));
    const allToday = screen.getByRole('radio', { name: /All prayers today/ });
    expect(allToday.textContent).toContain('4 requests');
    await user.click(allToday);
    await user.click(screen.getByRole('button', { name: 'Start prayer' }));
    expect(screen.queryByRole('dialog', { name: 'Prayer timeframe' })).toBeNull();
    expectPresent(screen.getByText('Daily · All day · prayed 0 times'));
    expectPresent(screen.getByText('All day details'));
  });

  it('records only Prayed, supports arrow keys, and completes after the queue', async () => {
    const user = userEvent.setup();
    const onPray = vi.fn(() => null);
    const { onPray: recordPrayer } = renderPrayer([
      request('first', 'amy', 'First request'),
      request('second', 'jordan', 'Second request')
    ], onPray);
    await user.click(screen.getByRole('button', { name: 'Focused Prayer · 2' }));
    expectPresent(screen.getByRole('heading', { name: 'One request at a time' }));
    expectPresent(screen.getByText('First request'));
    const sessionDialog = screen.getByRole('dialog');
    const headingRow = sessionDialog.querySelector('.tend2-prayer-session-heading');
    expect(headingRow?.querySelector('h1')?.textContent).toBe('One request at a time');
    expect(headingRow?.querySelector('.tend2-prayer-session-end')?.textContent).toBe('End session');
    expect(headingRow?.nextElementSibling?.classList.contains('tend2-prayer-session-progress')).toBe(true);
    const personBadge = sessionDialog.querySelector('.tend2-prayer-session-person');
    expect(personBadge?.classList.contains('tend2-prayer-session-person--centered')).toBe(true);
    const requestCard = sessionDialog.querySelector('.tend2-prayer-session-card');
    expect(requestCard?.classList.contains('tend2-prayer-session-card--centered')).toBe(true);
    expect(document.activeElement).toBe(requestCard);
    expect(personBadge?.nextElementSibling?.textContent).toBe('First request');
    const backButton = screen.getByRole('button', { name: 'Back' });
    expect(backButton.hasAttribute('disabled')).toBe(true);
    await user.keyboard('{ArrowLeft}');
    expectPresent(screen.getByText('First request'));
    expect(backButton.hasAttribute('disabled')).toBe(true);
    await user.keyboard('{ArrowRight}');
    expectPresent(screen.getByText('Second request'));
    expect(backButton.hasAttribute('disabled')).toBe(false);
    await user.keyboard('{ArrowLeft}');
    expectPresent(screen.getByText('First request'));

    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expectPresent(screen.getByText('Second request'));
    expect(recordPrayer).not.toHaveBeenCalled();
    await user.click(backButton);
    expectPresent(screen.getByText('First request'));
    expect(recordPrayer).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Prayed' }));
    expect(recordPrayer).toHaveBeenCalledTimes(1);
    expect(recordPrayer).toHaveBeenLastCalledWith('first', '2026-01-01T00:00:00.000Z', 'amy', 'amy');
    expectPresent(screen.getByText('Second request'));
    await user.click(screen.getByRole('button', { name: 'Prayed' }));
    expect(recordPrayer).toHaveBeenCalledTimes(2);
    expectPresent(screen.getByRole('heading', { name: 'Prayer time complete' }));
    expectPresent(screen.getByText('You marked 2 requests prayed.'));
    expectPresent(within(screen.getByRole('dialog')).getByRole('button', { name: 'Finish' }));
  });

  it('shows schedule metadata and attributes prayers to Me when selected', async () => {
    const user = userEvent.setup();
    const onPray = vi.fn(() => null);
    const me = { id: 'me', displayName: 'Me' };
    const { onPray: recordPrayer } = renderPrayer([
      {
        ...request('scheduled', 'amy', 'Scheduled request'),
        schedule: { frequency: 'weekly', weekdays: [4] },
        timeOfDay: 'morning'
      }
    ], onPray, [...people, me]);

    await user.click(screen.getByRole('button', { name: 'Focused Prayer · 1' }));
    expectPresent(screen.getByText('Weekly · Morning · prayed 0 times'));
    await user.click(screen.getByRole('button', { name: 'Prayed' }));
    expect(recordPrayer).toHaveBeenLastCalledWith(
      'scheduled',
      '2026-01-01T00:00:00.000Z',
      'amy',
      'me'
    );
  });
});
