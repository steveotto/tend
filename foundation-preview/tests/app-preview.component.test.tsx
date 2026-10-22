import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { CatalogApp } from '../src/CatalogApp.tsx';
import { ArchivedRhythmsDialog } from '../src/components/ArchivedRhythmsDialog.tsx';
import { localDateString } from '../src/domain/money-goals.ts';
import {
  marriageExampleFixtures,
  marriageFoundationCoverage,
  marriageFoundations,
  marriageRhythms,
  marriageScoreCoverage,
  marriageWeekDays,
  orderedCompletions,
  rhythmsSupportingFoundation,
  todayRhythms
} from '../src/domain/preview-data.ts';
import { parsePreviewBackup } from '../src/domain/preview-state.ts';
import { PREVIEW_STORAGE_KEY } from '../src/storage/preview-storage.ts';
import { installMemoryStorage } from './memory-storage.ts';

beforeEach(installMemoryStorage);
afterEach(() => {
  cleanup();
  window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
});

describe('Tend Today preview', () => {
  it('keeps the Tend tagline above the greeting while removing the duplicate header date', () => {
    const { container } = render(<App />);
    const header = container.querySelector('.apphead')!;
    const greeting = screen.getByRole('heading', { name: /Good (morning|afternoon|evening)/ });

    expect(header.querySelector('.brand-tagline')?.textContent).toBe('Tend to what matters');
    expect(header.querySelector('.sub')).toBeNull();
    expect(header.compareDocumentPosition(greeting) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('.dashboard-greeting .hint')?.textContent).toMatch(/,\s+\w+\s+\d+/);
  });

  it('composes the shared RhythmCard contract in the app and catalogue views', () => {
    const { container } = render(<App />);
    const todayCard = screen.getByRole('article', { name: 'Pray together' });
    expect(todayCard.classList.contains('rhythm-card')).toBe(true);
    expect(todayCard.classList.contains('rhythm-card--simple')).toBe(true);
    expect(within(todayCard).getByRole('button', { name: 'Details for Pray together' })).toBeTruthy();
    expect(within(todayCard).getByRole('button', { name: 'Tend Pray together' })).toBeTruthy();
    expect(within(todayCard).queryByText('Take a quiet moment to pray together and begin the day connected.')).toBeNull();
    expect(within(todayCard).getByText('Due today')).toBeTruthy();
    const todayCardCount = container.querySelectorAll('.rhythm-card--simple').length;

    cleanup();
    const catalogue = render(<CatalogApp />);
    const catalogueCard = screen.getByRole('article', { name: 'Monthly savings transfer' });
    expect(catalogueCard.classList.contains('rhythm-card')).toBe(true);
    expect(catalogueCard.querySelector('.rhythm-content')).not.toBeNull();
    expect(catalogue.container.querySelectorAll('.rhythm-card')).toHaveLength(1);
    expect(todayCardCount).toBe(3);
  });

  it('navigates person badges to synthetic profiles without activating Rhythm actions', async () => {
    const user = userEvent.setup();
    render(<App />);
    const todayRhythm = screen.getByRole('article', { name: 'Pray together' });
    const todayAvery = within(todayRhythm).getByRole('button', { name: 'Open synthetic profile for Avery Brooks' });
    expect(todayAvery.getAttribute('data-person-id')).toBe('sample-person-avery');
    todayAvery.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('heading', { name: 'Avery Brooks' })).toBeTruthy();
    expect(screen.getByText(/does not connect to an account/)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Back to Today' }));
    expect(screen.getByText('0 of 3 tended')).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Pray together' }))
      .getByRole('button', { name: 'Tend Pray together' })).toBeTruthy();
  });

  it('navigates to an associated person from full details without tending or reopening the Rhythm', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Details for Pray together' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pray together' });
    const personBadge = within(dialog).getByRole('button', { name: 'Open synthetic profile for Avery Brooks' });
    expect(personBadge.getAttribute('data-person-id')).toBe('sample-person-avery');
    await user.click(personBadge);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Avery Brooks' })).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).not.toContain('sample-pray-together');
    await user.click(screen.getByRole('button', { name: 'Back to Today' }));
    expect(screen.getByText('0 of 3 tended')).toBeTruthy();
  });

  it('shows Today category scores in color-coded badges without inventing unavailable values', () => {
    render(<App />);

    const marriage = screen.getAllByRole('button', { name: 'Marriage' }).find(button => button.classList.contains('menu-area'))!;
    expect(marriage.querySelector('.ma-score')?.textContent).toBe('78');
    expect(marriage.querySelector('.ma-score')?.classList.contains('yellow')).toBe(true);
    expect(marriage.getAttribute('aria-description')).toContain('illustrative sample score 78, not calculated');

    const faith = screen.getAllByRole('button', { name: 'Faith' }).find(button => button.classList.contains('menu-area'))!;
    expect(faith.querySelector('.ma-score')?.textContent).toBe('—');
    expect(faith.querySelector('.ma-score')?.classList.contains('neutral')).toBe(true);
    expect(faith.getAttribute('aria-description')).toContain('sample health score unavailable');
  });

  it('shows the explicitly illustrative overall health meter with the requested sample value', () => {
    render(<App />);

    expect(screen.getByText('87', { selector: '.ov-score' })).toBeTruthy();
    const meter = screen.getByRole('meter', {
      name: 'Overall health, illustrative sample score 87 out of 100, not calculated'
    });
    expect(meter.getAttribute('aria-valuenow')).toBe('87');
    expect(meter.classList.contains('preview-score-meter--marker-below')).toBe(true);
    expect(meter.querySelector('.preview-score-marker')?.getAttribute('style')).toContain('--score: 87%');
    expect(screen.getByText('Illustrative sample · not calculated')).toBeTruthy();
  });

  it('tends from the compact card and updates and persists the shared details state', async () => {
    const user = userEvent.setup();
    render(<App />);

    const opener = screen.getByRole('button', { name: 'Details for Pray together' });
    const cardTend = screen.getByRole('button', { name: 'Tend Pray together' });
    await user.click(cardTend);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(cardTend);
    expect(screen.getByText('1 of 3 tended')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tended Pray together' }).matches(':disabled')).toBe(true);

    await user.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Pray together' });
    expect(screen.getByText('1 of 3 tended')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Tended Pray together' }).matches(':disabled')).toBe(true);
    expect(within(dialog).getByRole('button', { name: 'Tended Pray together' }).querySelector('svg')).toBeNull();
    const dialogUndo = within(dialog).getByRole('button', { name: 'Undo completion for Pray together' });
    const dialogStatus = dialog.querySelector('.rhythm-metadata-status-group');
    expect(dialogStatus?.querySelector('.rhythm-metadata-status')?.textContent).toBe('Tended today');
    expect(dialogStatus?.children[0]).toBe(dialogUndo);
    expect(dialogStatus?.children[1]?.tagName.toLowerCase()).toBe('svg');
    expect(dialogStatus?.children[2]?.textContent).toBe('Tended today');
    expect(within(screen.getByRole('article', { name: 'Pray together' })).getByText('Tended today')).toBeTruthy();
    await waitFor(() => {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
      expect(raw).not.toBeNull();
      if (raw === null) return;
      const parsed = parsePreviewBackup(raw, localDateString(new Date()));
      expect(parsed.valid && parsed.envelope.data.completedRhythmIds).toContain('sample-pray-together');
    });

    await user.click(within(dialog).getByRole('button', { name: 'Close details' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it('opens the matching full details dialog by keyboard and restores focus on Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    const opener = screen.getByRole('button', { name: 'Details for Pray together' });

    opener.focus();
    expect(document.activeElement).toBe(opener);
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Pray together' });
    expect(document.activeElement).toBe(dialog);
    expect(within(dialog).getByText('Take a quiet moment to pray together and begin the day connected.')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Tend Pray together' })).toBeTruthy();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it('undoes only the selected card completion and persists Tend and Undo across reloads', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Tend Pray together' }));
    await user.click(screen.getByRole('button', { name: 'Tend Daily connection' }));
    await waitFor(() => {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
      expect(raw).not.toBeNull();
      if (!raw) return;
      const parsed = parsePreviewBackup(raw, localDateString(new Date()));
      expect(parsed.valid && parsed.envelope.data.completedRhythmIds).toEqual([
        'sample-pray-together',
        'sample-connect'
      ]);
    });

    unmount();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tended Pray together' }).matches(':disabled')).toBe(true);
      expect(screen.getByRole('button', { name: 'Tended Daily connection' }).matches(':disabled')).toBe(true);
    });

    const prayUndo = screen.getByRole('button', { name: 'Undo completion for Pray together' });
    prayUndo.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tend Pray together' }));
    expect(screen.getByRole('button', { name: 'Tended Daily connection' }).matches(':disabled')).toBe(true);
    await waitFor(() => {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
      expect(raw).not.toBeNull();
      if (!raw) return;
      const parsed = parsePreviewBackup(raw, localDateString(new Date()));
      expect(parsed.valid && parsed.envelope.data.completedRhythmIds).toEqual(['sample-connect']);
    });

    cleanup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tend Pray together' }).matches(':disabled')).toBe(false);
      expect(screen.getByRole('button', { name: 'Tended Daily connection' }).matches(':disabled')).toBe(true);
    });
    expect(screen.getByText('1 of 3 tended')).toBeTruthy();
  });

  it('tends and undoes from full details with shared state and restores focus after Undo', async () => {
    const user = userEvent.setup();
    render(<App />);
    const opener = screen.getByRole('button', { name: 'Details for Pray together' });
    await user.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Pray together' });
    expect(within(dialog).queryByRole('button', { name: 'Undo completion for Pray together' })).toBeNull();
    const dialogTend = within(dialog).getByRole('button', { name: 'Tend Pray together' });
    await user.click(dialogTend);
    expect(within(dialog).getByRole('button', { name: 'Tended Pray together' }).matches(':disabled')).toBe(true);
    expect(within(screen.getByRole('article', { name: 'Pray together' }))
      .getByRole('button', { name: 'Tended Pray together' }).matches(':disabled')).toBe(true);
    await waitFor(() => {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
      expect(raw).not.toBeNull();
      if (!raw) return;
      const parsed = parsePreviewBackup(raw, localDateString(new Date()));
      expect(parsed.valid && parsed.envelope.data.completedRhythmIds).toContain('sample-pray-together');
    });

    const dialogUndo = within(dialog).getByRole('button', { name: 'Undo completion for Pray together' });
    dialogUndo.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Tend Pray together' }));
    expect(within(dialog).getByRole('button', { name: 'Tend Pray together' }).matches(':disabled')).toBe(false);
    expect(within(screen.getByRole('article', { name: 'Pray together' }))
      .getByRole('button', { name: 'Tend Pray together' }).matches(':disabled')).toBe(false);
    expect(screen.getByText('0 of 3 tended')).toBeTruthy();
    await waitFor(() => {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
      expect(raw).not.toBeNull();
      if (!raw) return;
      const parsed = parsePreviewBackup(raw, localDateString(new Date()));
      expect(parsed.valid && parsed.envelope.data.completedRhythmIds).not.toContain('sample-pray-together');
    });
  });

  it('switches plan tabs and filters the sample Rhythms', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('tab', { name: 'Anytime' }));
    expect(screen.getByRole('tabpanel').textContent).toContain('No anytime Rhythms in this sample.');
    await user.click(screen.getByRole('tab', { name: 'Scheduled' }));

    await user.type(screen.getByRole('searchbox', { name: 'Search sample Rhythms' }), 'walk');
    expect(screen.getByRole('article', { name: 'Take a walk' })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Pray together' })).toBeNull();
  });

  it('moves focus and selection through plan tabs with arrows, Home, and End', async () => {
    const user = userEvent.setup();
    render(<App />);

    const scheduled = screen.getByRole('tab', { name: 'Scheduled' });
    const anytime = screen.getByRole('tab', { name: 'Anytime' });
    const allDay = screen.getByRole('tab', { name: 'All-day' });
    const panel = screen.getByRole('tabpanel');

    expect(scheduled.getAttribute('aria-selected')).toBe('true');
    expect(scheduled.getAttribute('tabindex')).toBe('0');
    expect(panel.getAttribute('aria-labelledby')).toBe(scheduled.id);

    scheduled.focus();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(allDay);
    expect(allDay.getAttribute('aria-selected')).toBe('true');
    expect(allDay.getAttribute('tabindex')).toBe('0');
    expect(scheduled.getAttribute('tabindex')).toBe('-1');

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(scheduled);
    expect(scheduled.getAttribute('aria-selected')).toBe('true');

    await user.keyboard('{End}');
    expect(document.activeElement).toBe(allDay);
    expect(panel.getAttribute('aria-labelledby')).toBe(allDay.id);

    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(scheduled);
    expect(scheduled.getAttribute('aria-selected')).toBe('true');
    expect(anytime.getAttribute('tabindex')).toBe('-1');
  });

  it('creates and edits a synthetic Rhythm, preserving its identity and completion across reload', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    const addButton = screen.getByRole('button', { name: 'Add Rhythm' });
    await user.click(addButton);
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    expect(within(editor).queryByRole('button', { name: /Archive/ })).toBeNull();
    await user.type(within(editor).getByLabelText('Title'), 'After-lunch walk');
    await user.type(within(editor).getByLabelText('Description (optional)'), 'A small sample habit.');
    await user.selectOptions(within(editor).getByLabelText('Cadence'), '3 times a week');
    await user.selectOptions(within(editor).getByLabelText('Time of day'), 'Afternoon');
    await user.click(within(editor).getByRole('checkbox', { name: 'Avery Brooks' }));
    await user.click(within(editor).getByRole('checkbox', { name: 'Marriage' }));
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));

    let rhythmCard = screen.getByRole('article', { name: 'After-lunch walk' });
    expect(within(rhythmCard).getByRole('button', { name: 'Open synthetic profile for Avery Brooks' })).toBeTruthy();
    expect(document.activeElement).toBe(addButton);
    await user.click(within(rhythmCard).getByRole('button', { name: 'Tend After-lunch walk' }));

    const detailsOpener = within(rhythmCard).getByRole('button', { name: 'Details for After-lunch walk' });
    await user.click(detailsOpener);
    const details = await screen.findByRole('dialog', { name: 'After-lunch walk' });
    const editButton = within(details).getByRole('button', { name: 'Edit After-lunch walk' });
    editButton.focus();
    await user.keyboard('{Enter}');
    const edit = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    const title = within(edit).getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Walk after lunch');
    await user.selectOptions(within(edit).getByLabelText('Cadence'), 'Weekly');
    await user.click(within(edit).getByRole('checkbox', { name: 'Avery Brooks' }));
    await user.click(within(edit).getByRole('checkbox', { name: 'Morgan Reed' }));
    await user.click(within(edit).getByRole('button', { name: 'Save Rhythm' }));

    expect(screen.getByRole('dialog', { name: 'Walk after lunch' })).toBe(details);
    expect(document.activeElement).toBe(editButton);
    rhythmCard = screen.getByRole('article', { name: 'Walk after lunch' });
    expect(within(rhythmCard).getByRole('button', { name: 'Tended Walk after lunch' }).matches(':disabled')).toBe(true);
    expect(within(rhythmCard).getByRole('button', { name: 'Open synthetic profile for Morgan Reed' })).toBeTruthy();

    const savedRaw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    expect(savedRaw).not.toBeNull();
    const saved = parsePreviewBackup(savedRaw!, localDateString(new Date()));
    expect(saved.valid).toBe(true);
    if (saved.valid) {
      expect(saved.envelope.schemaVersion).toBe(3);
      expect(saved.envelope.data.savedRhythms).toHaveLength(1);
      expect(saved.envelope.data.savedRhythms[0]).toMatchObject({
        id: expect.stringMatching(/^user-rhythm-/),
        title: 'Walk after lunch',
        cadence: 'Weekly',
        personIds: ['sample-person-morgan'],
        categoryIds: ['marriage']
      });
      expect(saved.envelope.data.completedRhythmIds).toContain(saved.envelope.data.savedRhythms[0]!.id);
    }

    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    const marriageRhythm = screen.getByRole('article', { name: 'Walk after lunch' });
    expect(within(marriageRhythm).getByRole('button', { name: 'Tended Walk after lunch' }).matches(':disabled')).toBe(true);
    const suggestion = screen.getByRole('article', { name: 'Dream Together' });
    expect(within(suggestion).queryByRole('button', { name: /Tend/ })).toBeNull();
    expect(within(suggestion).getByRole('button', { name: 'Details for Dream Together' })).toBeTruthy();

    unmount();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('article', { name: 'Walk after lunch' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Tended Walk after lunch' }).matches(':disabled')).toBe(true);
    });
  });

  it('validates Rhythm fields, cancels without saving, and restores focus to Add Rhythm', async () => {
    const user = userEvent.setup();
    render(<App />);
    const addButton = screen.getByRole('button', { name: 'Add Rhythm' });
    await user.click(addButton);
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(within(editor).getByText('Enter a Rhythm title.')).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).not.toContain('user-rhythm-');
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(addButton);
    expect(screen.queryByRole('article', { name: 'Add Rhythm' })).toBeNull();
  });

  it('edits a completed fixture without changing its stable completion identity', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Tend Pray together' }));
    const detailsOpener = screen.getByRole('button', { name: 'Details for Pray together' });
    await user.click(detailsOpener);
    const details = screen.getByRole('dialog', { name: 'Pray together' });
    await user.click(within(details).getByRole('button', { name: 'Edit Pray together' }));
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.selectOptions(within(editor).getByLabelText('Cadence'), 'Weekly');
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(within(details).getByRole('button', { name: 'Tended Pray together' }).matches(':disabled')).toBe(true);
    expect(screen.getByRole('article', { name: 'Pray together' }).textContent).toContain('Tended today');
    await waitFor(() => {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
      expect(raw).not.toBeNull();
      if (!raw) return;
      const parsed = parsePreviewBackup(raw, localDateString(new Date()));
      expect(parsed.valid && parsed.envelope.data.completedRhythmIds).toContain('sample-pray-together');
    });
  });

  it('archives a saved fixture without saving cancelled edits, then restores its identity and history', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Tend Pray together' }));
    await user.click(screen.getByRole('button', { name: 'Details for Pray together' }));
    const details = screen.getByRole('dialog', { name: 'Pray together' });
    await user.click(within(details).getByRole('button', { name: 'Edit Pray together' }));

    let editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    const title = within(editor).getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Updated prayer rhythm');
    await user.click(within(editor).getByRole('checkbox', { name: 'Marriage' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    expect(screen.getByRole('dialog', { name: 'Updated prayer rhythm' })).toBe(details);
    await user.click(within(details).getByRole('button', { name: 'Edit Updated prayer rhythm' }));
    editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    const unsavedTitle = within(editor).getByLabelText('Title');
    await user.clear(unsavedTitle);
    await user.type(unsavedTitle, 'Unsaved title must not be archived');
    const archiveButton = within(editor).getByRole('button', { name: 'Archive Updated prayer rhythm' });
    expect(archiveButton.textContent).toBe('Archive');
    const actionRow = archiveButton.parentElement;
    expect(actionRow?.querySelector('.rhythm-editor__primary-actions')?.contains(
      within(editor).getByRole('button', { name: 'Save Rhythm' })
    )).toBe(true);
    expect(actionRow?.contains(archiveButton)).toBe(true);
    archiveButton.focus();
    await user.keyboard('{Enter}');

    const confirmation = screen.getByRole('alertdialog', { name: 'Archive Updated prayer rhythm?' });
    expect(within(confirmation).getByText(/leave active Today and category lists/)).toBeTruthy();
    expect(document.activeElement).toBe(within(confirmation).getByRole('button', { name: 'Confirm archive Updated prayer rhythm' }));
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(archiveButton);
    expect((within(editor).getByLabelText('Title') as HTMLInputElement).value)
      .toBe('Unsaved title must not be archived');
    await waitFor(() => {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
      expect(raw).not.toBeNull();
      if (!raw) return;
      const parsed = parsePreviewBackup(raw, localDateString(new Date()));
      expect(parsed.valid && parsed.envelope.data.savedRhythms[0]).toMatchObject({
        id: 'sample-pray-together',
        title: 'Updated prayer rhythm',
        personIds: ['sample-person-avery', 'sample-person-morgan'],
        categoryIds: ['marriage']
      });
      expect(parsed.valid && parsed.envelope.data.archivedRhythmIds).toEqual([]);
    });

    archiveButton.focus();
    await user.keyboard('{Enter}');
    const confirmAgain = screen.getByRole('alertdialog', { name: 'Archive Updated prayer rhythm?' });
    const confirmArchiveButton = within(confirmAgain).getByRole('button', { name: 'Confirm archive Updated prayer rhythm' });
    confirmArchiveButton.focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog', { name: 'Edit Rhythm' })).toBeNull();
    expect(within(details).getByRole('status').textContent).toMatch(/Archived/);
    expect(document.activeElement).toBe(within(details).getByRole('button', { name: 'Close details' }));
    expect(within(details).queryByRole('button', { name: 'Tend Updated prayer rhythm' })).toBeNull();
    await waitFor(() => {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
      expect(raw).not.toBeNull();
      if (!raw) return;
      const parsed = parsePreviewBackup(raw, localDateString(new Date()));
      expect(parsed.valid && parsed.envelope.data.savedRhythms[0]).toMatchObject({
        id: 'sample-pray-together',
        title: 'Updated prayer rhythm',
        personIds: ['sample-person-avery', 'sample-person-morgan'],
        categoryIds: ['marriage']
      });
      expect(parsed.valid && parsed.envelope.data.completedRhythmIds).toContain('sample-pray-together');
      expect(parsed.valid && parsed.envelope.data.archivedRhythmIds).toEqual(['sample-pray-together']);
    });

    await user.click(within(details).getByRole('button', { name: 'Close details' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.queryByRole('article', { name: 'Updated prayer rhythm' })).toBeNull();
    await user.click(within(screen.getByRole('navigation', { name: 'Tools and navigation' })).getByRole('button', { name: 'Today' }));
    const archivedToggle = screen.getByRole('button', { name: 'Archived rhythms (1)' });
    await user.click(archivedToggle);
    const archiveDialog = screen.getByRole('dialog', { name: 'Archived rhythms' });
    const archivedCard = screen.getByRole('article', { name: 'Updated prayer rhythm' });
    expect(within(archivedCard).getByText('Archived', { exact: true })).toBeTruthy();
    expect(within(archivedCard).queryByRole('button', { name: /^Tend/ })).toBeNull();
    expect(within(archivedCard).getByRole('button', { name: 'Details for Updated prayer rhythm' })).toBeTruthy();
    expect(within(archivedCard).getByRole('button', { name: 'Open synthetic profile for Avery Brooks' })).toBeTruthy();
    expect(within(archivedCard).queryByRole('button', { name: /Undo completion/ })).toBeNull();
    const detailsOpener = within(archivedCard).getByRole('button', { name: 'Details for Updated prayer rhythm' });
    detailsOpener.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Archived rhythms' })).toBe(archiveDialog);
    const archivedDetails = within(archiveDialog).getByRole('region', { name: 'Updated prayer rhythm' });
    expect(within(archiveDialog).getByRole('status').textContent).toBe('Archived · identity and history are retained.');
    expect(within(archivedDetails).getByRole('heading', { name: 'Updated prayer rhythm' })).toBeTruthy();
    expect(within(archivedDetails).getByText('Archived', { exact: true })).toBeTruthy();
    expect(within(archivedDetails).getByText('Take a quiet moment to pray together and begin the day connected.')).toBeTruthy();
    expect(within(archivedDetails).getByRole('button', { name: 'Open synthetic profile for Avery Brooks' })).toBeTruthy();
    expect(within(archivedDetails).getByRole('button', {
      name: 'View history for Updated prayer rhythm; illustrative score unavailable'
    })).toBeTruthy();
    expect(within(archivedDetails).getByText('Daily')).toBeTruthy();
    expect(within(archivedDetails).queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(within(archivedDetails).queryByRole('button', { name: 'Tend Updated prayer rhythm' })).toBeNull();
    expect(within(archivedDetails).queryByRole('button', { name: /Undo completion/ })).toBeNull();
    expect(within(archivedDetails).queryByRole('button', { name: 'Close details' })).toBeNull();
    expect(within(archiveDialog).getAllByRole('button', { name: /Close/ })).toHaveLength(1);
    const archivedHistory = within(archivedDetails).getByRole('button', {
      name: 'View history for Updated prayer rhythm; illustrative score unavailable'
    });
    await user.click(archivedHistory);
    expect(within(archivedDetails).getByText('History is unavailable for this sample.')).toBeTruthy();
    await user.click(within(archivedDetails).getByRole('button', { name: 'Back' }));
    expect(document.activeElement).toBe(within(archivedDetails).getByRole('button', {
      name: 'View history for Updated prayer rhythm; illustrative score unavailable'
    }));
    const backToList = within(archiveDialog).getByRole('button', { name: 'Back to archived rhythms' });
    expect(archivedDetails.compareDocumentPosition(backToList) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(backToList.parentElement?.classList.contains('today-rhythm-details__surface')).toBe(false);
    await user.click(backToList);
    expect(document.activeElement).toBe(detailsOpener);

    const restoreButton = within(archiveDialog).getByRole('button', {
      name: 'Restore rhythm Updated prayer rhythm'
    });
    restoreButton.focus();
    await user.keyboard('{Enter}');
    expect(within(archiveDialog).getByRole('heading', { name: 'No archived Rhythms' })).toBeTruthy();
    expect(document.activeElement).toBe(within(archiveDialog).getByRole('heading', { name: 'No archived Rhythms' }));
    expect(screen.getByRole('article', { name: 'Updated prayer rhythm' })).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Updated prayer rhythm' })).queryByText('Archived', { exact: true })).toBeNull();
    expect(screen.getByText('1 of 3 tended')).toBeTruthy();
    await waitFor(() => {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
      expect(raw).not.toBeNull();
      if (!raw) return;
      const parsed = parsePreviewBackup(raw, localDateString(new Date()));
      expect(parsed.valid && parsed.envelope.data.archivedRhythmIds).toEqual([]);
      expect(parsed.valid && parsed.envelope.data.savedRhythms.filter(rhythm => rhythm.id === 'sample-pray-together')).toHaveLength(1);
      expect(parsed.valid && parsed.envelope.data.completedRhythmIds).toContain('sample-pray-together');
    });

    await user.click(within(archiveDialog).getByRole('button', { name: 'Close archived rhythms' }));
    expect(document.activeElement).toBe(archivedToggle);
    cleanup();
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('article', { name: 'Updated prayer rhythm' })).toBeTruthy();
      expect(screen.getByText('1 of 3 tended')).toBeTruthy();
    });
    expect(screen.getAllByRole('article', { name: 'Updated prayer rhythm' })).toHaveLength(1);
  });

  it('opens the empty Archived rhythms modal from the real button by keyboard and returns focus on close and Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    const toggle = screen.getByRole('button', { name: 'Archived rhythms (0)' });

    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const dialog = screen.getByRole('dialog', { name: 'Archived rhythms' });
    expect(within(dialog).getByRole('heading', { name: 'No archived Rhythms' })).toBeTruthy();
    expect(within(dialog).getByText('Rhythms you archive will appear here with their history preserved.')).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close archived rhythms' }));

    await user.keyboard(' ');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog', { name: 'Archived rhythms' })).toBeNull();
    expect(document.activeElement).toBe(toggle);

    await user.keyboard('{Enter}');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const reopenedDialog = screen.getByRole('dialog', { name: 'Archived rhythms' });
    expect(within(reopenedDialog).getByRole('heading', { name: 'No archived Rhythms' })).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Archived rhythms' })).toBeNull());
    expect(document.activeElement).toBe(toggle);
  });

  it('moves focus to the next Restore control and then the empty-state heading', async () => {
    const user = userEvent.setup();
    const [first, second] = todayRhythms;
    const onRestore = vi.fn();
    const callbacks = {
      completedRhythms: new Set<string>(),
      onPersonSelect: () => {},
      onRestore,
      onClose: () => {}
    };
    const { rerender } = render(
      <ArchivedRhythmsDialog rhythms={[first!, second!]} {...callbacks} />
    );

    await user.click(screen.getByRole('button', { name: `Restore rhythm ${first!.title}` }));
    expect(onRestore).toHaveBeenCalledWith(first!.id);
    rerender(<ArchivedRhythmsDialog rhythms={[second!]} {...callbacks} />);
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: `Restore rhythm ${second!.title}` })
      );
    });

    await user.click(screen.getByRole('button', { name: `Restore rhythm ${second!.title}` }));
    rerender(<ArchivedRhythmsDialog rhythms={[]} {...callbacks} />);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'No archived Rhythms' }));
    });
  });

  it('opens Finances examples, adds a direction-validated goal, and records a dated balance', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Finances' }));
    expect(screen.getByRole('heading', { name: 'Goal examples' })).toBeTruthy();
    expect(screen.getByText(/Examples only · taxonomy not finalized/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Add example goal' }));
    const editor = screen.getByRole('dialog', { name: 'Add example goal' });
    await user.type(within(editor).getByLabelText('Title'), 'Car payoff');
    await user.selectOptions(within(editor).getByLabelText('Goal direction'), 'decrease');
    await user.type(within(editor).getByLabelText('Starting balance'), '100.00');
    fireEvent.change(within(editor).getByLabelText('Starting date'), { target: { value: '2026-10-01' } });
    await user.type(within(editor).getByLabelText('Target balance'), '120.00');
    fireEvent.change(within(editor).getByLabelText('Target date'), { target: { value: '2027-01-01' } });
    await user.click(within(editor).getByRole('button', { name: 'Add goal' }));
    expect(within(editor).getByText('A decreasing goal needs a target below its starting balance.')).toBeTruthy();

    const target = within(editor).getByLabelText('Target balance');
    await user.clear(target);
    await user.type(target, '80.00');
    await user.click(within(editor).getByRole('button', { name: 'Add goal' }));

    let goal = screen.getByRole('article', { name: 'Car payoff' });
    expect(within(goal).getByText('No check-ins yet')).toBeTruthy();
    await user.click(within(goal).getByRole('button', { name: 'Record check-in' }));
    const checkIn = screen.getByRole('dialog', { name: 'Record balance check-in' });
    expect((within(checkIn).getByLabelText('Effective date') as HTMLInputElement).value).toBe(localDateString(new Date()));
    await user.type(within(checkIn).getByLabelText('Current balance'), '90.00');
    await user.type(within(checkIn).getByLabelText('Note (optional)'), 'Manual sample observation');
    await user.click(within(checkIn).getByRole('button', { name: 'Save check-in' }));

    expect(within(goal).getByText('$90.00')).toBeTruthy();
    expect(within(goal).getByText('$10.00 remaining')).toBeTruthy();
    expect(within(goal).getByText('Manual sample observation')).toBeTruthy();

    await user.click(within(goal).getByRole('button', { name: 'Edit goal' }));
    const editGoal = screen.getByRole('dialog', { name: 'Edit example goal' });
    const title = within(editGoal).getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Car payoff example');
    await user.click(within(editGoal).getByRole('button', { name: 'Save goal' }));
    goal = screen.getByRole('article', { name: 'Car payoff example' });
    expect(within(goal).getByText('$90.00')).toBeTruthy();
    expect(within(goal).getByText('Manual sample observation')).toBeTruthy();
  });

  it('corrects a same-date check-in with history and restores it after remount', async () => {
    const user = userEvent.setup();
    const openFinances = async () => {
      await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Finances' }));
    };
    render(<App />);
    await openFinances();
    let goal = screen.getByRole('article', { name: 'Starter reserve' });
    await user.click(within(goal).getAllByRole('button', { name: 'Correct' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Correct balance check-in' });
    expect(within(dialog).getByRole('status').textContent).toContain('retains the previous value');
    expect(within(dialog).getByRole('status').textContent).toContain('date is fixed');
    expect(within(dialog).getByLabelText('Effective date').hasAttribute('readonly')).toBe(true);
    const balance = within(dialog).getByLabelText('Current balance');
    await user.clear(balance);
    await user.type(balance, '1350.00');
    await user.click(within(dialog).getByRole('button', { name: 'Save correction' }));

    goal = screen.getByRole('article', { name: 'Starter reserve' });
    expect(within(goal).getByText('$1,350.00')).toBeTruthy();
    expect(within(goal).getByText(/previous value \$1,250\.00/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Today' }));
    await openFinances();
    expect(within(screen.getByRole('article', { name: 'Starter reserve' })).getByText('$1,350.00')).toBeTruthy();

    cleanup();
    render(<App />);
    await openFinances();
    expect(within(screen.getByRole('article', { name: 'Starter reserve' })).getByText('$1,350.00')).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Starter reserve' })).getByText(/previous value \$1,250\.00/)).toBeTruthy();
  });

  it('routes unimplemented destinations to an explicit placeholder and back to Today', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Faith' }));
    expect(screen.getByRole('heading', { name: 'Faith' })).toBeTruthy();
    expect(screen.getByText('This destination is not implemented in this preview.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Back to Today' }));
    expect(screen.getByRole('heading', { name: 'Your plan' })).toBeTruthy();
  });

  it('shows a representative Marriage overview and routes its partner shortcut to the explicit People placeholder', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    expect(screen.getByRole('heading', { name: 'Marriage' })).toBeTruthy();
    expect(screen.getByText('Synthetic example')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Your partner/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Overall Marriage health' })).toBeTruthy();
    expect(screen.getByText('Illustrative sample values · not calculated')).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Illustrative Marriage sample score, not calculated' }).getAttribute('aria-valuenow')).toBe('78');
    expect(screen.getByRole('tab', { name: 'Today' }).getAttribute('aria-selected')).toBe('true');
    const page = screen.getByRole('main', { name: 'Marriage' });
    const ids = [...page.querySelectorAll('[id]')].map(element => element.id);
    expect(new Set(ids).size).toBe(ids.length);

    await user.click(screen.getByRole('button', { name: /Your partner/ }));
    expect(screen.getByRole('heading', { name: 'People' })).toBeTruthy();
    expect(screen.getByText('This destination is not implemented in this preview.')).toBeTruthy();
  });

  it('navigates Marriage tabs with arrows, Home and End and preserves accessible panel labels', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));

    const today = screen.getByRole('tab', { name: 'Today' });
    const rhythms = screen.getByRole('tab', { name: 'Rhythms' });
    const foundations = screen.getByRole('tab', { name: 'Foundations' });
    const tabs = screen.getByRole('tablist', { name: 'Marriage content' });
    today.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(rhythms);
    expect(rhythms.getAttribute('aria-selected')).toBe('true');
    expect(rhythms.getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(rhythms.id);

    await user.keyboard('{End}');
    expect(document.activeElement).toBe(foundations);
    expect(foundations.getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(today);
    expect(tabs.querySelectorAll('[role="tab"][tabindex="0"]')).toHaveLength(1);
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(foundations);
    expect(foundations.getAttribute('aria-selected')).toBe('true');
  });

  it('shows read-only Today invitation, synthetic weekly strip and Today-together Rhythms', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));

    expect(screen.getByText('A small invitation · example')).toBeTruthy();
    expect(screen.getByText(marriageExampleFixtures.populated.today!.topic)).toBeTruthy();
    expect(screen.getByText(marriageExampleFixtures.populated.today!.prompt)).toBeTruthy();
    const week = screen.getByRole('group', { name: 'Synthetic example activity by day' });
    expect(within(week).getAllByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/)).toHaveLength(7);
    expect(screen.getByText('2 of 5 sample connections this week')).toBeTruthy();
    expect(screen.getByText(/Tending, editing the prompt, and changing settings are unavailable/)).toBeTruthy();
    const dailyConnection = screen.getByRole('article', { name: 'Daily Connection' });
    expect(within(dailyConnection).getByText('Last tended Oct 20')).toBeTruthy();
    expect(
      within(dailyConnection)
        .getByRole('button', { name: 'Open synthetic profile for Avery Brooks' })
        .querySelector('.person-badge-name')?.textContent
    ).toBe('Avery');
    expect(within(dailyConnection).getByRole('button', { name: 'Details for Daily Connection' })).toBeTruthy();
    expect(within(dailyConnection).queryByRole('button', { name: /Tend/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Tend/ })).toBeNull();
  });

  it('groups read-only sample Rhythm suggestions by cadence and keeps the Today panel unchanged', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));

    expect(screen.getByRole('heading', { name: 'Daily Connection', level: 4 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Weekly Investment', level: 4 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Seasonal & Annual', level: 4 })).toBeTruthy();
    expect(screen.getAllByText('Suggested sample')).toHaveLength(marriageRhythms.length);
    expect(screen.getByText(/These suggestions are not added or scheduled/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add|Tend/ })).toBeNull();
    const suggestion = screen.getByRole('article', { name: 'Dream Together' });
    expect(within(suggestion).getByRole('button', { name: 'Details for Dream Together' })).toBeTruthy();
    expect(within(suggestion).queryByRole('button', { name: /Tend/ })).toBeNull();
  });

  it('associates sample Rhythms by stable foundation identity and exposes ongoing empty foundations', async () => {
    const user = userEvent.setup();
    const communicationRhythms = rhythmsSupportingFoundation(marriageRhythms, 'communication');
    expect(communicationRhythms.map(rhythm => rhythm.id)).toEqual(['sample-marriage-connection']);
    expect(rhythmsSupportingFoundation(marriageRhythms, 'intimacy')).toHaveLength(1);
    expect(rhythmsSupportingFoundation(marriageRhythms, 'partnership').map(rhythm => rhythm.id)).toEqual(['sample-marriage-dream']);
    expect(marriageFoundations.map(foundation => foundation.id)).toEqual([
      'connection', 'communication', 'fun-adventure', 'spiritual-growth', 'partnership', 'intimacy'
    ]);

    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Foundations' }));
    const openDetail = screen.getByRole('button', { name: /Open Connection foundation details, illustrative score 82 out of 100/ });
    expect(openDetail.querySelector('button')).toBeNull();
    expect(openDetail.querySelector('.foundation-card__score')?.textContent).toBe('82');
    expect(openDetail.querySelector('.foundation-progress__fill')?.getAttribute('style')).toContain('width: 82%');
    expect(openDetail.querySelector('.preview-score-marker')).toBeNull();
    expect(openDetail.querySelector('.foundation-card__coverage')?.textContent).toBe('3 of 3 supporting Rhythms have sample values');
    openDetail.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement?.textContent).toBe('Connection');
    expect(screen.getByRole('meter', { name: 'Connection illustrative score' }).getAttribute('aria-valuenow')).toBe('82');
    expect(screen.getByRole('heading', { name: 'Supporting Rhythms · 3' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Primary associations · 1' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Secondary associations · 2' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Daily Connection' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Date Night' })).toBeTruthy();
    expect(within(document.querySelector('.marriage-foundation-support')!).queryByText(/sample score · .*not calculated/)).toBeNull();
    const rhythmOpener = screen.getByRole('button', { name: 'Details for Daily Connection' });
    await user.click(rhythmOpener);
    const rhythmDialog = await screen.findByRole('dialog', { name: 'Daily Connection' });
    const historyButton = within(rhythmDialog).getByRole('button', {
      name: 'View history for Daily Connection; illustrative score 82'
    });
    await user.click(historyButton);
    expect(within(rhythmDialog).getByRole('heading', { name: 'Dated history' })).toBeTruthy();
    expect(within(rhythmDialog).getByText('Tuesday, October 20, 2026')).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(rhythmOpener);

    await user.click(screen.getByRole('button', { name: '‹ All Foundations' }));
    expect((document.activeElement as HTMLButtonElement).id).toBe('marriage-foundation-select-connection');
    expect(screen.getByRole('button', { name: /Open Connection foundation details/ })).toBeTruthy();
  });

  it('shares the populated and empty Marriage example selector on Today and Marriage without persisting it', async () => {
    const user = userEvent.setup();
    render(<App />);
    const areas = within(screen.getByRole('navigation', { name: 'Areas' }));
    const selector = screen.getByRole('combobox', { name: 'Marriage example' });
    expect((selector as HTMLSelectElement).value).toBe('populated');
    const savedPreviewBeforeSelection = window.localStorage.getItem(PREVIEW_STORAGE_KEY);

    selector.focus();
    await user.selectOptions(selector, 'empty');
    expect((selector as HTMLSelectElement).value).toBe('empty');
    expect(document.activeElement).toBe(selector);
    const getMarriageTodayButton = () => screen.getAllByRole('button', { name: 'Marriage' }).find(button => button.classList.contains('menu-area'))!;
    let marriageTodayBadge = getMarriageTodayButton().querySelector('.ma-score');
    expect(marriageTodayBadge?.textContent).toBe('—');
    expect(getMarriageTodayButton().getAttribute('aria-description')).toContain('score unavailable');
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(savedPreviewBeforeSelection);

    await user.click(areas.getByRole('button', { name: 'Marriage' }));
    expect((screen.getByRole('combobox', { name: 'Marriage example' }) as HTMLSelectElement).value).toBe('empty');
    expect(screen.getByRole('meter', { name: 'Marriage sample score unavailable' }).getAttribute('aria-valuenow')).toBeNull();
    expect(screen.getByText('No sample scores available in this example.')).toBeTruthy();
    expect(screen.getByText('No sample invitation or topic is available.')).toBeTruthy();
    expect(screen.getByText('No sample Rhythms are planned for today.')).toBeTruthy();
    expect(screen.getByText('—', { selector: '.category-health-score' })).toBeTruthy();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Marriage example' }), 'populated');
    expect(screen.getByText('78', { selector: '.category-health-score' })).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(savedPreviewBeforeSelection);
    await user.click(within(screen.getByRole('navigation', { name: 'Tools and navigation' })).getByRole('button', { name: 'Today' }));
    marriageTodayBadge = getMarriageTodayButton().querySelector('.ma-score');
    expect(marriageTodayBadge?.textContent).toBe('78');
    expect((screen.getByRole('combobox', { name: 'Marriage example' }) as HTMLSelectElement).value).toBe('populated');
  });

  it('keeps one fixture as the source for score coverage, associations, and weekly history', () => {
    const populated = marriageExampleFixtures.populated;
    const empty = marriageExampleFixtures.empty;
    expect(populated.rhythms.map(rhythm => rhythm.illustrativeScore)).toEqual([82, 68, 0, null]);
    expect(marriageScoreCoverage(populated.rhythms.map(rhythm => rhythm.illustrativeScore))).toEqual({ scored: 3, total: 4 });
    expect(marriageScoreCoverage(empty.rhythms.map(rhythm => rhythm.illustrativeScore))).toEqual({ scored: 0, total: 0 });
    expect(marriageFoundationCoverage(populated, 'connection')).toEqual({ scored: 3, total: 3 });
    expect(marriageFoundationCoverage(populated, 'partnership')).toEqual({ scored: 0, total: 1 });
    expect(marriageFoundationCoverage(empty, 'connection')).toEqual({ scored: 0, total: 0 });
    expect(marriageWeekDays(populated).filter(day => day.state === 'sample' || day.state === 'today-sample').map(day => day.date)).toEqual([
      '2026-10-18', '2026-10-20'
    ]);
    expect(marriageWeekDays(populated).find(day => day.state === 'today')?.date).toBe('2026-10-21');
    expect(marriageWeekDays(empty).filter(day => day.state === 'sample')).toHaveLength(0);
    for (const rhythm of populated.rhythms) {
      for (const foundationId of [rhythm.primaryFoundationId, ...(rhythm.secondaryFoundationIds ?? [])]) {
        expect(populated.foundations.some(foundation => foundation.id === foundationId)).toBe(true);
      }
    }
  });

  it('renders the empty fixture with all six stable Foundations and explicit empty states', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Marriage example' }), 'empty');
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.getAllByText('0 suggested')).toHaveLength(3);
    expect(screen.getAllByText('No sample suggestions in this group.')).toHaveLength(3);
    await user.click(screen.getByRole('tab', { name: 'Foundations' }));

    const cards = screen.getAllByRole('button').filter(card => card.classList.contains('foundation-card--interactive'));
    expect(cards.map(card => card.querySelector('[role="heading"]')?.textContent)).toEqual([
      'Connection', 'Communication', 'Fun & Adventure', 'Spiritual Growth', 'Partnership', 'Intimacy'
    ]);
    expect(cards.filter(card => card.querySelector('[role="meter"]') === null)).toHaveLength(6);
    expect(screen.getAllByText('No supporting sample Rhythms')).toHaveLength(6);
    expect(screen.getByText('Ongoing areas of care; no sample scores are available.')).toBeTruthy();
    expect(cards[0]?.getAttribute('aria-label')).toContain('score unavailable');
    expect(cards[0]?.querySelector('.foundation-card__score')?.textContent).toBe('—');
    await user.click(cards[0]!);
    expect(await screen.findByText(/No sample Rhythms are assigned to this ongoing Foundation yet/)).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Connection illustrative score' }).getAttribute('aria-valuetext')).toBe('Score unavailable');
  });

  it('shows the zero score separately from unavailable scores and empty dated history', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    const prayCard = screen.getByRole('article', { name: 'Pray Together' });
    expect(within(prayCard).queryByText(/sample score/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Details for Pray Together' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pray Together' });
    const zeroScoreHistory = within(dialog).getByRole('button', {
      name: 'View history for Pray Together; illustrative score 0'
    });
    expect(zeroScoreHistory.textContent).toContain('0');
    await user.click(zeroScoreHistory);
    expect(within(dialog).getByText('No sample completions recorded.')).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Details for Dream Together' }));
    const dreamDialog = await screen.findByRole('dialog', { name: 'Dream Together' });
    const unavailableScoreHistory = within(dreamDialog).getByRole('button', {
      name: 'View history for Dream Together; illustrative score unavailable'
    });
    expect(unavailableScoreHistory.textContent).toContain('—');
    await user.click(unavailableScoreHistory);
    expect(within(dreamDialog).getByRole('list').querySelectorAll('li')).toHaveLength(1);
  });

  it('shows newest-first dated Marriage history in the shared dialog and restores opener focus', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    const opener = screen.getByRole('button', { name: 'Details for Daily Connection' });
    await user.click(opener);

    const dialog = await screen.findByRole('dialog', { name: 'Daily Connection' });
    const historyButton = within(dialog).getByRole('button', {
      name: 'View history for Daily Connection; illustrative score 82'
    });
    await user.click(historyButton);
    const historyRegion = within(dialog).getByRole('region', { name: 'Sample completion history for Daily Connection' });
    const history = within(historyRegion).getByRole('list');
    const dates = [...history.querySelectorAll('li')].map(item => item.textContent);
    expect(dates).toEqual(['Tuesday, October 20, 2026', 'Sunday, October 18, 2026', 'Saturday, October 17, 2026']);
    expect(within(dialog).queryByRole('button', { name: /^Tend/ })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /^Undo/ })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(document.activeElement).toBe(within(dialog).getByRole('button', {
      name: 'View history for Daily Connection; illustrative score 82'
    }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(opener);

    await user.click(screen.getByRole('button', { name: 'Details for Pray Together' }));
    const emptyHistoryDialog = await screen.findByRole('dialog', { name: 'Pray Together' });
    await user.click(within(emptyHistoryDialog).getByRole('button', {
      name: 'View history for Pray Together; illustrative score 0'
    }));
    expect(within(emptyHistoryDialog).getByText('No sample completions recorded.')).toBeTruthy();
    expect(within(emptyHistoryDialog).queryByRole('button', { name: /^Tend/ })).toBeNull();
  });

  it('orders dated completion records without mutating the source history', () => {
    const history = [
      { id: 'b', effectiveDate: '2026-10-10' },
      { id: 'c', effectiveDate: '2026-10-11' },
      { id: 'a', effectiveDate: '2026-10-10' }
    ];
    expect(orderedCompletions(history).map(item => item.id)).toEqual(['c', 'a', 'b']);
    expect(history.map(item => item.id)).toEqual(['b', 'c', 'a']);
  });

  it('increases the Today text size with the mobile display control', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /text size: small/i }));
    expect(document.documentElement.dataset.mobileTextSize).toBe('large');
    expect(document.documentElement.dataset.mobileTextSizeLevel).toBe('medium');
  });
});
