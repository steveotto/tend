import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { CatalogApp } from '../src/CatalogApp.tsx';
import { ArchivedRhythmsDialog } from '../src/components/ArchivedRhythmsDialog.tsx';
import { localDateString } from '../src/domain/money-goals.ts';
import { addCalendarDays } from '../src/domain/rhythm-scoring.ts';
import { localDateTimeInZone } from '../src/domain/rhythm-completion.ts';
import { createRhythmSeason, rhythmSeasonPaletteForOrdinal } from '../src/domain/rhythm-seasons.ts';
import { activeIdForMarriageSuggestion } from '../src/domain/category-rhythms.ts';
import { hasFoundationIcon } from '../src/components/MarriageIcon.tsx';
import type { SavedRhythm } from '../src/domain/rhythm-editor.ts';
import type { DatedRhythmCompletion } from '../src/domain/rhythm-completion.ts';
import {
  marriageExampleFixtures,
  marriageFoundationCoverage,
  marriageFoundations,
  marriageRhythms,
  marriageRhythmSuggestions,
  parentingRhythmSuggestions,
  faithPractices,
  faithRhythmSuggestionGroups,
  faithRhythmSuggestions,
  parentingFoundations,
  marriageScoreCoverage,
  marriageWeekDays,
  orderedCompletions,
  rhythmsSupportingFoundation,
  todayRhythms
} from '../src/domain/preview-data.ts';
import {
  createPreviewEnvelope,
  createSamplePreviewData,
  parsePreviewBackup,
  PREVIEW_SCHEMA_VERSION
} from '../src/domain/preview-state.ts';
import { PREVIEW_STORAGE_KEY, PREVIEW_V5_RECOVERY_KEY } from '../src/storage/preview-storage.ts';
import { installMemoryStorage, type MemoryStorage } from './memory-storage.ts';
import { historyButtonName } from './history-button-name.ts';

beforeEach(installMemoryStorage);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
  vi.useRealTimers();
});

async function saveCardCompletion(user: ReturnType<typeof userEvent.setup>, rhythmTitle: string) {
  await user.click(screen.getByRole('button', { name: `Tend ${rhythmTitle}` }));
  const dialog = await screen.findByRole('dialog', { name: 'When did you tend it?' });
  await user.click(within(dialog).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'When did you tend it?' })).toBeNull());
}

function inclusiveCalendarDays(startDate: string, endDate: string): number {
  return Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1;
}

function suggestionRow(picker: HTMLElement, title: string): HTMLElement {
  return within(picker).getByRole('heading', { name: title, level: 4 }).closest('li')!;
}

function associationPicker(title: string): HTMLElement {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return screen.getByRole('dialog', { name: new RegExp(`^${escapedTitle}$`, 'i') });
}

function cancelNativeDialog(dialog: HTMLElement): void {
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
}

async function openPreviewSettings(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'More, settings' }));
  await user.click(await screen.findByRole('button', { name: 'Settings' }));
}

function savedMarriageRhythm(
  id: string,
  title: string,
  foundationIds: readonly string[] = ['connection']
): SavedRhythm {
  return {
    id,
    title,
    cadence: 'Daily',
    timeLabel: 'Anytime',
    timeOfDay: 'anytime',
    personIds: [],
    categoryIds: ['marriage'],
    schedule: { frequency: 'daily' },
    primaryFoundationId: foundationIds[0] ?? null,
    secondaryFoundationIds: foundationIds.slice(1)
  };
}

function savedParentingRhythm(
  id: string,
  title: string,
  categoryIds: readonly ('marriage' | 'parenting')[] = ['parenting'],
  foundationIds: readonly string[] = []
): SavedRhythm {
  return {
    id,
    title,
    cadence: 'Daily',
    timeLabel: 'Anytime',
    timeOfDay: 'anytime',
    personIds: [],
    categoryIds: [...categoryIds],
    schedule: { frequency: 'daily' },
    primaryFoundationId: foundationIds[0] ?? null,
    secondaryFoundationIds: foundationIds.slice(1)
  };
}

function savedSharedFaithMarriageRhythm(id: string, title: string): SavedRhythm {
  return {
    id,
    title,
    cadence: 'Daily',
    timeLabel: 'Anytime',
    timeOfDay: 'anytime',
    personIds: [],
    categoryIds: ['faith', 'marriage'],
    schedule: { frequency: 'daily' },
    primaryFoundationId: 'faith-prayer',
    secondaryFoundationIds: ['spiritual-growth']
  };
}

function seasonDeletionFixture() {
  const today = new Date().toISOString().slice(0, 10);
  const trackingStartDate = addCalendarDays(today, -30);
  const rhythmId = 'user-rhythm-60000000-0000-4000-8000-000000000001';
  const firstSchedule = { frequency: 'daily' as const };
  const middleSchedule = { frequency: 'weekly' as const, weekdays: [1, 3, 5] as (1 | 3 | 5)[] };
  const currentSchedule = { frequency: 'weekly' as const, weekdays: [2, 4] as (2 | 4)[] };
  const first = {
    ...createRhythmSeason(
      rhythmId,
      trackingStartDate,
      firstSchedule,
      'morning',
      'season-delete-first',
      rhythmSeasonPaletteForOrdinal(0)
    ),
    name: 'First Season',
    note: 'preserve first note'
  };
  const middle = {
    ...createRhythmSeason(
      rhythmId,
      addCalendarDays(today, -20),
      middleSchedule,
      'afternoon',
      'season-delete-middle',
      rhythmSeasonPaletteForOrdinal(1)
    ),
    name: 'Middle Season',
    note: 'preserve middle note'
  };
  const current = {
    ...createRhythmSeason(
      rhythmId,
      addCalendarDays(today, -10),
      currentSchedule,
      'evening',
      'season-delete-current',
      rhythmSeasonPaletteForOrdinal(2)
    ),
    name: 'Current Season',
    note: 'preserve current note'
  };
  const data = createSamplePreviewData();
  data.savedRhythms.push({
    id: rhythmId,
    title: 'Season deletion fixture',
    cadence: 'Every week on Tuesday and Thursday.',
    timeLabel: 'Evening',
    timeOfDay: 'evening',
    personIds: [],
    categoryIds: [],
    schedule: currentSchedule,
    scoring: {
      trackingStartDate,
      timeZone: 'UTC',
      scheduleHistory: [first, middle, current]
    },
    createdLocalDate: trackingStartDate,
    createdTimeZone: 'UTC'
  });
  data.rhythmHistoryIds.push(rhythmId);
  const dates = [
    addCalendarDays(today, -29),
    addCalendarDays(today, -18),
    addCalendarDays(today, -15),
    addCalendarDays(today, -8),
    addCalendarDays(today, -3)
  ];
  const records: DatedRhythmCompletion[] = dates.map((effectiveDate, index) => {
    const completedAt = `${effectiveDate}T${String(8 + index).padStart(2, '0')}:15:00.000Z`;
    return {
      id: `season-delete-log-${index + 1}`,
      rhythmId,
      effectiveDate,
      localTime: `${String(8 + index).padStart(2, '0')}:15`,
      timeZone: 'UTC',
      completedAt,
      recordedAt: new Date(Date.parse(completedAt) + 1_000 + index).toISOString(),
      memory: `Saved note ${index + 1}`
    };
  });
  data.datedRhythmCompletions.push(...records);
  return { data, today, rhythmId, first, middle, current, records };
}

describe('Tend Today preview', () => {
  it('keeps preview controls out of everyday routes and exposes them in More → Settings', async () => {
    const user = userEvent.setup();
    const envelope = createPreviewEnvelope(createSamplePreviewData());
    const originalRaw = JSON.stringify(envelope);
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, originalRaw);
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');

    expect(screen.queryByRole('button', { name: 'Export preview backup' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More, settings' }));
    expect(await screen.findByRole('heading', { name: 'More' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Export preview backup' })).toBeNull();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Settings' })).toBe(document.activeElement);
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Preview data' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export preview backup' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset sample data' })).toBeTruthy();
    expect(screen.getByText(/separate from your live Tend account/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '‹ More' }));
    expect(await screen.findByRole('heading', { name: 'More' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'More' }));
    expect(screen.queryByRole('button', { name: 'Export preview backup' })).toBeNull();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
  });

  it('opens a linked Foundation directly from a Today card and restores Marriage return context', async () => {
    const user = userEvent.setup();
    const data = createSamplePreviewData();
    data.savedRhythms = [
      savedMarriageRhythm('sample-pray-together', 'Pray together', ['intimacy', 'connection'])
    ];
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');

    await user.click(screen.getByRole('button', { name: 'Marriage: Connection' }));
    expect(await screen.findByRole('heading', { name: 'Linked Rhythms · 1', level: 3 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Connection', level: 3 })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '‹ All Foundations' }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Today' }).getAttribute('aria-selected')).toBe('true');
    });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Today' }));
  });

  it('navigates to the associated Category from a Today Rhythm badge', async () => {
    const user = userEvent.setup();
    const data = createSamplePreviewData();
    const rhythm = savedMarriageRhythm('sample-pray-together', 'Pray together', ['intimacy']);
    rhythm.categoryIds = ['parenting'];
    data.savedRhythms = [rhythm];
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');

    await user.click(document.getElementById('rhythm-category-badge-sample-pray-together-parenting')!);
    expect(await screen.findByRole('heading', { name: 'Parenting' })).toBeTruthy();
  });

  it('restores the originating Marriage tab after opening a Foundation from shared Rhythm history', async () => {
    const user = userEvent.setup();
    const data = createSamplePreviewData();
    data.savedRhythms = [
      savedMarriageRhythm(
        'user-rhythm-83000000-0000-4000-8000-000000000001',
        'History navigation sample',
        ['connection']
      )
    ];
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');

    await user.click(screen.getAllByRole('button', { name: 'Marriage' })[1]!);
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', {
      name: historyButtonName('View scores and history for History navigation sample')
    }));
    await user.click(screen.getAllByRole('button', { name: 'Marriage: Connection' })[1]!);
    expect(await screen.findByRole('heading', { name: 'Connection', level: 3 })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '‹ All Foundations' }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Rhythms' }).getAttribute('aria-selected')).toBe('true');
    });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Rhythms' }));
  });

  it('shows Parenting as an empty shared Category with six mapped Foundations and its shared suggestion catalogue', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Parenting' }));

    expect(screen.getByRole('heading', { name: 'Parenting' })).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Parenting content' })).toBeTruthy();
    expect(within(document.getElementById('parenting-panel-today')!).getByText('No active Rhythms.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add Rhythm' })).toBeNull();
    expect(screen.getByRole('meter', { name: 'Parenting Health score' }).getAttribute('aria-valuenow')).toBeNull();
    expect(screen.getByText('No scored Foundations yet')).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.getByRole('heading', { name: 'Start with a rhythm.' })).toBeTruthy();
    const addRhythm = screen.getByRole('button', { name: 'Add Rhythm' });
    expect(screen.getByRole('button', { name: 'Browse suggestions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Archived rhythms (0)' })).toBeTruthy();
    await user.click(addRhythm);
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    expect(within(editor).getByRole('button', { name: /Choose categories, Parenting/ })).toBeTruthy();
    expect(within(editor).queryByText(/Suggested Rhythm draft/)).toBeNull();
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add Rhythm' })).toBeNull());
    expect(document.activeElement).toBe(addRhythm);

    await user.click(screen.getByRole('tab', { name: 'Foundations' }));
    for (const foundation of parentingFoundations) {
      expect(screen.getByRole('heading', { name: foundation.name })).toBeTruthy();
      expect(screen.getByText(foundation.description)).toBeTruthy();
      expect(hasFoundationIcon(foundation.iconId!)).toBe(true);
    }
    expect(document.querySelectorAll('#parenting-panel-foundations .foundation-card--interactive')).toHaveLength(6);
  });

  it('shows all Parenting suggestions in the shared picker and keeps every review draft cancelable', async () => {
    const user = userEvent.setup();
    const initialData = createSamplePreviewData();
    const initialRaw = JSON.stringify(createPreviewEnvelope(initialData));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, initialRaw);
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Parenting' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Browse suggestions' }));

    const picker = screen.getByRole('dialog', { name: 'Parenting rhythms' });
    const expectedGroups = {
      'Daily Connection': ['Daily Connection', 'Prayer & Conversation'],
      'Weekly & Regular': ['Walk Together', 'One-on-One Time', 'Encouraging Text', 'Call & Catch Up', 'Life-Stage Check-In'],
      'Seasonal & Annual': ['Special Outing', 'Teach a Life Skill', 'Trip Together']
    };
    for (const [groupTitle, titles] of Object.entries(expectedGroups)) {
      const group = within(picker).getByRole('heading', { name: groupTitle, level: 3 }).closest('section')!;
      expect([...group.querySelectorAll('.rhythm-suggestion-picker__details h4')].map(heading => heading.textContent))
        .toEqual(titles);
    }

    for (const suggestion of parentingRhythmSuggestions) {
      const currentPicker = screen.getByRole('dialog', { name: 'Parenting rhythms' });
      const row = suggestionRow(currentPicker, suggestion.title);
      expect(within(row).getByText(suggestion.description)).toBeTruthy();
      expect(within(row).getByText(suggestion.scheduleHint)).toBeTruthy();
      expect(row.querySelector('.rhythm-suggestion-picker__icon .marriage-svg-icon')).toBeTruthy();
      expect(within(row).queryByText(/Added/)).toBeNull();
      await user.click(within(row).getByRole('button', { name: 'Add' }));

      const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
      expect((within(editor).getByLabelText('Title') as HTMLInputElement).value).toBe(suggestion.title);
      expect((within(editor).getByLabelText('Description (optional)') as HTMLTextAreaElement).value)
        .toBe(suggestion.description);
      expect(within(editor).getByRole('combobox', { name: 'Time of day: Anytime' })).toBeTruthy();
      expect(within(editor).getByRole('button', { name: /^Choose people$/ })).toBeTruthy();
      expect(within(editor).getByRole('button', { name: /Choose categories, Parenting/ })).toBeTruthy();

      const foundationButton = within(editor).getByRole('button', { name: /^Choose foundations/ });
      const foundationLabel = foundationButton.getAttribute('aria-label') ?? '';
      const expectedFoundations = [
        suggestion.primaryFoundationId,
        ...suggestion.secondaryFoundationIds
      ];
      for (const foundationId of expectedFoundations) {
        const foundation = parentingFoundations.find(item => item.id === foundationId)!;
        expect(foundationLabel).toContain(foundation.name);
      }

      const expectedFrequency = suggestion.recommendedFrequency === 'every-two-weeks'
        ? 'Custom'
        : suggestion.recommendedFrequency === 'quarterly' || suggestion.recommendedFrequency === 'yearly'
          ? suggestion.recommendedFrequency[0]!.toUpperCase() + suggestion.recommendedFrequency.slice(1)
          : suggestion.recommendedFrequency === 'daily'
            ? 'Daily'
            : 'Weekly';
      expect(within(editor).getByRole('combobox', { name: `Frequency: ${expectedFrequency}` })).toBeTruthy();
      if (suggestion.recommendedFrequency === 'weekly') {
        expect(within(editor).getByText('Choose one day.')).toBeTruthy();
      } else if (suggestion.recommendedFrequency === 'every-two-weeks') {
        expect((within(editor).getByLabelText('Repeat every') as HTMLInputElement).value).toBe('2');
        expect(within(editor).getByRole('combobox', { name: 'Repeat interval unit: weeks' })).toBeTruthy();
        await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
        expect(within(editor).getByText('Choose at least one day.')).toBeTruthy();
      } else if (suggestion.recommendedFrequency === 'quarterly') {
        expect(within(editor).getByRole('combobox', { name: 'Quarter months: Choose months' })).toBeTruthy();
        expect(within(editor).getByRole('combobox', { name: 'Repeat on: Choose a pattern' })).toBeTruthy();
      } else if (suggestion.recommendedFrequency === 'yearly') {
        expect(within(editor).getByRole('combobox', { name: 'Repeat on: Choose a pattern' })).toBeTruthy();
        expect(within(editor).getByText('Choose a pattern first.')).toBeTruthy();
      }
      if (suggestion.frequencyGuidance) {
        expect(within(editor).getByText(suggestion.frequencyGuidance)).toBeTruthy();
      }

      await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add Rhythm' })).toBeNull());
      expect(within(suggestionRow(
        screen.getByRole('dialog', { name: 'Parenting rhythms' }),
        suggestion.title
      )).getByRole('button', { name: 'Add' })).toBeTruthy();
      expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(initialRaw);
    }
    cancelNativeDialog(picker);
  });

  it('creates independent Parenting instances for two children, edits a source-linked Rhythm, and retains it after reload', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Parenting' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Browse suggestions' }));

    let picker = screen.getByRole('dialog', { name: 'Parenting rhythms' });
    let row = suggestionRow(picker, 'Walk Together');
    expect(within(row).queryByText(/Added/)).toBeNull();
    await user.click(within(row).getByRole('button', { name: 'Add' }));
    let editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    await user.click(within(editor).getByRole('button', { name: /^Choose people$/ }));
    let association = associationPicker('Choose people');
    await user.click(within(association).getByRole('button', { name: 'Jordan Bell' }));
    await user.click(within(association).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('radio', { name: 'Tuesday' }));
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));

    picker = screen.getByRole('dialog', { name: 'Parenting rhythms' });
    row = suggestionRow(picker, 'Walk Together');
    expect(within(row).getByText('Added')).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Add' })).toBeTruthy();
    await user.click(within(row).getByRole('button', { name: 'Add' }));
    expect(within(picker).getByRole('heading', { name: 'You’ve added Walk Together' })).toBeTruthy();
    expect(within(picker).getByText('Jordan Bell')).toBeTruthy();
    await user.click(within(picker).getByRole('button', { name: '＋ Add another' }));

    editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    expect(within(editor).getByRole('button', { name: /^Choose people$/ })).toBeTruthy();
    expect(within(editor).getByRole('button', {
      name: /^Choose foundations, Parenting: Connection & Belonging and Parenting: Communication & Trust$/
    }))
      .toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: /^Choose people$/ }));
    association = associationPicker('Choose people');
    await user.click(within(association).getByRole('button', { name: 'Morgan Reed' }));
    await user.click(within(association).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: /^Choose foundations/ }));
    association = associationPicker('Choose foundations');
    const communication = within(association).getByRole('button', { name: 'Communication & Trust' });
    expect(communication.getAttribute('aria-pressed')).toBe('true');
    await user.click(communication);
    await user.click(within(association).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('radio', { name: 'Wednesday' }));
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));

    picker = screen.getByRole('dialog', { name: 'Parenting rhythms' });
    expect(within(picker).getByRole('heading', { name: 'You’ve added Walk Together' })).toBeTruthy();
    expect(within(picker).getByText('Jordan Bell')).toBeTruthy();
    expect(within(picker).getByText('Morgan Reed')).toBeTruthy();
    await user.click(within(picker).getByRole('button', { name: 'Back' }));
    picker = screen.getByRole('dialog', { name: 'Parenting rhythms' });
    row = suggestionRow(picker, 'Walk Together');
    expect(within(row).getByText('2 added')).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Add' })).toBeTruthy();
    await user.click(within(row).getByRole('button', { name: 'Add' }));

    picker = screen.getByRole('dialog', { name: 'Parenting rhythms' });
    const jordanInstance = within(within(picker).getByRole('list', { name: 'Active instances' }))
      .getAllByRole('listitem')
      .find(instance => instance.textContent?.includes('Jordan Bell'))!;
    await user.click(within(jordanInstance).getByRole('button', { name: 'Edit Walk Together' }));
    editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.clear(within(editor).getByLabelText('Title'));
    await user.type(within(editor).getByLabelText('Title'), 'Walk with Jordan');
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    picker = screen.getByRole('dialog', { name: 'Parenting rhythms' });
    expect(within(picker).getByRole('button', { name: 'Edit Walk with Jordan' })).toBeTruthy();
    await user.click(within(picker).getByRole('button', { name: 'Back' }));

    const saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    const instances = saved.envelope.data.savedRhythms.filter(rhythm =>
      rhythm.suggestionSourceId === 'parenting.walk-together'
    );
    expect(instances).toHaveLength(2);
    expect(new Set(instances.map(rhythm => rhythm.id)).size).toBe(2);
    const jordanRhythm = instances.find(rhythm => rhythm.personIds.includes('sample-person-jordan'));
    const morganRhythm = instances.find(rhythm => rhythm.personIds.includes('sample-person-morgan'));
    expect(jordanRhythm?.schedule).toMatchObject({ frequency: 'weekly', weekdays: [2] });
    expect(morganRhythm?.schedule).toMatchObject({ frequency: 'weekly', weekdays: [3] });
    expect(jordanRhythm).toMatchObject({
      title: 'Walk with Jordan',
      categoryIds: ['parenting'],
      primaryFoundationId: 'parenting-connection-belonging',
      secondaryFoundationIds: ['parenting-communication-trust']
    });
    expect(morganRhythm).toMatchObject({
      title: 'Walk Together',
      primaryFoundationId: 'parenting-connection-belonging',
      secondaryFoundationIds: []
    });

    unmount();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Parenting' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Browse suggestions' }));
    picker = screen.getByRole('dialog', { name: 'Parenting rhythms' });
    row = suggestionRow(picker, 'Walk Together');
    expect(within(row).getByText('2 added')).toBeTruthy();
    await user.click(within(row).getByRole('button', { name: 'Add' }));
    picker = screen.getByRole('dialog', { name: 'Parenting rhythms' });
    expect(within(picker).getByText('Walk with Jordan')).toBeTruthy();
    expect(within(picker).getByText('Jordan Bell')).toBeTruthy();
    expect(within(picker).getByText('Morgan Reed')).toBeTruthy();
    cancelNativeDialog(picker);
  });

  it('shows an empty Faith Category with its shared Practice cards and suggestion catalogue', async () => {
    const user = userEvent.setup();
    render(<App />);
    const savedPreview = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Faith' }));

    expect(screen.getByRole('heading', { name: 'Faith' })).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Faith content' })).toBeTruthy();
    expect(within(document.getElementById('faith-panel-today')!).getByText('No active Rhythms.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add Rhythm' })).toBeNull();
    expect(screen.getByText('No scored Practices yet')).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Faith Health score' }).getAttribute('aria-valuenow')).toBeNull();
    expect(screen.queryByText('No scored Foundations yet')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Show Faith scoring explanation' }));
    const explanation = screen.getByRole('region', { name: 'Faith Health explanation' });
    expect(within(explanation).getByText(
      'Your score reflects follow-through on your chosen practices—not the strength of your faith.'
    )).toBeTruthy();
    expect(within(explanation).getByText('Each scored Practice counts equally.')).toBeTruthy();
    expect(within(explanation).getByText('Practices need both scores to count.')).toBeTruthy();
    expect(within(explanation).getByText('75%')).toBeTruthy();
    expect(within(explanation).getByText('25%')).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.getByRole('heading', { name: 'Start with a rhythm.' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Browse suggestions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Archived rhythms (0)' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add Rhythm' }));
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    expect(within(editor).getByRole('button', { name: /Choose categories, Faith/ })).toBeTruthy();
    expect(within(editor).getByRole('button', { name: 'Choose Practices' })).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('tab', { name: 'Practices' }));
    for (const practice of faithPractices) {
      expect(screen.getByRole('heading', { name: practice.name })).toBeTruthy();
      expect(screen.getByText(practice.description)).toBeTruthy();
      expect(hasFoundationIcon(practice.iconId!)).toBe(true);
    }
    expect(screen.queryByText('Other')).toBeNull();
    expect(document.querySelectorAll('#faith-panel-foundations .foundation-card--interactive')).toHaveLength(9);
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(savedPreview);
  });

  it('shows all Faith suggestions with editable recommendations and cancelable review drafts', async () => {
    const user = userEvent.setup();
    const initialData = createSamplePreviewData();
    const initialRaw = JSON.stringify(createPreviewEnvelope(initialData));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, initialRaw);
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Faith' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Browse suggestions' }));

    const picker = screen.getByRole('dialog', { name: 'Faith practice suggestions' });
    for (const group of faithRhythmSuggestionGroups) {
      const section = within(picker).getByRole('heading', { name: group.title, level: 3 }).closest('section')!;
      expect([...section.querySelectorAll('.rhythm-suggestion-picker__details h4')].map(heading => heading.textContent))
        .toEqual(faithRhythmSuggestions.filter(suggestion => suggestion.groupId === group.id)
          .map(suggestion => suggestion.title));
    }

    for (const suggestion of faithRhythmSuggestions) {
      const row = suggestionRow(screen.getByRole('dialog', { name: 'Faith practice suggestions' }), suggestion.title);
      expect(within(row).getByText(suggestion.description)).toBeTruthy();
      expect(within(row).getByText(suggestion.scheduleHint)).toBeTruthy();
      expect(row.querySelector('.rhythm-suggestion-picker__icon .marriage-svg-icon')).toBeTruthy();
      expect(within(row).queryByText(/Added/)).toBeNull();
      await user.click(within(row).getByRole('button', { name: 'Add' }));

      const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
      expect((within(editor).getByLabelText('Title') as HTMLInputElement).value).toBe(suggestion.title);
      expect((within(editor).getByLabelText('Description (optional)') as HTMLTextAreaElement).value)
        .toBe(suggestion.description);
      expect(within(editor).getByRole('combobox', { name: 'Time of day: Anytime' })).toBeTruthy();
      expect(within(editor).getByRole('button', { name: /^Choose people$/ })).toBeTruthy();
      expect(within(editor).getByRole('button', { name: /Choose categories, Faith/ })).toBeTruthy();
      const practice = faithPractices.find(item => item.id === suggestion.primaryFoundationId)!;
      expect(within(editor).getByRole('button', { name: `Choose practices, Faith: ${practice.name}` })).toBeTruthy();

      const expectedFrequency = suggestion.recommendedFrequency === 'daily'
        ? 'Daily'
        : suggestion.recommendedFrequency === 'select-days'
          ? 'Select Days'
          : suggestion.recommendedFrequency[0]!.toUpperCase() + suggestion.recommendedFrequency.slice(1);
      expect(within(editor).getByRole('combobox', { name: `Frequency: ${expectedFrequency}` })).toBeTruthy();
      if (suggestion.recommendedFrequency === 'weekly') {
        expect(within(editor).getByText('Choose one day.')).toBeTruthy();
      } else if (suggestion.recommendedFrequency === 'select-days') {
        await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
        expect(within(editor).getByText('Choose at least one day.')).toBeTruthy();
      } else if (suggestion.recommendedFrequency === 'monthly') {
        expect(within(editor).getByRole('combobox', { name: 'Repeat on: Choose a pattern' })).toBeTruthy();
        await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
        expect(within(editor).getByText('Choose a pattern first.')).toBeTruthy();
      }

      await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add Rhythm' })).toBeNull());
      expect(within(suggestionRow(
        screen.getByRole('dialog', { name: 'Faith practice suggestions' }),
        suggestion.title
      )).getByRole('button', { name: 'Add' })).toBeTruthy();
      expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(initialRaw);
    }
  });

  it('creates independent Faith instances, edits an existing Rhythm, and retains source identity after reload', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Faith' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Browse suggestions' }));

    let picker = screen.getByRole('dialog', { name: 'Faith practice suggestions' });
    let row = suggestionRow(picker, 'Pray Together');
    await user.click(within(row).getByRole('button', { name: 'Add' }));
    let editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));

    picker = screen.getByRole('dialog', { name: 'Faith practice suggestions' });
    row = suggestionRow(picker, 'Pray Together');
    expect(within(row).getByText('Added')).toBeTruthy();
    await user.click(within(row).getByRole('button', { name: 'Add' }));
    expect(within(picker).getByRole('heading', { name: 'You’ve added Pray Together' })).toBeTruthy();
    const instances = within(picker).getByRole('list', { name: 'Active instances' });
    const existing = within(instances).getAllByRole('listitem')[0]!;
    expect(within(existing).getByText('Pray Together')).toBeTruthy();
    expect(within(existing).getByText('Every day')).toBeTruthy();
    await user.click(within(existing).getByRole('button', { name: 'Edit Pray Together' }));

    editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.clear(within(editor).getByLabelText('Title'));
    await user.type(within(editor).getByLabelText('Title'), 'Pray Together at Home');
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    picker = screen.getByRole('dialog', { name: 'Faith practice suggestions' });
    expect(within(picker).getByRole('button', { name: 'Edit Pray Together at Home' })).toBeTruthy();
    await user.click(within(picker).getByRole('button', { name: '＋ Add another' }));

    editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    expect((within(editor).getByLabelText('Title') as HTMLInputElement).value).toBe('Pray Together');
    expect(within(editor).getByRole('button', { name: /^Choose people$/ })).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));

    picker = screen.getByRole('dialog', { name: 'Faith practice suggestions' });
    await user.click(within(picker).getByRole('button', { name: 'Back' }));
    picker = screen.getByRole('dialog', { name: 'Faith practice suggestions' });
    expect(within(suggestionRow(picker, 'Pray Together')).getByText('2 added')).toBeTruthy();
    await user.click(within(suggestionRow(picker, 'Pray Together')).getByRole('button', { name: 'Add' }));
    picker = screen.getByRole('dialog', { name: 'Faith practice suggestions' });
    expect(within(picker).getByText('Pray Together at Home')).toBeTruthy();
    expect(within(picker).getByText('Pray Together')).toBeTruthy();
    cancelNativeDialog(picker);

    const saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    const linkedInstances = saved.envelope.data.savedRhythms.filter(rhythm =>
      rhythm.suggestionSourceId === 'faith.pray-together'
    );
    expect(linkedInstances).toHaveLength(2);
    expect(new Set(linkedInstances.map(rhythm => rhythm.id)).size).toBe(2);
    expect(linkedInstances.map(rhythm => rhythm.title).sort()).toEqual([
      'Pray Together',
      'Pray Together at Home'
    ]);
    expect(linkedInstances.every(rhythm =>
      rhythm.categoryIds.includes('faith')
      && rhythm.primaryFoundationId === 'faith-prayer'
      && rhythm.schedule?.frequency === 'daily'
    )).toBe(true);

    unmount();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Faith' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Browse suggestions' }));
    picker = screen.getByRole('dialog', { name: 'Faith practice suggestions' });
    expect(within(suggestionRow(picker, 'Pray Together')).getByText('2 added')).toBeTruthy();
    await user.click(within(suggestionRow(picker, 'Pray Together')).getByRole('button', { name: 'Add' }));
    picker = screen.getByRole('dialog', { name: 'Faith practice suggestions' });
    expect(within(picker).getByText('Pray Together at Home')).toBeTruthy();
    expect(within(picker).getByText('Pray Together')).toBeTruthy();
    cancelNativeDialog(picker);
  });

  it('distinguishes an active Faith Rhythm that is not scheduled today from an empty Category', async () => {
    const user = userEvent.setup();
    const nextWeekday = ((new Date().getDay() + 1) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const data = createSamplePreviewData();
    data.savedRhythms = [{
      id: 'user-rhythm-00000000-0000-4000-8000-000000000001',
      title: 'Sunday reflection',
      cadence: 'Weekly',
      timeLabel: 'Anytime',
      timeOfDay: 'anytime',
      personIds: [],
      categoryIds: ['faith'],
      schedule: { frequency: 'weekly', weekdays: [nextWeekday] }
    }];
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');

    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Faith' }));
    expect(within(document.getElementById('faith-panel-today')!)
      .getByText('All caught up. Nothing to tend to.')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.getByRole('article', { name: 'Sunday reflection' })).toBeTruthy();
  });

  it('creates, tends, edits, archives and restores a Faith Rhythm through shared flows', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Faith' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    const add = screen.getByRole('button', { name: 'Add Rhythm' });
    await user.click(add);
    let editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    await user.type(within(editor).getByLabelText('Title'), 'Morning prayer');
    await user.type(within(editor).getByLabelText('Description (optional)'), 'Make a quiet space to listen.');
    await user.click(within(editor).getByRole('button', { name: 'Choose Practices' }));
    const picker = associationPicker('Choose Practices');
    await user.click(within(picker).getByRole('button', { name: 'Prayer' }));
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));

    const saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    expect(saved.envelope.data.savedRhythms).toMatchObject([{
      title: 'Morning prayer',
      description: 'Make a quiet space to listen.',
      categoryIds: ['faith'],
      primaryFoundationId: 'faith-prayer'
    }]);

    await user.click(screen.getByRole('tab', { name: 'Practices' }));
    await user.click(screen.getByRole('button', { name: /Open Prayer practice details/ }));
    expect(screen.getByRole('heading', { name: 'Linked Rhythms · 1' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Morning prayer' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '‹ All Practices' }));
    await user.click(screen.getByRole('tab', { name: 'Today' }));
    await saveCardCompletion(user, 'Morning prayer');
    let rhythmCard = screen.getByRole('article', { name: 'Morning prayer' });
    const historyOpener = within(rhythmCard).getByRole('button', {
      name: historyButtonName('View scores and history for Morning prayer')
    });
    await user.click(historyOpener);
    const history = screen.getByRole('region', { name: 'History for Morning prayer' });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    expect(within(history).getByRole('heading', { name: 'Seasons' })).toBeTruthy();
    await user.click(within(history).getByRole('button', { name: 'Close details' }));
    await waitFor(() => expect(document.activeElement).toBe(historyOpener));

    await user.click(within(screen.getByRole('article', { name: 'Morning prayer' }))
      .getByRole('button', { name: 'Edit Morning prayer' }));
    editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.clear(within(editor).getByLabelText('Description (optional)'));
    await user.type(within(editor).getByLabelText('Description (optional)'), 'Keep making room to listen.');
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(within(screen.getByRole('article', { name: 'Morning prayer' }))
      .getByText('Keep making room to listen.')).toBeTruthy();

    await user.click(within(screen.getByRole('article', { name: 'Morning prayer' }))
      .getByRole('button', { name: 'Edit Morning prayer' }));
    editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.click(within(editor).getByRole('button', { name: 'Archive Morning prayer' }));
    await user.click(screen.getByRole('button', { name: 'Confirm archive Morning prayer' }));
    expect(screen.queryByRole('article', { name: 'Morning prayer' })).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Archived rhythms (1)' }));
    const archive = screen.getByRole('dialog', { name: 'Archived rhythms' });
    await user.click(within(archive).getByRole('button', { name: 'Restore rhythm Morning prayer' }));
    expect(await screen.findByRole('article', { name: 'Morning prayer' })).toBeTruthy();

    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Faith' }));
    await user.click(screen.getByRole('tab', { name: 'Practices' }));
    await user.click(screen.getByRole('button', { name: /Open Prayer practice details/ }));
    expect(screen.getByRole('article', { name: 'Morning prayer' })).toBeTruthy();
    rhythmCard = screen.getByRole('article', { name: 'Morning prayer' });
    expect(within(rhythmCard).getByRole('button', {
      name: 'Faith Practice: Prayer'
    })).toBeTruthy();
    const reloaded = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(reloaded.valid).toBe(true);
    if (reloaded.valid) {
      expect(reloaded.envelope.data.archivedRhythmIds).toEqual([]);
      expect(reloaded.envelope.data.completedRhythmIds).toHaveLength(1);
      expect(reloaded.envelope.data.savedRhythms).toMatchObject([{
        title: 'Morning prayer',
        description: 'Keep making room to listen.',
        categoryIds: ['faith'],
        primaryFoundationId: 'faith-prayer'
      }]);
    }
  });

  it('keeps one shared Faith/Marriage Rhythm and removes only Faith links through the shared confirmation', async () => {
    const user = userEvent.setup();
    const data = createSamplePreviewData();
    const rhythm = savedSharedFaithMarriageRhythm(
      'user-rhythm-84000000-0000-4000-8000-000000000022',
      'Pray together'
    );
    data.savedRhythms = [rhythm];
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');

    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Faith' }));
    await user.click(screen.getByRole('tab', { name: 'Practices' }));
    const prayerPractice = screen.getByRole('button', { name: /Open Prayer practice details/ });
    await user.click(prayerPractice);
    expect(screen.getByRole('heading', { name: 'Linked Rhythms · 1' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Pray together' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '‹ All Practices' }));
    await waitFor(() => expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Open Prayer practice details/ })
    ));

    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.getAllByRole('article', { name: 'Pray together' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Edit Pray together' }));
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.click(within(editor).getByRole('button', { name: 'Choose categories, Faith and Marriage' }));
    const categoryPicker = associationPicker('Choose categories');
    await user.click(within(categoryPicker).getByRole('button', { name: 'Faith' }));
    const removal = associationPicker('Remove Faith?');
    expect(within(removal).getByText(/This also unlinks Prayer/)).toBeTruthy();
    await user.click(within(removal).getByRole('button', { name: 'Remove' }));
    await user.click(within(associationPicker('Choose categories'))
      .getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    const saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    expect(saved.envelope.data.savedRhythms).toMatchObject([{
      id: rhythm.id,
      categoryIds: ['marriage'],
      primaryFoundationId: 'spiritual-growth',
      secondaryFoundationIds: []
    }]);
    const roundTrip = parsePreviewBackup(
      JSON.stringify(createPreviewEnvelope(saved.envelope.data)),
      localDateString(new Date())
    );
    expect(roundTrip.valid).toBe(true);
    if (roundTrip.valid) {
      expect(roundTrip.envelope.data.savedRhythms).toMatchObject([{
        id: rhythm.id,
        categoryIds: ['marriage'],
        primaryFoundationId: 'spiritual-growth',
        secondaryFoundationIds: []
      }]);
    }

    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.getAllByRole('article', { name: 'Pray together' })).toHaveLength(1);
  });

  it('saves Parenting Foundation links across reload and shows one shared Rhythm in both Categories', async () => {
    const user = userEvent.setup();
    const data = createSamplePreviewData();
    const rhythm = savedParentingRhythm(
      'user-rhythm-84000000-0000-4000-8000-000000000001',
      'Shared family rhythm',
      ['parenting', 'marriage']
    );
    data.savedRhythms = [rhythm];
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');

    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Parenting' }));
    await user.click(screen.getByRole('tab', { name: 'Foundations' }));
    await user.click(screen.getByRole('button', { name: /Open Connection & Belonging foundation details/ }));
    await user.click(screen.getByRole('button', { name: 'Manage linked Rhythms' }));
    const manager = screen.getByRole('dialog');
    expect(within(manager).getAllByRole('checkbox')).toHaveLength(1);
    await user.click(within(manager).getByRole('checkbox', { name: /Shared family rhythm/ }));
    await user.click(within(manager).getByRole('button', { name: 'Save' }));

    const saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    expect(saved.envelope.data.savedRhythms).toMatchObject([{
      id: rhythm.id,
      categoryIds: ['parenting', 'marriage'],
      primaryFoundationId: 'parenting-connection-belonging'
    }]);

    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Parenting' }));
    await user.click(screen.getByRole('tab', { name: 'Foundations' }));
    await user.click(screen.getByRole('button', { name: /Open Connection & Belonging foundation details/ }));
    expect(screen.getByRole('heading', { name: 'Linked Rhythms · 1' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Shared family rhythm' })).toBeTruthy();

    const backup = JSON.stringify(createPreviewEnvelope(saved.envelope.data));
    const backupFile = new File([backup], 'parenting-associations.json', { type: 'application/json' });
    await openPreviewSettings(user);
    fireEvent.change(screen.getByLabelText('Import preview backup'), { target: { files: [backupFile] } });
    const importDialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    await user.click(within(importDialog).getByRole('button', { name: 'Replace with backup' }));
    await screen.findByText('Preview backup imported.');
    const imported = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(imported.valid).toBe(true);
    if (imported.valid) {
      expect(imported.envelope.data.savedRhythms).toMatchObject([{
        id: rhythm.id,
        categoryIds: ['parenting', 'marriage'],
        primaryFoundationId: 'parenting-connection-belonging'
      }]);
    }

    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.getAllByRole('article', { name: 'Shared family rhythm' })).toHaveLength(1);
  });

  it('creates, tends, edits, archives and restores a real Parenting Rhythm through shared flows', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Parenting' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Add Rhythm' }));
    let editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    await user.type(within(editor).getByLabelText('Title'), 'Parenting reading time');
    await user.type(within(editor).getByLabelText('Description (optional)'), 'Read together when it fits.');
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));

    await user.click(screen.getByRole('tab', { name: 'Today' }));
    expect(screen.getByRole('article', { name: 'Parenting reading time' })).toBeTruthy();
    await saveCardCompletion(user, 'Parenting reading time');
    const card = screen.getByRole('article', { name: 'Parenting reading time' });
    await user.click(within(card).getByRole('button', { name: 'Edit Parenting reading time' }));
    editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.clear(within(editor).getByLabelText('Description (optional)'));
    await user.type(within(editor).getByLabelText('Description (optional)'), 'Keep sharing books together.');
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(within(screen.getByRole('article', { name: 'Parenting reading time' }))
      .getByText('Keep sharing books together.')).toBeTruthy();

    await user.click(within(screen.getByRole('article', { name: 'Parenting reading time' }))
      .getByRole('button', { name: 'Edit Parenting reading time' }));
    editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.click(within(editor).getByRole('button', { name: 'Archive Parenting reading time' }));
    await user.click(screen.getByRole('button', { name: 'Confirm archive Parenting reading time' }));
    expect(screen.queryByRole('article', { name: 'Parenting reading time' })).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Archived rhythms (1)' }));
    const archive = screen.getByRole('dialog', { name: 'Archived rhythms' });
    await user.click(within(archive).getByRole('button', { name: 'Restore rhythm Parenting reading time' }));
    expect(await screen.findByRole('article', { name: 'Parenting reading time' })).toBeTruthy();
    const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY)!;
    const saved = parsePreviewBackup(raw, localDateString(new Date()));
    expect(saved.valid).toBe(true);
    if (saved.valid) {
      expect(saved.envelope.data.savedRhythms).toContainEqual(expect.objectContaining({
        title: 'Parenting reading time',
        description: 'Keep sharing books together.',
        categoryIds: ['parenting']
      }));
      expect(saved.envelope.data.archivedRhythmIds).toEqual([]);
      expect(saved.envelope.data.completedRhythmIds).toContain(saved.envelope.data.savedRhythms[0]?.id);
    }
  });

  it('adds a bounded Season range, persists it without moving logs, and undoes it safely', async () => {
    const user = userEvent.setup();
    const fixture = seasonDeletionFixture();
    const original = fixture.data.savedRhythms.find(entry => entry.id === fixture.rhythmId)!;
    const originalLogs = fixture.records.map(record => ({ ...record }));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(fixture.data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(screen.getByRole('button', {
      name: historyButtonName('View scores and history for Season deletion fixture')
    }));
    const history = screen.getByRole('region', { name: 'History for Season deletion fixture' });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    await user.click(within(history).getByRole('button', { name: 'Add a Season' }));
    const editor = screen.getByRole('dialog', { name: 'Add a season' });
    const asOfDate = localDateString(new Date());
    const rangeStart = addCalendarDays(asOfDate, -5);
    const rangeEnd = addCalendarDays(asOfDate, -3);
    fireEvent.change(within(editor).getByLabelText('Starting date'), { target: { value: rangeStart } });
    await user.click(within(editor).getByLabelText('Set an end date'));
    fireEvent.change(within(editor).getByLabelText('End date'), { target: { value: rangeEnd } });
    expect(within(editor).getByText(/will be split/)).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Apply' }));

    let saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, asOfDate);
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    let updated = saved.envelope.data.savedRhythms.find(entry => entry.id === fixture.rhythmId)!;
    expect(updated.scoring?.scheduleHistory).toHaveLength(5);
    expect(updated.scoring?.scheduleHistory.map(season => season.startDate)).toContain(rangeStart);
    expect(updated.scoring?.scheduleHistory.map(season => season.startDate)).toContain(addCalendarDays(rangeEnd, 1));
    expect(saved.envelope.data.datedRhythmCompletions).toEqual(originalLogs);

    const undoNotice = within(history).getByText('A Season change was saved. You can undo it.');
    expect(undoNotice).toBeTruthy();
    await user.click(within(history).getByRole('button', { name: 'Undo' }));
    saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, asOfDate);
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    updated = saved.envelope.data.savedRhythms.find(entry => entry.id === fixture.rhythmId)!;
    expect(updated).toEqual(original);
    expect(saved.envelope.data.datedRhythmCompletions).toEqual(originalLogs);

    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(screen.getByRole('button', {
      name: historyButtonName('View scores and history for Season deletion fixture')
    }));
    const reloaded = screen.getByRole('region', { name: 'History for Season deletion fixture' });
    await user.click(within(reloaded).getByRole('button', { name: 'Show Seasons' }));
    expect(within(reloaded).getByText('3 seasons')).toBeTruthy();
    expect(parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, asOfDate).valid).toBe(true);
  });

  it('reloads a persisted Add Season timeline without duplicating its fragments', async () => {
    const user = userEvent.setup();
    const fixture = seasonDeletionFixture();
    const originalLogs = fixture.records.map(record => ({ ...record }));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(fixture.data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(screen.getByRole('button', {
      name: historyButtonName('View scores and history for Season deletion fixture')
    }));
    let history = screen.getByRole('region', { name: 'History for Season deletion fixture' });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    await user.click(within(history).getByRole('button', { name: 'Add a Season' }));
    const editor = screen.getByRole('dialog', { name: 'Add a season' });
    const rangeStart = addCalendarDays(localDateString(new Date()), -5);
    const rangeEnd = addCalendarDays(rangeStart, 2);
    fireEvent.change(within(editor).getByLabelText('Starting date'), { target: { value: rangeStart } });
    await user.click(within(editor).getByLabelText('Set an end date'));
    fireEvent.change(within(editor).getByLabelText('End date'), { target: { value: rangeEnd } });
    await user.click(within(editor).getByRole('button', { name: 'Apply' }));
    const savedRaw = window.localStorage.getItem(PREVIEW_STORAGE_KEY)!;
    const firstLoad = parsePreviewBackup(savedRaw, localDateString(new Date()));
    expect(firstLoad.valid).toBe(true);
    if (!firstLoad.valid) return;
    expect(firstLoad.envelope.data.savedRhythms.find(entry => entry.id === fixture.rhythmId)
      ?.scoring?.scheduleHistory).toHaveLength(5);
    expect(firstLoad.envelope.data.datedRhythmCompletions).toEqual(originalLogs);

    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(screen.getByRole('button', {
      name: historyButtonName('View scores and history for Season deletion fixture')
    }));
    history = screen.getByRole('region', { name: 'History for Season deletion fixture' });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    expect(within(history).getByText('5 seasons')).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(savedRaw);
    expect(within(history).getAllByRole('article')).toHaveLength(5);
  });

  it('persists name-only Season corrections, clears names explicitly, and keeps boundaries and logs intact', async () => {
    const user = userEvent.setup();
    const fixture = seasonDeletionFixture();
    const originalSeasons = fixture.data.savedRhythms.find(entry => entry.id === fixture.rhythmId)!.scoring!
      .scheduleHistory;
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(fixture.data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const card = screen.getByRole('article', { name: 'Season deletion fixture' });
    await user.click(within(card).getByRole('button', {
      name: historyButtonName('View scores and history for Season deletion fixture')
    }));
    let history = within(screen.getByRole('dialog', { name: 'Season deletion fixture' }))
      .getByRole('region', { name: 'History for Season deletion fixture' });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));

    await user.click(within(history).getByRole('button', { name: 'Edit Middle Season' }));
    let correction = screen.getByRole('dialog', { name: 'Edit season' });
    await user.clear(within(correction).getByLabelText('Season name (optional)'));
    await user.type(within(correction).getByLabelText('Season name (optional)'), 'Revised middle');
    await user.click(within(correction).getByRole('button', { name: 'Apply' }));

    let stored = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(stored.valid).toBe(true);
    if (!stored.valid) return;
    let rhythm = stored.envelope.data.savedRhythms.find(entry => entry.id === fixture.rhythmId)!;
    expect(rhythm.scoring?.scheduleHistory.map(season => ({
      id: season.id,
      startDate: season.startDate,
      schedule: season.kind === 'scheduled' ? season.schedule : undefined
    }))).toEqual(originalSeasons.map(season => ({
      id: season.id,
      startDate: season.startDate,
      schedule: season.kind === 'scheduled' ? season.schedule : undefined
    })));
    expect(rhythm.scoring?.scheduleHistory[1]).toMatchObject({ name: 'Revised middle' });
    expect(stored.envelope.data.datedRhythmCompletions).toEqual(fixture.records);

    await user.click(within(history).getByRole('button', { name: 'Edit Revised middle' }));
    correction = screen.getByRole('dialog', { name: 'Edit season' });
    await user.clear(within(correction).getByLabelText('Season name (optional)'));
    await user.click(within(correction).getByRole('button', { name: 'Apply' }));
    stored = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(stored.valid).toBe(true);
    if (!stored.valid) return;
    rhythm = stored.envelope.data.savedRhythms.find(entry => entry.id === fixture.rhythmId)!;
    expect(rhythm.scoring?.scheduleHistory[1]).not.toHaveProperty('name');
    expect(rhythm.scoring?.scheduleHistory.map(season => season.id))
      .toEqual(originalSeasons.map(season => season.id));
    expect(stored.envelope.data.datedRhythmCompletions).toEqual(fixture.records);

    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const reloadedCard = screen.getByRole('article', { name: 'Season deletion fixture' });
    await user.click(within(reloadedCard).getByRole('button', {
      name: historyButtonName('View scores and history for Season deletion fixture')
    }));
    history = within(screen.getByRole('dialog', { name: 'Season deletion fixture' }))
      .getByRole('region', { name: 'History for Season deletion fixture' });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    expect(within(history).getByRole('heading', { name: 'Mon · Wed · Fri' })).toBeTruthy();
    expect(within(history).getAllByText('Mon · Wed · Fri').length).toBeGreaterThan(0);
    expect(within(history).queryByRole('heading', { name: 'Revised middle' })).toBeNull();
    expect(within(history).getByText('Logged moments (5)')).toBeTruthy();
  });

  it('reviews and cancels a middle Season deletion, then persists it and safely restores it with Undo', async () => {
    const user = userEvent.setup();
    const fixture = seasonDeletionFixture();
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(fixture.data)));
    const originalRaw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    const { unmount } = render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const card = screen.getByRole('article', { name: 'Season deletion fixture' });
    await user.click(within(card).getByRole('button', {
      name: historyButtonName('View scores and history for Season deletion fixture')
    }));
    const details = screen.getByRole('dialog', { name: 'Season deletion fixture' });
    const history = within(details).getByRole('region', { name: 'History for Season deletion fixture' });
    expect(within(history).getByRole('heading', { name: 'Seasons' })).toBeTruthy();
    expect(within(history).getByText('3 seasons')).toBeTruthy();
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    expect(within(history).getByRole('button', { name: 'Hide Seasons' }).getAttribute('aria-expanded'))
      .toBe('true');
    const firstSeasonEdit = within(history).getByRole('button', { name: 'Edit First Season' });
    await user.click(firstSeasonEdit);
    const firstSeasonDialog = screen.getByRole('dialog', { name: 'Edit season' });
    expect(within(firstSeasonDialog).getByText(
      'This season contains logged moments and can’t be deleted. You can edit its schedule.'
    )).toBeTruthy();
    expect(within(firstSeasonDialog).queryByRole('button', { name: 'Delete season' })).toBeNull();
    await user.click(within(firstSeasonDialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit season' })).toBeNull());
    expect(document.activeElement).toBe(firstSeasonEdit);
    expect(within(history).getByRole('button', { name: 'Hide Seasons' }).getAttribute('aria-expanded'))
      .toBe('true');

    const opener = within(history).getByRole('button', { name: 'Edit Middle Season' });
    const openDelete = async (draftName?: string) => {
      await user.click(opener);
      const edit = screen.getByRole('dialog', { name: 'Edit season' });
      if (draftName) {
        fireEvent.change(within(edit).getByLabelText('Season name (optional)'), {
          target: { value: draftName }
        });

      }
      await user.click(within(edit).getByRole('button', { name: 'Delete season' }));
    };
    await openDelete('Unsaved deletion draft');
    let review = screen.getByRole('dialog', { name: 'Remove this season?' });
    expect(within(review).getByText('2 logged moments in this period will be preserved.')).toBeTruthy();
    expect(within(review).getByRole('region', { name: 'Score impact preview' })).toBeTruthy();
    const impact = within(review).getByRole('region', { name: 'Score impact preview' });
    expect(within(impact).getByRole('heading', { name: 'Before' })).toBeTruthy();
    expect(within(impact).getByRole('heading', { name: 'After' })).toBeTruthy();
    const previewAfterValues = new Map(['Consistency', 'On Track', 'Health'].map(metric => {
      const comparison = within(impact).getByRole('group', { name: `${metric} comparison` });
      const afterCell = within(comparison).getByRole('group', { name: `After ${metric}` });
      const scoreContent = afterCell.querySelector('.rhythm-season-impact__score');
      const score = scoreContent?.querySelector('strong')?.textContent ?? null;
      expect(scoreContent?.textContent).not.toContain('/ 100');
      expect(scoreContent?.querySelector('.visually-hidden')?.textContent).toBe('out of 100');
      return [metric, score] as const;
    }));
    expect(previewAfterValues.get('Consistency')).not.toBeNull();
    expect(previewAfterValues.get('On Track')).not.toBeNull();
    expect(previewAfterValues.get('Health')).not.toBeNull();
    await user.click(within(review).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Remove this season?' })).toBeNull());
    let edit = screen.getByRole('dialog', { name: 'Edit season' });
    expect(within(edit).getByLabelText('Season name (optional)')).toHaveProperty('value', 'Unsaved deletion draft');
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    await user.click(within(edit).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit season' })).toBeNull());
    expect(document.activeElement).toBe(opener);

    await openDelete();
    review = screen.getByRole('dialog', { name: 'Remove this season?' });
    await user.click(within(review).getByRole('button', { name: 'Cancel Season deletion' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Remove this season?' })).toBeNull());
    edit = screen.getByRole('dialog', { name: 'Edit season' });
    await user.click(within(edit).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit season' })).toBeNull());
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(document.activeElement).toBe(opener);

    await openDelete();
    review = screen.getByRole('dialog', { name: 'Remove this season?' });
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Remove this season?' })).toBe(review);
    expect(screen.getByRole('dialog', { name: 'Season deletion fixture' })).toBe(details);
    fireEvent(review, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Remove this season?' })).toBeNull());
    edit = screen.getByRole('dialog', { name: 'Edit season' });
    await user.click(within(edit).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit season' })).toBeNull());
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(document.activeElement).toBe(opener);

    await openDelete();
    review = screen.getByRole('dialog', { name: 'Remove this season?' });
    await user.click(within(review).getByRole('button', { name: 'Delete season' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Remove this season?' })).toBeNull());
    const deleted = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, fixture.today);
    expect(deleted.valid).toBe(true);
    if (!deleted.valid) return;
    const deletedRhythm = deleted.envelope.data.savedRhythms.find(item => item.id === fixture.rhythmId)!;
    expect(deletedRhythm.scoring?.scheduleHistory.map(season => season.id))
      .toEqual([fixture.first.id, fixture.current.id]);
    expect(deletedRhythm.scoring?.scheduleHistory[0]).toEqual(fixture.first);
    expect(deletedRhythm.scoring?.scheduleHistory[1]).toEqual(fixture.current);
    expect(deleted.envelope.data.datedRhythmCompletions).toEqual(fixture.records);
    const undoButton = within(history).getByRole('button', { name: 'Undo' });
    expect(within(history).getByRole('button', { name: 'Hide Seasons' }).getAttribute('aria-expanded'))
      .toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(undoButton));
    await waitFor(() => {
      expect(within(history).getByRole('meter', { name: 'Consistency score' })
        .getAttribute('aria-valuenow')).toBe(previewAfterValues.get('Consistency'));
      expect(within(history).getByRole('meter', { name: 'On Track score' })
        .getAttribute('aria-valuenow')).toBe(previewAfterValues.get('On Track'));
      expect(Math.round(Number(within(history).getByRole('meter', { name: 'Health score' })
        .getAttribute('aria-valuenow'))).toString()).toBe(previewAfterValues.get('Health'));
    });

    await user.click(within(history).getAllByRole('button', {
      name: /Edit logged moment for Season deletion fixture/
    })[0]!);
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'Edited after deletion' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit logged moment' })).toBeNull());
    const logsAfterEdit = fixture.records.map(record => record.id === 'season-delete-log-5'
      ? { ...record, memory: 'Edited after deletion' }
      : record);
    const afterLogEdit = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, fixture.today);
    expect(afterLogEdit.valid && afterLogEdit.envelope.data.datedRhythmCompletions).toEqual(logsAfterEdit);

    await user.click(within(history).getByRole('button', { name: 'Undo' }));
    await waitFor(() => {
      const restored = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, fixture.today);
      expect(restored.valid && restored.envelope.data.savedRhythms
        .find(item => item.id === fixture.rhythmId)?.scoring?.scheduleHistory.map(season => season.id))
        .toEqual([fixture.first.id, fixture.middle.id, fixture.current.id]);
    });
    expect(document.activeElement).toBe(within(history).getByRole('button', { name: 'Edit Middle Season' }));
    const restored = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, fixture.today);
    expect(restored.valid && restored.envelope.data.datedRhythmCompletions).toEqual(logsAfterEdit);
    unmount();
  });

  it('deletes an empty first Season without extending its successor and reloads the resulting scores', async () => {
    const user = userEvent.setup();
    const fixture = seasonDeletionFixture();
    const retainedLogs = fixture.records.filter(record => record.effectiveDate >= fixture.middle.startDate);
    fixture.data.datedRhythmCompletions = retainedLogs;
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(fixture.data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const card = screen.getByRole('article', { name: 'Season deletion fixture' });
    await user.click(within(card).getByRole('button', {
      name: historyButtonName('View scores and history for Season deletion fixture')
    }));
    const history = screen.getByRole('region', { name: 'History for Season deletion fixture' });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    await user.click(within(history).getByRole('button', { name: 'Edit First Season' }));
    let editor = screen.getByRole('dialog', { name: 'Edit season' });
    const deleteButton = within(editor).getByRole('button', { name: 'Delete season' });
    expect(deleteButton.parentElement?.className).toContain('rhythm-season-correction__action-bar');
    await user.click(deleteButton);

    const confirmation = screen.getByRole('dialog', { name: 'Remove this season?' });
    expect(within(confirmation).getByText(/The next season will not extend backward/)).toBeTruthy();
    expect(confirmation.textContent).toContain('tracking starts');
    expect(within(confirmation).getByText(
      'No logged moments fall within this season. All completion records will be preserved.'
    )).toBeTruthy();
    const impact = within(confirmation).getByRole('region', { name: 'Score impact preview' });
    const previewScores = ['Health', 'Consistency', 'On Track'].map(metric => {
      const after = within(impact).getByRole('group', { name: `After ${metric}` });
      return after.querySelector('.rhythm-season-impact__score strong')?.textContent ?? '—';
    });
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    editor = screen.getByRole('dialog', { name: 'Edit season' });
    await user.click(within(editor).getByRole('button', { name: 'Delete season' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Remove this season?' }))
      .getByRole('button', { name: 'Delete season' }));

    let stored = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(stored.valid).toBe(true);
    if (!stored.valid) return;
    let rhythm = stored.envelope.data.savedRhythms.find(entry => entry.id === fixture.rhythmId)!;
    expect(rhythm.scoring?.trackingStartDate).toBe(fixture.middle.startDate);
    expect(rhythm.scoring?.scheduleHistory.map(season => season.id))
      .toEqual([fixture.middle.id, fixture.current.id]);
    expect(rhythm.scoring?.scheduleHistory[0]).toMatchObject({
      name: fixture.middle.name,
      schedule: fixture.middle.schedule,
      timeOfDay: fixture.middle.timeOfDay,
      paletteToken: fixture.middle.paletteToken
    });
    expect(stored.envelope.data.datedRhythmCompletions).toEqual(retainedLogs);

    const savedScores = ['Health', 'Consistency', 'On Track'].map(metric =>
      within(history).getByRole('meter', { name: `${metric} score` }).getAttribute('aria-valuenow') ?? '—'
    );
    expect(savedScores.map(value => value === '—' ? value : String(Math.round(Number(value)))))
      .toEqual(previewScores);
    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const reloadedCard = screen.getByRole('article', { name: 'Season deletion fixture' });
    await user.click(within(reloadedCard).getByRole('button', {
      name: historyButtonName('View scores and history for Season deletion fixture')
    }));
    const reloadedHistory = screen.getByRole('region', { name: 'History for Season deletion fixture' });
    expect(['Health', 'Consistency', 'On Track'].map(metric =>
      within(reloadedHistory).getByRole('meter', { name: `${metric} score` }).getAttribute('aria-valuenow') ?? '—'
    )).toEqual(savedScores);
    const reloaded = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(reloaded.valid).toBe(true);
    if (!reloaded.valid) return;
    rhythm = reloaded.envelope.data.savedRhythms.find(entry => entry.id === fixture.rhythmId)!;
    expect(rhythm.scoring?.scheduleHistory).toHaveLength(2);
    expect(rhythm.scoring?.scheduleHistory.map(season => season.id))
      .toEqual([fixture.middle.id, fixture.current.id]);
    expect(reloaded.envelope.data.datedRhythmCompletions).toEqual(retainedLogs);
  });

  it('deletes the current Season durably and reloads with its predecessor schedule and time active', async () => {
    const user = userEvent.setup();
    const fixture = seasonDeletionFixture();
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(fixture.data)));
    const { unmount } = render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const openHistory = async (seasonCount = 3) => {
      const card = screen.getByRole('article', { name: 'Season deletion fixture' });
      await user.click(within(card).getByRole('button', {
        name: historyButtonName('View scores and history for Season deletion fixture')
      }));
      const details = screen.getByRole('dialog', { name: 'Season deletion fixture' });
      const history = within(details).getByRole('region', { name: 'History for Season deletion fixture' });
      expect(within(history).getByText(`${seasonCount} ${seasonCount === 1 ? 'season' : 'seasons'}`)).toBeTruthy();
      await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
      return { details, history };
    };
    let { history } = await openHistory();
    await user.click(within(history).getByRole('button', { name: 'Edit Current Season' }));
    const currentEdit = screen.getByRole('dialog', { name: 'Edit season' });
    await user.click(within(currentEdit).getByRole('button', { name: 'Delete season' }));
    let review = screen.getByRole('dialog', { name: 'Remove this season?' });
    await user.click(within(review).getByRole('button', { name: 'Delete season' }));
    await waitFor(() => {
      const saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, fixture.today);
      expect(saved.valid && saved.envelope.data.savedRhythms.find(item => item.id === fixture.rhythmId))
        .toMatchObject({
          schedule: fixture.middle.schedule,
          timeOfDay: 'afternoon',
          timeLabel: 'Afternoon'
        });
    });
    const persisted = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, fixture.today);
    expect(persisted.valid && persisted.envelope.data.datedRhythmCompletions).toEqual(fixture.records);
    const backupRoundTrip = parsePreviewBackup(
      JSON.stringify(persisted.valid ? persisted.envelope : {}),
      fixture.today
    );
    expect(backupRoundTrip.valid && backupRoundTrip.envelope.data.savedRhythms
      .find(item => item.id === fixture.rhythmId)?.scoring?.scheduleHistory.map(season => season.id))
      .toEqual([fixture.first.id, fixture.middle.id]);
    expect(backupRoundTrip.valid && backupRoundTrip.envelope.data.datedRhythmCompletions).toEqual(fixture.records);
    unmount();

    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    ({ history } = await openHistory(2));
    expect(within(history).getByRole('heading', { name: 'Middle Season' })).toBeTruthy();
    expect(within(history).queryByRole('button', { name: 'Undo' })).toBeNull();
    const afterReload = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, fixture.today);
    expect(afterReload.valid && afterReload.envelope.data.savedRhythms
      .find(item => item.id === fixture.rhythmId)?.scoring?.scheduleHistory.map(season => season.id))
      .toEqual([fixture.first.id, fixture.middle.id]);

    await user.click(within(history).getByRole('button', { name: 'Edit Middle Season' }));
    const middleEdit = screen.getByRole('dialog', { name: 'Edit season' });
    await user.click(within(middleEdit).getByRole('button', { name: 'Delete season' }));
    const finalSeasonReview = screen.getByRole('dialog', { name: 'Remove this season?' });
    await user.click(within(finalSeasonReview).getByRole('button', { name: 'Delete season' }));
    const undoButton = within(history).getByRole('button', { name: 'Undo' });
    expect(undoButton).toBeTruthy();
    await user.click(undoButton);
    await waitFor(() => {
      const restored = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, fixture.today);
      expect(restored.valid && restored.envelope.data.savedRhythms
        .find(item => item.id === fixture.rhythmId)?.scoring?.scheduleHistory.map(season => season.id))
        .toEqual([fixture.first.id, fixture.middle.id]);
    });
  });

  it('keeps the deletion review open and the saved history intact after persistence failure', async () => {
    const user = userEvent.setup();
    const fixture = seasonDeletionFixture();
    const storage = window.localStorage as unknown as MemoryStorage;
    storage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(fixture.data)));
    const originalRaw = storage.getItem(PREVIEW_STORAGE_KEY);
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const card = screen.getByRole('article', { name: 'Season deletion fixture' });
    await user.click(within(card).getByRole('button', {
      name: historyButtonName('View scores and history for Season deletion fixture')
    }));
    const details = screen.getByRole('dialog', { name: 'Season deletion fixture' });
    const history = within(details).getByRole('region', { name: 'History for Season deletion fixture' });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    await user.click(within(history).getByRole('button', { name: 'Edit Middle Season' }));
    const edit = screen.getByRole('dialog', { name: 'Edit season' });
    await user.click(within(edit).getByRole('button', { name: 'Delete season' }));
    const review = screen.getByRole('dialog', { name: 'Remove this season?' });
    const originalSetItem = storage.setItem.bind(storage);
    const failingWrite = vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
      if (key === PREVIEW_STORAGE_KEY) throw new Error('controlled storage failure');
      originalSetItem(key, value);
    });
    await user.click(within(review).getByRole('button', { name: 'Delete season' }));
    expect(within(review).getByRole('alert').textContent).toContain('controlled storage failure');
    expect(screen.getByRole('dialog', { name: 'Remove this season?' })).toBe(review);
    expect(storage.getItem(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    failingWrite.mockRestore();
  });

  it('keeps a logged completion through cancelled and confirmed Season creation and reload', async () => {
    const user = userEvent.setup();
    const today = localDateString(new Date());
    const trackingStartDate = addCalendarDays(today, -30);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const rhythmId = 'user-rhythm-40000000-0000-4000-8000-000000000001';
    const schedule = { frequency: 'daily' as const };
    const data = createSamplePreviewData();
    data.savedRhythms.push({
      id: rhythmId,
      title: 'Season flow test',
      cadence: 'Daily',
      timeLabel: 'Anytime',
      timeOfDay: 'anytime',
      personIds: [],
      categoryIds: [],
      schedule,
      scoring: {
        trackingStartDate,
        timeZone,
        scheduleHistory: [createRhythmSeason(rhythmId, trackingStartDate, schedule)]
      },
      createdLocalDate: trackingStartDate,
      createdTimeZone: timeZone
    });
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const card = screen.getByRole('article', { name: 'Season flow test' });
    await user.click(within(card).getByRole('button', {
      name: historyButtonName('View scores and history for Season flow test')
    }));
    const details = screen.getByRole('dialog', { name: 'Season flow test' });
    const history = within(details).getByRole('region', { name: 'History for Season flow test' });
    await user.click(within(history).getByText('Logged moments (0)'));
    await user.click(within(history).getByRole('button', { name: '+ Log a moment' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      const saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
      expect(saved.valid && saved.envelope.data.datedRhythmCompletions).toHaveLength(1);
    });
    await user.click(within(details).getByRole('button', { name: 'Close details' }));

    await user.click(within(card).getByRole('button', { name: 'Edit Season flow test' }));
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.click(within(editor).getByRole('button', { name: 'Change frequency, currently Daily' }));
    await user.click(within(editor).getByRole('combobox', { name: 'Frequency: Daily' }));
    await user.click(within(editor).getByRole('option', { name: 'Select Days' }));
    await user.click(within(editor).getByRole('checkbox', { name: 'Tuesday' }));
    const beforeCancel = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    let confirmation = screen.getByRole('dialog', { name: 'Change schedule' });
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel schedule change' }));
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(beforeCancel);
    expect(screen.getByRole('dialog', { name: 'Edit Rhythm' })).toBe(editor);
    expect(within(editor).getByRole('button', { name: 'Change frequency, currently Daily' })).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Change frequency, currently Daily' }));
    await user.click(within(editor).getByRole('combobox', { name: 'Frequency: Daily' }));
    await user.click(within(editor).getByRole('option', { name: 'Select Days' }));
    await user.click(within(editor).getByRole('checkbox', { name: 'Tuesday' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    confirmation = screen.getByRole('dialog', { name: 'Change schedule' });
    await user.type(within(confirmation).getByLabelText('Season name (optional)'), 'New cadence');
    await user.click(within(confirmation).getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      const saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
      expect(saved.valid && saved.envelope.data.savedRhythms[0]?.scoring?.scheduleHistory).toHaveLength(2);
    });
    const saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    const rhythm = saved.envelope.data.savedRhythms.find(item => item.title === 'Season flow test')!;
    expect(saved.envelope.data.rhythmHistoryIds).toContain(rhythm.id);
    expect(saved.envelope.data.datedRhythmCompletions).toHaveLength(1);
    expect(rhythm.scoring?.scheduleHistory.map(season => season.kind === 'scheduled' ? season.schedule : undefined)).toEqual([
      { frequency: 'daily' },
      { frequency: 'weekly', weekdays: [2], weeklyMode: 'select-days' }
    ]);
    const currentSeason = rhythm.scoring?.scheduleHistory[1];
    expect(currentSeason?.kind === 'scheduled' ? currentSeason.name : undefined).toBe('New cadence');

    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const reloadedCard = screen.getByRole('article', { name: 'Season flow test' });
    await user.click(within(reloadedCard).getByRole('button', {
      name: historyButtonName('View scores and history for Season flow test')
    }));
    const reloadedDialog = screen.getByRole('dialog', { name: 'Season flow test' });
    const reloadedHistory = within(reloadedDialog).getByRole('region', { name: 'History for Season flow test' });
    await user.click(within(reloadedHistory).getByRole('button', { name: 'Show Seasons' }));
    expect(within(reloadedHistory).getByText('Logged moments (1)')).toBeTruthy();
    expect(within(reloadedHistory).getByRole('heading', { name: 'New cadence' })).toBeTruthy();
    expect(within(reloadedHistory).getByRole('heading', { name: 'Daily' })).toBeTruthy();
    expect(parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()))
      .valid).toBe(true);
  });

  it('preserves the sample Daily connection history when its schedule first becomes structured', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-25T12:00:00.000Z'));
    const user = userEvent.setup();
    const fixture = todayRhythms.find(rhythm => rhythm.id === 'sample-connect')!;
    const originalCompletionIds = fixture.completionHistory?.map(record => record.id);
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const card = screen.getByRole('article', { name: 'Daily connection' });
    await user.click(within(card).getByRole('button', { name: 'Edit Daily connection' }));
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.click(within(editor).getByRole('button', { name: 'Change frequency, currently Daily' }));
    await user.click(within(editor).getByRole('combobox', { name: /Frequency:/ }));
    await user.click(within(editor).getByRole('option', { name: 'Select Days' }));
    for (const day of ['Monday', 'Wednesday', 'Friday']) {
      const weekday = within(editor).getByRole('checkbox', { name: day });
      await user.click(weekday);
      expect((weekday as HTMLInputElement).checked).toBe(true);
    }
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    const confirmation = screen.getByRole('dialog', { name: 'Change schedule' });
    expect(within(confirmation).getByText('Daily')).toBeTruthy();
    expect(within(confirmation).getByText('Mon · Wed · Fri')).toBeTruthy();
    expect(within(confirmation).getByRole('group', {
      name: /Current: Every day\. New: Every week on Monday, Wednesday, and Friday/
    })).toBeTruthy();
    await user.type(
      within(confirmation).getByLabelText('Season name (optional)'),
      'Evening connection'
    );
    await user.click(within(confirmation).getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      const saved = parsePreviewBackup(
        window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
        localDateString(new Date())
      );
      expect(saved.valid && saved.envelope.data.savedRhythms
        .find(item => item.id === 'sample-connect')?.scoring?.scheduleHistory).toHaveLength(2);
    });
    let saved = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    const rhythm = saved.envelope.data.savedRhythms.find(item => item.id === 'sample-connect')!;
    expect(rhythm.scoring?.trackingStartDate).toBe('2026-10-17');
    expect(rhythm.scoring?.scheduleHistory.map(season =>
      season.kind === 'scheduled' ? season.schedule : season.kind
    )).toEqual([
      { frequency: 'daily' },
      { frequency: 'weekly', weekdays: [1, 3, 5] }
    ]);
    expect(rhythm.scoring?.scheduleHistory[1]).toMatchObject({ name: 'Evening connection' });
    expect(saved.envelope.data.datedRhythmCompletions).toHaveLength(0);
    expect(fixture.completionHistory?.map(record => record.id)).toEqual(originalCompletionIds);

    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const reloadedCard = screen.getByRole('article', { name: 'Daily connection' });
    expect(within(reloadedCard).queryByText('Due today')).toBeNull();
    await user.click(within(reloadedCard).getByRole('button', {
      name: historyButtonName('View scores and history for Daily connection')
    }));
    const history = within(screen.getByRole('dialog', { name: 'Daily connection' }))
      .getByRole('region', { name: 'History for Daily connection' });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    expect(within(history).getByRole('meter', { name: 'Health score' }).getAttribute('aria-valuenow'))
      .toBe('43.125');
    expect(within(history).getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow'))
      .toBe('38');
    expect(within(history).getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow'))
      .toBe('60');
    expect(within(history).getByText('2 seasons')).toBeTruthy();
    expect(within(history).getByRole('heading', { name: 'Daily' })).toBeTruthy();
    expect(within(history).getByRole('heading', { name: 'Evening connection' })).toBeTruthy();
    expect(within(history).getAllByText('Mon · Wed · Fri')).toHaveLength(2);
    const editNamedSeason = within(history).getByRole('button', { name: 'Edit Evening connection' });
    await user.click(editNamedSeason);
    const correction = screen.getByRole('dialog', { name: 'Edit season' });
    expect(within(correction).getByLabelText('Season name (optional)'))
      .toHaveProperty('value', 'Evening connection');
    await user.click(within(correction).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit season' })).toBeNull());
    expect(within(history).getByText('Logged moments (3)')).toBeTruthy();
    expect(fixture.completionHistory?.map(record => record.id)).toEqual(originalCompletionIds);
    saved = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(saved.valid).toBe(true);
    if (saved.valid) {
      expect(saved.envelope.data.savedRhythms.find(item => item.id === 'sample-connect')
        ?.scoring?.scheduleHistory).toHaveLength(2);
    }
  });

  it('opens the shared Season editor for Daily connection without creating a boundary and preserves the Rhythm editor pencil', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const before = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    const card = screen.getByRole('article', { name: 'Daily connection' });
    await user.click(within(card).getByRole('button', {
      name: historyButtonName('View scores and history for Daily connection')
    }));
    const history = within(screen.getByRole('dialog', { name: 'Daily connection' }))
      .getByRole('region', { name: 'History for Daily connection' });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    const seasonPencil = within(history).getByRole('button', { name: 'Edit Daily' });
    await user.click(seasonPencil);

    const seasonEditor = screen.getByRole('dialog', { name: 'Edit season' });
    expect(within(seasonEditor).getByRole('combobox', { name: /^Frequency:/ }).textContent).toContain('Daily');
    expect(within(seasonEditor).getByLabelText('Starting date')).toHaveProperty('value', '2026-10-17');
    await user.click(within(seasonEditor).getByRole('button', { name: 'Starting date help' }));
    const startDateHelp = screen.getByRole('dialog', { name: 'Starting date' });
    expect(startDateHelp.textContent).toContain('Starting date defaults to the earliest logged moment');
    await user.click(within(startDateHelp).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Starting date' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Edit season' })).toBe(seasonEditor);
    await user.click(within(seasonEditor).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit season' })).toBeNull());
    expect(document.activeElement).toBe(seasonPencil);
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(before);

    await user.click(within(history).getByRole('button', { name: 'Close details' }));
    await user.click(within(card).getByRole('button', { name: 'Edit Daily connection' }));
    expect(screen.getByRole('dialog', { name: 'Edit Rhythm' })).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(before);
  });

  it('previews, confirms, and reloads a single-day Select Days current Season without changing completion records', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-25T12:00:00.000Z'));
    const user = userEvent.setup();
    const fixture = todayRhythms.find(rhythm => rhythm.id === 'sample-connect')!;
    const originalCompletions = fixture.completionHistory?.map(record => ({ ...record }));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const card = screen.getByRole('article', { name: 'Daily connection' });
    await user.click(within(card).getByRole('button', {
      name: historyButtonName('View scores and history for Daily connection')
    }));
    const historyDialog = screen.getByRole('dialog', { name: 'Daily connection' });
    const history = within(historyDialog).getByRole('region', { name: 'History for Daily connection' });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    await user.click(within(history).getByRole('button', { name: 'Edit Daily' }));

    const editor = screen.getByRole('dialog', { name: 'Edit season' });
    expect(within(editor).getByLabelText('Starting date')).toHaveProperty('value', '2026-10-17');
    await user.type(within(editor).getByLabelText('Season name (optional)'), 'Special Season');
    await user.click(within(editor).getByRole('combobox', { name: 'Frequency: Daily' }));
    await user.click(within(editor).getByRole('option', { name: 'Select Days' }));
    await user.click(within(editor).getByRole('checkbox', { name: 'Monday' }));
    await user.click(within(editor).getByRole('checkbox', { name: 'Set an end date' }));

    const endDate = within(editor).getByLabelText('End date');
    expect((endDate as HTMLInputElement).value).toBe('2026-10-25');
    const comparison = within(editor).getByRole('group', { name: 'Saved and proposed schedules' });
    expect(comparison.textContent).toContain('Proposed');
    expect(comparison.textContent).toContain('Selected days: Monday');
    expect(within(editor).getAllByText('Oct 17, 2026 – Oct 25, 2026')).toHaveLength(2);
    const previewScores = ['Health', 'Consistency', 'On Track'].map(metric =>
      within(editor).getByRole('group', { name: `After ${metric}` })
        .querySelector('strong')?.textContent
    );
    const calculationDetails = within(editor).getByText('Why the scores change').closest('details')!;
    await user.click(within(calculationDetails).getByText('Why the scores change'));
    expect(calculationDetails.textContent).toContain('0 of 1 · 0%');
    expect(calculationDetails.textContent).toContain('1 scheduled day · 0 completed');

    await user.click(within(editor).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit season' })).toBeNull());
    expect(fixture.completionHistory?.map(record => ({ ...record }))).toEqual(originalCompletions);
    let saved = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    let rhythm = saved.envelope.data.savedRhythms.find(item => item.id === fixture.id)!;
    let season = rhythm.scoring?.scheduleHistory?.[0];
    expect(rhythm.schedule).toMatchObject({
      frequency: 'weekly',
      weekdays: [1],
      weeklyMode: 'select-days',
      endDate: '2026-10-25'
    });
    expect(season).toMatchObject({
      kind: 'scheduled',
      startDate: '2026-10-17',
      name: 'Special Season',
      timeOfDay: 'anytime',
      schedule: { frequency: 'weekly', weekdays: [1], weeklyMode: 'select-days', endDate: '2026-10-25' }
    });
    expect(saved.envelope.data.datedRhythmCompletions).toHaveLength(0);
    expect(saved.envelope.data.rhythmCompletionOverrides).toHaveLength(0);
    expect(saved.envelope.data.removedSeedCompletionIds).toHaveLength(0);

    const scoreValues = ['Health', 'Consistency', 'On Track'].map(metric =>
      within(history).getByRole('meter', { name: `${metric} score` }).getAttribute('aria-valuenow')
    );
    expect(scoreValues.map(Number)).toEqual([22.5, 0, 90]);
    expect(previewScores).toEqual(['23', '0', '90']);
    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const reloadedCard = screen.getByRole('article', { name: 'Daily connection' });
    await user.click(within(reloadedCard).getByRole('button', {
      name: historyButtonName('View scores and history for Daily connection')
    }));
    const reloadedDialog = screen.getByRole('dialog', { name: 'Daily connection' });
    const reloadedHistory = within(reloadedDialog).getByRole('region', {
      name: 'History for Daily connection'
    });
    expect(within(reloadedHistory).getByRole('meter', { name: 'Health score' }).getAttribute('aria-valuenow'))
      .toBe(scoreValues[0]);
    expect(within(reloadedHistory).getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow'))
      .toBe(scoreValues[1]);
    expect(within(reloadedHistory).getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow'))
      .toBe(scoreValues[2]);
    await user.click(within(reloadedHistory).getByRole('button', { name: 'Show Seasons' }));
    expect(within(reloadedHistory).getByRole('heading', { name: 'Special Season' })).toBeTruthy();
    expect(within(reloadedHistory).getAllByText('Select days · Mon')).toHaveLength(2);
    expect(within(reloadedHistory).getByText('Logged moments (3)')).toBeTruthy();
    expect(fixture.completionHistory?.map(record => ({ ...record }))).toEqual(originalCompletions);
    saved = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    rhythm = saved.envelope.data.savedRhythms.find(item => item.id === fixture.id)!;
    season = rhythm.scoring?.scheduleHistory?.[0];
    expect(season).toMatchObject({
      kind: 'scheduled',
      name: 'Special Season',
      schedule: { frequency: 'weekly', weekdays: [1], weeklyMode: 'select-days', endDate: '2026-10-25' }
    });
  });

  it('preserves pre-boundary completions and the prior schedule when establishing the first Season boundary', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T12:00:00.000Z'));
    const user = userEvent.setup();
    const rhythmId = 'user-rhythm-40000000-0000-4000-8000-000000000002';
    const oldSchedule = { frequency: 'daily' as const };
    const completions = ['2026-10-17', '2026-10-18', '2026-10-20'].map((effectiveDate, index) => {
      const completedAt = localDateTimeInZone(effectiveDate, '19:00', 'UTC').toISOString();
      return {
        id: `season-boundary-completion-${index}`,
        rhythmId,
        effectiveDate,
        localTime: '19:00',
        timeZone: 'UTC',
        completedAt,
        recordedAt: completedAt
      };
    });
    const data = createSamplePreviewData();
    data.savedRhythms.push({
      id: rhythmId,
      title: 'Season boundary fixture',
      cadence: 'Daily',
      timeLabel: 'Morning',
      timeOfDay: 'morning',
      personIds: [],
      categoryIds: [],
      schedule: oldSchedule,
      createdLocalDate: '2026-10-01',
      createdTimeZone: 'UTC'
    });
    data.datedRhythmCompletions.push(...completions);
    data.rhythmHistoryIds.push(rhythmId);
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');

    const card = screen.getByRole('article', { name: 'Season boundary fixture' });
    await user.click(within(card).getByRole('button', {
      name: historyButtonName('View scores and history for Season boundary fixture')
    }));
    const history = within(screen.getByRole('dialog', { name: 'Season boundary fixture' }))
      .getByRole('region', { name: 'History for Season boundary fixture' });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    await user.click(within(history).getByRole('button', { name: 'Edit Daily' }));

    const editor = screen.getByRole('dialog', { name: 'Edit season' });
    fireEvent.change(within(editor).getByLabelText('Starting date'), {
      target: { value: '2026-10-24' }
    });
    await user.click(within(editor).getByRole('combobox', { name: 'Frequency: Daily' }));
    await user.click(within(editor).getByRole('option', { name: 'Select Days' }));
    for (const weekday of ['Monday', 'Wednesday', 'Friday']) {
      await user.click(within(editor).getByRole('checkbox', { name: weekday }));
    }
    await user.click(within(editor).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit season' })).toBeNull());

    let saved = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    let rhythm = saved.envelope.data.savedRhythms.find(item => item.id === rhythmId)!;
    expect(rhythm.scoring?.scheduleHistory).toHaveLength(2);
    expect(rhythm.scoring?.scheduleHistory[0]).toMatchObject({
      kind: 'scheduled',
      startDate: '2026-10-01',
      schedule: oldSchedule,
      timeOfDay: 'morning'
    });
    expect(rhythm.scoring?.scheduleHistory[1]).toMatchObject({
      kind: 'scheduled',
      startDate: '2026-10-24',
      schedule: { frequency: 'weekly', weekdays: [1, 3, 5] }
    });
    expect(saved.envelope.data.datedRhythmCompletions).toEqual(completions);
    expect(saved.envelope.data.datedRhythmCompletions.map(record => record.effectiveDate))
      .toEqual(['2026-10-17', '2026-10-18', '2026-10-20']);
    expect(within(history).getByText('2 seasons')).toBeTruthy();
    expect(within(history).getByRole('heading', { name: 'Daily' })).toBeTruthy();
    expect(within(history).getByText('Oct 1 – Oct 23, 2026')).toBeTruthy();
    expect(within(history).getByLabelText('Oct 1, 2026 – Oct 23, 2026')).toBeTruthy();
    expect(within(history).getByRole('heading', { name: 'Mon · Wed · Fri' })).toBeTruthy();
    expect(within(history).getByText('Oct 24, 2026 – Present')).toBeTruthy();
    expect(within(history).getByText('Logged moments (3)')).toBeTruthy();

    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const reloadedCard = screen.getByRole('article', { name: 'Season boundary fixture' });
    await user.click(within(reloadedCard).getByRole('button', {
      name: historyButtonName('View scores and history for Season boundary fixture')
    }));
    const reloadedHistory = within(screen.getByRole('dialog', { name: 'Season boundary fixture' }))
      .getByRole('region', { name: 'History for Season boundary fixture' });
    await user.click(within(reloadedHistory).getByRole('button', { name: 'Show Seasons' }));
    expect(within(reloadedHistory).getByText('2 seasons')).toBeTruthy();
    expect(within(reloadedHistory).getByRole('heading', { name: 'Daily' })).toBeTruthy();
    expect(within(reloadedHistory).getByRole('heading', { name: 'Mon · Wed · Fri' })).toBeTruthy();
    saved = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(saved.valid).toBe(true);
    if (saved.valid) {
      rhythm = saved.envelope.data.savedRhythms.find(item => item.id === rhythmId)!;
      expect(rhythm.scoring?.scheduleHistory).toHaveLength(2);
      expect(saved.envelope.data.datedRhythmCompletions).toEqual(completions);
    }
  });

  it('repairs legacy missing coverage on read without persisting or duplicating an unknown Season', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T12:00:00.000Z'));
    const user = userEvent.setup();
    const rhythmId = 'user-rhythm-40000000-0000-4000-8000-000000000003';
    const schedule = { frequency: 'weekly' as const, weekdays: [1, 3, 5] as (1 | 3 | 5)[] };
    const current = createRhythmSeason(rhythmId, '2026-10-24', schedule, 'evening');
    const completions = ['2026-10-17', '2026-10-18', '2026-10-20'].map((effectiveDate, index) => {
      const completedAt = localDateTimeInZone(effectiveDate, '19:00', 'UTC').toISOString();
      return {
        id: `legacy-season-completion-${index}`,
        rhythmId,
        effectiveDate,
        localTime: '19:00',
        timeZone: 'UTC',
        completedAt,
        recordedAt: completedAt
      };
    });
    const data = createSamplePreviewData();
    data.savedRhythms.push({
      id: rhythmId,
      title: 'Legacy history fixture',
      cadence: 'Every week on Monday, Wednesday, and Friday.',
      timeLabel: 'Evening',
      timeOfDay: 'evening',
      personIds: [],
      categoryIds: [],
      schedule,
      scoring: {
        trackingStartDate: '2026-10-24',
        timeZone: 'UTC',
        scheduleHistory: [current]
      },
      createdLocalDate: '2026-10-01',
      createdTimeZone: 'UTC'
    });
    data.datedRhythmCompletions.push(...completions);
    data.rhythmHistoryIds.push(rhythmId);
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));
    const rawBeforeLoad = window.localStorage.getItem(PREVIEW_STORAGE_KEY);

    for (let load = 0; load < 2; load += 1) {
      render(<App />);
      await screen.findByText('Preview data saved in this browser.');
      const card = screen.getByRole('article', { name: 'Legacy history fixture' });
      await user.click(within(card).getByRole('button', {
        name: historyButtonName('View scores and history for Legacy history fixture')
      }));
      const history = within(screen.getByRole('dialog', { name: 'Legacy history fixture' }))
        .getByRole('region', { name: 'History for Legacy history fixture' });
      await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
      expect(within(history).getByText('2 seasons')).toBeTruthy();
      expect(within(history).getByRole('heading', { name: 'Earlier schedule needs details' })).toBeTruthy();
      expect(within(history).getByText('Oct 1 – Oct 23, 2026')).toBeTruthy();
      expect(within(history).getByLabelText('Oct 1, 2026 – Oct 23, 2026')).toBeTruthy();
      expect(within(history).getByText('Oct 24, 2026 – Present')).toBeTruthy();
      expect(within(history).getByText('Logged moments (3)')).toBeTruthy();
      expect(within(history).getByText(/Some earlier dates have no known schedule/)).toBeTruthy();
      expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(rawBeforeLoad);
      cleanup();
    }

    const saved = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(saved.valid).toBe(true);
    if (saved.valid) {
      expect(saved.envelope.data.savedRhythms.find(item => item.id === rhythmId)
        ?.scoring?.scheduleHistory).toHaveLength(2);
      expect(saved.envelope.data.datedRhythmCompletions).toEqual(completions);
    }
  });

  it('keeps the history dialog open when Escape dismisses the nested Season correction', async () => {
    const user = userEvent.setup();
    const today = localDateString(new Date());
    const previousDate = addCalendarDays(today, -1);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const rhythmId = 'user-rhythm-50000000-0000-4000-8000-000000000001';
    const schedule = { frequency: 'daily' } as const;
    const data = createSamplePreviewData();
    data.savedRhythms.push({
      id: rhythmId,
      title: 'Escape fixture',
      cadence: 'Daily',
      timeLabel: 'Anytime',
      timeOfDay: 'anytime',
      personIds: [],
      categoryIds: [],
      schedule,
      scoring: {
        trackingStartDate: today,
        timeZone,
        scheduleHistory: [
          {
            kind: 'unknown',
            id: `season:${rhythmId}:${previousDate}:unknown`,
            startDate: previousDate,
            descriptiveCadence: 'Daily',
            paletteToken: 'plum'
          },
          createRhythmSeason(rhythmId, today, schedule)
        ]
      },
      createdLocalDate: today,
      createdTimeZone: timeZone
    });
    const envelope = createPreviewEnvelope(data);
    const validation = parsePreviewBackup(JSON.stringify(envelope), today);
    if (!validation.valid) throw new Error(validation.message);
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(envelope));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');

    const card = screen.getByRole('article', { name: 'Escape fixture' });
    await user.click(within(card).getByRole('button', { name: historyButtonName('View scores and history for Escape fixture') }));
    const historyDialog = screen.getByRole('dialog', { name: 'Escape fixture' });
    const history = within(historyDialog).getByRole('region', { name: 'History for Escape fixture' });
    await user.click(within(history).getByRole('button', { name: 'Show Seasons' }));
    expect(within(history).queryByRole('button', { name: /Delete Season/ })).toBeNull();
    const opener = within(history).getByRole('button', { name: 'Set earlier schedule' });
    await user.click(opener);

    const correction = screen.getByRole('dialog', { name: 'Set earlier schedule' });
    const impact = within(correction).getByRole('region', { name: 'Score impact preview' });
    expect(within(impact).getByRole('columnheader', { name: 'Before' })).toBeTruthy();
    expect(within(impact).getByRole('columnheader', { name: 'After' })).toBeTruthy();
    expect(within(impact).getByRole('row', { name: /Consistency/ })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Escape fixture' })).toBe(historyDialog);
    expect(screen.getByRole('dialog', { name: 'Set earlier schedule' })).toBe(correction);
    expect(document.activeElement).not.toBe(opener);

    fireEvent(correction, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Set earlier schedule' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Escape fixture' })).toBe(historyDialog);
    expect(document.activeElement).toBe(opener);
  });

  it('recomputes structured On Track from exported and reimported dated records after reload', async () => {
    const user = userEvent.setup();
    const today = localDateString(new Date());
    const trackingStartDate = addCalendarDays(today, -2);
    const completionDate = trackingStartDate;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const rhythmId = 'user-rhythm-20000000-0000-4000-8000-000000000001';
    const data = createSamplePreviewData();
    data.savedRhythms.push({
      id: rhythmId,
      title: 'Reload score fixture',
      cadence: 'Daily',
      timeLabel: 'Anytime',
      timeOfDay: 'anytime',
      personIds: [],
      categoryIds: [],
      schedule: { frequency: 'daily' },
      scoring: {
        trackingStartDate,
        timeZone,
        scheduleHistory: [createRhythmSeason(rhythmId, trackingStartDate, { frequency: 'daily' })]
      },
      createdLocalDate: trackingStartDate,
      createdTimeZone: timeZone,
      dailyBackfillAllowed: false
    });
    data.datedRhythmCompletions.push({
      id: 'reload-score-completion',
      rhythmId,
      effectiveDate: completionDate,
      localTime: '12:00',
      timeZone,
      completedAt: new Date(`${completionDate}T12:00:00`).toISOString(),
      recordedAt: new Date().toISOString()
    });
    data.rhythmHistoryIds.push(rhythmId);
    const exportedBackup = JSON.stringify(createPreviewEnvelope(data));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, exportedBackup);

    const { unmount } = render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const openHistory = async () => {
      const card = screen.getByRole('article', { name: 'Reload score fixture' });
      await user.click(within(card).getByRole('button', {
        name: historyButtonName('View scores and history for Reload score fixture')
      }));
      const historyDialog = await screen.findByRole('dialog', { name: 'Reload score fixture' });
      const history = within(historyDialog).getByRole('region', { name: 'History for Reload score fixture' });
      await user.click(within(history).getByRole('button', {
        name: 'Show Consistency and On Track score details'
      }));
      expect(within(history).getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow'))
        .toBe('90');
      return historyDialog;
    };
    const firstDialog = await openHistory();
    await user.click(within(firstDialog).getByRole('button', { name: 'Close details' }));
    unmount();

    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const reloadedDialog = await openHistory();
    await user.click(within(reloadedDialog).getByRole('button', { name: 'Close details' }));

    await openPreviewSettings(user);
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File([exportedBackup], 'on-track-export.json', { type: 'application/json' })
    );
    const importConfirmation = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    await user.click(within(importConfirmation).getByRole('button', { name: 'Replace with backup' }));
    await screen.findByText('Preview backup imported.');
    await user.click(screen.getByRole('button', { name: 'Today' }));
    const importedDialog = await openHistory();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toContain('reload-score-completion');
    await user.click(within(importedDialog).getByRole('button', { name: 'Close details' }));
  });

  it('shows a new quarterly Rhythm as not started until a qualifying Tend or ended occurrence exists', async () => {
    const user = userEvent.setup();
    const today = localDateString(new Date());
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const rhythmId = 'user-rhythm-30000000-0000-4000-8000-000000000001';
    const schedule = {
      frequency: 'quarterly',
      monthInQuarter: 1,
      pattern: { kind: 'dayOfMonth', day: 1 }
    } as const;
    const data = createSamplePreviewData();
    data.savedRhythms.push({
      id: rhythmId,
      title: 'New quarterly rhythm',
      cadence: 'The 1st day of the first month of every quarter.',
      timeLabel: 'Anytime',
      timeOfDay: 'anytime',
      personIds: [],
      categoryIds: [],
      schedule,
      scoring: {
        trackingStartDate: today,
        timeZone,
        scheduleHistory: [createRhythmSeason(rhythmId, today, schedule)]
      },
      createdLocalDate: today,
      createdTimeZone: timeZone
    });
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));

    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(screen.getByRole('button', {
      name: historyButtonName('View scores and history for New quarterly rhythm')
    }));
    const history = await screen.findByRole('region', { name: 'History for New quarterly rhythm' });
    expect(within(history).getByRole('img', {
      name: 'On Track: Unscored because Starts with your first Tend.'
    })).toBeTruthy();
    expect(within(history).queryByRole('meter', { name: 'On Track score' })).toBeNull();
    expect(within(history).getByRole('status').textContent).toContain(
      'On Track: Starts with your first Tend.'
    );
    expect(within(history).getByRole('status').textContent).toContain(
      'Consistency: No scheduled moments to measure yet.'
    );
    expect(within(history).getByText('Your story starts with the first Tend.')).toBeTruthy();
    expect(within(history).getByText('Logged moments (0)')).toBeTruthy();
  });

  it('keeps Take a walk descriptive cadence literal until a structured schedule is explicitly saved', async () => {
    const user = userEvent.setup();
    render(<App />);
    const card = screen.getByRole('article', { name: 'Take a walk' });
    expect(within(card).getByText('3 times a week')).toBeTruthy();
    expect(card.textContent).not.toContain('Mon · Wed');
    await user.click(within(card).getByRole('button', {
      name: historyButtonName('View scores and history for Take a walk')
    }));
    const history = screen.getByRole('region', { name: 'History for Take a walk' });
    expect(within(history).getByText('3 times a week')).toBeTruthy();
    expect(within(history).getByText('Afternoon')).toBeTruthy();
    expect(within(history).queryByText(/Monday|Wednesday|Friday/)).toBeNull();
  });

  it('saves a Quarterly rhythm through the editor and retains it after reload', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    const addButton = screen.getByRole('button', { name: 'Add Rhythm' });
    await user.click(addButton);
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });

    await user.type(within(editor).getByLabelText('Title'), 'Quarterly preview habit');
    await user.type(within(editor).getByLabelText('Description (optional)'), 'Quarterly test rhythm.');
    await user.click(within(editor).getByRole('combobox', { name: 'Frequency: Daily' }));
    await user.click(within(editor).getByRole('option', { name: 'Quarterly' }));
    await user.click(within(editor).getByRole('combobox', { name: 'Time of day: Anytime' }));
    await user.click(within(editor).getByRole('option', { name: 'Morning' }));
    await user.click(within(editor).getByRole('button', { name: /^Choose categories/ }));
    let association = associationPicker('Choose categories');
    await user.click(within(association).getByRole('button', { name: 'Marriage' }));
    await user.click(within(association).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));

    const card = screen.getByRole('article', { name: 'Quarterly preview habit' });
    expect(within(card).getByText('Quarterly')).toBeTruthy();
    const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = parsePreviewBackup(raw!, localDateString(new Date()));
    expect(parsed.valid).toBe(true);
    if (parsed.valid) {
      expect(parsed.envelope.data.savedRhythms).toContainEqual(expect.objectContaining({
        title: 'Quarterly preview habit',
        schedule: { frequency: 'quarterly', monthInQuarter: 1, pattern: { kind: 'dayOfMonth', day: 1 } }
      }));
    }

    const savedCard = screen.getByRole('article', { name: 'Quarterly preview habit' });
    await user.click(within(savedCard).getByRole('button', {
      name: historyButtonName('View scores and history for Quarterly preview habit')
    }));
    const history = screen.getByRole('region', { name: 'History for Quarterly preview habit' });
    expect(within(history).getAllByText('Quarterly', { exact: true }).length).toBeGreaterThan(0);
    expect(within(history).getByText('Morning')).toBeTruthy();

    cleanup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    const reloadedCard = screen.getByRole('article', { name: 'Quarterly preview habit' });
    expect(reloadedCard).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toContain('"frequency":"quarterly"');
    await user.click(within(reloadedCard).getByRole('button', {
      name: historyButtonName('View scores and history for Quarterly preview habit')
    }));
    expect(screen.getByRole('dialog', { name: 'Quarterly preview habit' })).toBeTruthy();
  });

  it('converts Take a walk from descriptive cadence to Quarterly and preserves the saved schedule after reload', async () => {
    const user = userEvent.setup();
    render(<App />);

    const card = screen.getByRole('article', { name: 'Take a walk' });
    await user.click(within(card).getByRole('button', { name: 'Edit Take a walk' }));
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.click(within(editor).getByRole('combobox', { name: 'Frequency: Choose frequency' }));
    await user.click(within(editor).getByRole('option', { name: 'Quarterly' }));
    await user.click(within(editor).getByRole('combobox', { name: 'Quarter months: Choose months' }));
    await user.click(within(editor).getByRole('option', { name: 'Jan · Apr · Jul · Oct' }));
    await user.click(within(editor).getByRole('combobox', { name: 'Repeat on: Choose a pattern' }));
    await user.click(within(editor).getByRole('option', { name: 'A date' }));
    await user.click(within(editor).getByRole('combobox', { name: 'Date: Choose a date' }));
    await user.click(within(editor).getByRole('option', { name: '1' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    const updatedCard = screen.getByRole('article', { name: 'Take a walk' });
    expect(within(updatedCard).getByText('Quarterly')).toBeTruthy();
    expect(within(updatedCard).queryByText('3 times a week')).toBeNull();

    const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = parsePreviewBackup(raw!, localDateString(new Date()));
    expect(parsed.valid).toBe(true);
    if (parsed.valid) {
      const walk = parsed.envelope.data.savedRhythms.find(rhythm => rhythm.id === 'sample-walk');
      expect(walk).toMatchObject({
        cadence: expect.stringContaining('quarter'),
        schedule: { frequency: 'quarterly', monthInQuarter: 1, pattern: { kind: 'dayOfMonth', day: 1 } }
      });
    }

    cleanup();
    render(<App />);
    const reloadedCard = screen.getByRole('article', { name: 'Take a walk' });
    expect(within(reloadedCard).getByText('Quarterly')).toBeTruthy();
    expect(within(reloadedCard).queryByText('3 times a week')).toBeNull();
    await user.click(within(reloadedCard).getByRole('button', { name: historyButtonName('View scores and history for Take a walk') }));
    const history = screen.getByRole('region', { name: 'History for Take a walk' });
    expect(history.querySelector('.rhythm-history-view__schedule')?.textContent)
      .toContain('1st day of the first month of every quarter');
  });

  it('exposes the exact v5 recovery copy after explicitly replacing v5 preview data', async () => {
    const user = userEvent.setup();
    const current = createPreviewEnvelope(createSamplePreviewData());
    const {
      rhythmCompletionOverrides: _overrides,
      removedSeedCompletionIds: _removedIds,
      ...v5Data
    } = current.data;
    const v5Raw = JSON.stringify({
      format: current.format,
      schemaVersion: 5,
      data: v5Data
    });
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, v5Raw);
    render(<App />);

    await openPreviewSettings(user);
    await user.click(screen.getByRole('button', { name: 'Reset sample data' }));
    const confirmation = await screen.findByRole('dialog', { name: 'Reset sample data?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Reset sample data' }));

    await waitFor(() => {
      expect(window.localStorage.getItem(PREVIEW_V5_RECOVERY_KEY)).toBe(v5Raw);
      expect(screen.getByRole('button', { name: 'Download original v5 recovery backup' })).toBeTruthy();
    });
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).not.toBe(v5Raw);
  });

  it('keeps the Tend tagline above the greeting while removing the duplicate header date', () => {
    const { container } = render(<App />);
    const header = container.querySelector('.apphead')!;
    const greeting = screen.getByRole('heading', { name: /Good (morning|afternoon|evening)/ });

    expect(header.querySelector('.brand-tagline')?.textContent).toBe('Tend to what matters');
    expect(header.querySelector('.sub')).toBeNull();
    expect(header.compareDocumentPosition(greeting) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('.dashboard-greeting .hint')?.textContent).toMatch(/,\s+\w+\s+\d+/);
  });

  it('uses shared full-detail cards on Today and preserves the catalogue RhythmCard', () => {
    const { container } = render(<App />);
    const todayCard = screen.getByRole('article', { name: 'Pray together' });
    expect(todayCard.classList.contains('today-rhythm-details-dialog--inline')).toBe(true);
    expect(within(todayCard).getByRole('button', { name: historyButtonName('View scores and history for Pray together') })).toBeTruthy();
    expect(within(todayCard).getByRole('button', { name: 'Tend Pray together' })).toBeTruthy();
    expect(within(todayCard).getByText('Take a quiet moment to pray together and begin the day connected.')).toBeTruthy();
    expect(within(todayCard).getByText('Due today')).toBeTruthy();
    expect(within(todayCard).queryByRole('button', { name: 'Details for Pray together' })).toBeNull();
    expect(within(todayCard).queryByRole('button', { name: 'Close details' })).toBeNull();
    expect(within(todayCard).queryByRole('button', { name: /Back/ })).toBeNull();
    const todayCardCount = container.querySelectorAll('.today-rhythm-details-dialog--inline').length;

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

    await user.click(within(screen.getByRole('navigation', { name: 'Tools and navigation' }))
      .getByRole('button', { name: 'Today' }));
    expect(screen.getByText('0 of 3 tended')).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Pray together' }))
      .getByRole('button', { name: 'Tend Pray together' })).toBeTruthy();
  });

  it('opens the shared history modal directly from the chart action', async () => {
    const user = userEvent.setup();
    render(<App />);
    const card = screen.getByRole('article', { name: 'Pray together' });
    const chartOpener = within(card).getByRole('button', { name: historyButtonName('View scores and history for Pray together') });
    await user.click(chartOpener);
    const dialog = await screen.findByRole('dialog', { name: 'Pray together' });
    expect(within(dialog).getByRole('region', { name: 'History for Pray together' })).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(chartOpener);
    expect(within(card).getByRole('button', { name: 'Tend Pray together' })).toBeTruthy();
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

  it('saves a dated completion from the inline card and opens its chart directly', async () => {
    const user = userEvent.setup();
    render(<App />);

    const opener = screen.getByRole('button', { name: historyButtonName('View scores and history for Pray together') });
    const cardTend = screen.getByRole('button', { name: 'Tend Pray together' });
    await user.click(cardTend);
    const completionDialog = screen.getByRole('dialog', { name: 'When did you tend it?' });
    expect(within(completionDialog).getAllByText('Pray together')).toHaveLength(1);
    await user.click(within(completionDialog).getByRole('button', { name: 'Save' }));
    expect(screen.getByText('1 of 3 tended')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tended Pray together' }).matches(':disabled')).toBe(true);
    expect(document.activeElement).toBe(opener);

    await user.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Pray together' });
    expect(screen.getByText('1 of 3 tended')).toBeTruthy();
    expect(within(dialog).getByRole('region', { name: 'History for Pray together' })).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Pray together' }))
      .getByRole('button', { name: 'Tended Pray together' }).matches(':disabled')).toBe(true);
    expect(within(screen.getByRole('article', { name: 'Pray together' })).getByText('Tended today')).toBeTruthy();
    await waitFor(() => {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
      expect(raw).not.toBeNull();
      if (raw === null) return;
      const parsed = parsePreviewBackup(raw, localDateString(new Date()));
      expect(parsed.valid && parsed.envelope.data.completedRhythmIds).toContain('sample-pray-together');
      expect(parsed.valid && parsed.envelope.data.datedRhythmCompletions).toHaveLength(1);
      expect(parsed.valid && parsed.envelope.data.activeRhythmCompletions).toEqual([
        { rhythmId: 'sample-pray-together', completionId: expect.any(String) }
      ]);
    });

    await user.click(within(dialog).getByRole('button', { name: 'Close details' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(opener);

    const undo = screen.getByRole('button', { name: 'Undo completion for Pray together' });
    await user.click(undo);
    expect(screen.getByRole('button', { name: 'Tend Pray together' })).toBe(document.activeElement);
  });

  it('uses effective dates for backdated and today card status, and restores the latest date after deletion', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const card = screen.getByRole('article', { name: 'Take a walk' });
    const backdated = new Date();
    backdated.setDate(backdated.getDate() - 10);
    const backdatedDate = localDateString(backdated);
    const backdatedLabel = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(`${backdatedDate}T12:00:00`));

    await user.click(within(card).getByRole('button', { name: 'Tend Take a walk' }));
    const backdatedDialog = screen.getByRole('dialog', { name: 'When did you tend it?' });
    fireEvent.change(within(backdatedDialog).getByLabelText('Date'), { target: { value: backdatedDate } });
    await user.click(within(backdatedDialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(within(card).getByRole('button', { name: 'Tend Take a walk' })).toBeTruthy();
      expect(within(card).getByText(`Last tended ${backdatedLabel}`)).toBeTruthy();
    });
    let saved = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    expect(saved.envelope.data.datedRhythmCompletions[0]?.effectiveDate).toBe(backdatedDate);
    expect(saved.envelope.data.completedRhythmIds).toContain('sample-walk');

    await user.click(within(card).getByRole('button', { name: 'Tend Take a walk' }));
    const todayDialog = screen.getByRole('dialog', { name: 'When did you tend it?' });
    await user.click(within(todayDialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(within(card).getByRole('button', { name: 'Tended Take a walk' }).matches(':disabled')).toBe(true);
      expect(within(card).getByText('Tended today')).toBeTruthy();
    });
    expect(within(card).getByRole('button', { name: 'Undo completion for Take a walk' })).toBeTruthy();

    await user.click(within(card).getByRole('button', { name: historyButtonName('View scores and history for Take a walk') }));
    const details = screen.getByRole('dialog', { name: 'Take a walk' });
    const history = within(details).getByRole('region', { name: 'History for Take a walk' });
    await user.click(within(history).getByText('Logged moments (2)'));
    const todayLongDate = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date());
    const todayDeleteButton = within(history).getAllByRole('button', {
      name: /^Delete logged moment for Take a walk,/
    }).find(button => button.getAttribute('aria-label')?.includes(todayLongDate));
    expect(todayDeleteButton).toBeTruthy();
    await user.click(todayDeleteButton!);
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete moment' }));

    await waitFor(() => {
      expect(within(card).getByRole('button', { name: 'Tend Take a walk' })).toBeTruthy();
      expect(within(card).getByText(`Last tended ${backdatedLabel}`)).toBeTruthy();
    });
    saved = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(saved.valid && saved.envelope.data.datedRhythmCompletions).toHaveLength(1);
    expect(saved.valid && saved.envelope.data.datedRhythmCompletions[0]?.effectiveDate).toBe(backdatedDate);
    expect(saved.valid && saved.envelope.data.completedRhythmIds).not.toContain('sample-walk');
    expect(saved.valid && saved.envelope.data.activeRhythmCompletions).toEqual([]);
  });

  it('logs repeated moments in expanded history without changing Tend Undo or the latest effective date', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const card = screen.getByRole('article', { name: 'Take a walk' });
    await user.click(within(card).getByRole('button', { name: historyButtonName('View scores and history for Take a walk') }));
    const details = screen.getByRole('dialog', { name: 'Take a walk' });
    const history = within(details).getByRole('region', { name: 'History for Take a walk' });
    await user.click(within(history).getByText('Logged moments (0)'));
    let logButton = within(history).getByRole('button', { name: '+ Log a moment' });

    const latestDate = new Date();
    latestDate.setDate(latestDate.getDate() - 10);
    const latestDateString = localDateString(latestDate);
    const latestDateLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
      .format(new Date(`${latestDateString}T12:00:00`));
    await user.click(logButton);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: latestDateString } });
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'First history note' } });
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(within(history).getByRole('button', { name: '+ Log a moment' }));
    let parsed = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(parsed.valid && parsed.envelope.data.datedRhythmCompletions).toEqual([]);

    logButton = within(history).getByRole('button', { name: '+ Log a moment' });
    await user.click(logButton);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: latestDateString } });
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'First history note' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(document.activeElement).toBe(within(history).getByRole('button', { name: '+ Log a moment' }));
    expect(document.querySelector('.visually-hidden[role="status"]')?.textContent).toBe('Moment logged.');
    expect(within(history).getByText('Logged moments (1)')).toBeTruthy();
    expect((within(history).getByRole('button', { name: '+ Log a moment' })
      .closest('details') as HTMLDetailsElement).open).toBe(true);
    expect(within(card).getByRole('button', { name: 'Tend Take a walk' })).toBeTruthy();
    expect(within(card).getByText(`Last tended ${latestDateLabel}`)).toBeTruthy();

    const olderDate = new Date(latestDate);
    olderDate.setDate(olderDate.getDate() - 2);
    const olderDateString = localDateString(olderDate);
    logButton = within(history).getByRole('button', { name: '+ Log a moment' });
    await user.click(logButton);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: olderDateString } });
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'Older history note' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(within(history).getByText('Logged moments (2)')).toBeTruthy();
    expect(within(history).getByText('First history note')).toBeTruthy();
    expect(within(history).getByText('Older history note')).toBeTruthy();
    expect(within(card).getByText(`Last tended ${latestDateLabel}`)).toBeTruthy();
    expect(within(card).queryByRole('button', { name: /^Undo completion/ })).toBeNull();
    parsed = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(parsed.valid && parsed.envelope.data.datedRhythmCompletions).toHaveLength(2);
    expect(parsed.valid && parsed.envelope.data.completedRhythmIds).not.toContain('sample-walk');
  });

  it('allows repeated logging from populated history and counts same-day moments as separate records', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const card = screen.getByRole('article', { name: 'Daily connection' });
    const initialHealth = within(card).getByRole('button', {
      name: historyButtonName('View scores and history for Daily connection')
    }).querySelector('.today-rhythm-details__history-score')?.textContent;
    await user.click(within(card).getByRole('button', { name: historyButtonName('View scores and history for Daily connection') }));
    const details = screen.getByRole('dialog', { name: 'Daily connection' });
    const history = within(details).getByRole('region', { name: 'History for Daily connection' });
    await user.click(within(history).getByText('Logged moments (3)'));
    let logButton = within(history).getByRole('button', { name: '+ Log a moment' });

    await user.click(logButton);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(document.activeElement).toBe(within(history).getByRole('button', { name: '+ Log a moment' }));
    expect(within(history).getByText('Logged moments (4)')).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Tended Daily connection' }).matches(':disabled')).toBe(true);
    expect(within(card).getByText('Tended today')).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'Undo completion for Daily connection' })).toBeNull();
    await waitFor(() => {
      const cardHealthButton = within(card).getByRole('button', {
        name: historyButtonName('View scores and history for Daily connection')
      });
      const cardHealth = cardHealthButton.querySelector('.today-rhythm-details__history-score')?.textContent;
      const historyHealth = history.querySelector('.rhythm-history-view__health-heading > span')?.textContent;
      expect(cardHealth).toBe(historyHealth);
      expect(cardHealth).not.toBe(initialHealth);
    });

    logButton = within(history).getByRole('button', { name: '+ Log a moment' });
    await user.click(logButton);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(within(history).getByText('Logged moments (5)')).toBeTruthy();
    const chart = within(history).getByRole('list', { name: 'Recorded completion count by date' });
    expect(chart.querySelector('li:last-child')?.getAttribute('aria-label'))
      .toMatch(/: 2 completions?, today$/);

    const parsed = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    const added = parsed.envelope.data.datedRhythmCompletions.filter(record => record.rhythmId === 'sample-connect');
    expect(added).toHaveLength(2);
    expect(new Set(added.map(record => record.id)).size).toBe(2);
    expect(parsed.envelope.data.completedRhythmIds).not.toContain('sample-connect');
  });

  it('cancels a card draft on Escape without saving and restores focus to Tend', async () => {
    const user = userEvent.setup();
    render(<App />);
    const opener = screen.getByRole('button', { name: 'Tend Pray together' });
    opener.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'When did you tend it?' })).toBeTruthy();
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'When did you tend it?' })).toBeNull());
    expect(document.activeElement).toBe(opener);
    const saved = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(saved.valid && saved.envelope.data.completedRhythmIds).not.toContain('sample-pray-together');
    expect(saved.valid && saved.envelope.data.datedRhythmCompletions).toEqual([]);
  });

  it('edits and deletes one logged completion from the direct history modal', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await saveCardCompletion(user, 'Pray together');

    const card = screen.getByRole('article', { name: 'Pray together' });
    await user.click(within(card).getByRole('button', { name: historyButtonName('View scores and history for Pray together') }));
    const details = await screen.findByRole('dialog', { name: 'Pray together' });
    let history = within(details).getByRole('region', { name: 'History for Pray together' });
    await user.click(within(history).getByText('Logged moments (1)'));

    const initial = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(initial.valid).toBe(true);
    if (!initial.valid) return;
    const originalRecord = initial.envelope.data.datedRhythmCompletions[0]!;
    const [originalHour, originalMinute] = originalRecord.localTime.split(':').map(Number);
    const [hour, period] = [
      originalHour! % 12 || 12,
      originalHour! < 12 ? 'AM' : 'PM'
    ] as const;
    const backdated = new Date();
    backdated.setDate(backdated.getDate() - 1);
    const newDate = localDateString(backdated);

    await user.click(screen.getByRole('button', { name: /^Edit logged moment for Pray together/ }));
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe(originalRecord.effectiveDate);
    expect(screen.getByRole('spinbutton', { name: 'Hour' }).getAttribute('aria-valuetext')).toBe(String(hour));
    expect(screen.getByRole('spinbutton', { name: 'Minute' }).getAttribute('aria-valuetext'))
      .toBe(String(originalMinute).padStart(2, '0'));
    expect(screen.getByRole('spinbutton', { name: 'AM / PM' }).getAttribute('aria-valuetext')).toBe(period);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: newDate } });
    const minuteKey = originalMinute! === 59 ? 'ArrowUp' : 'ArrowDown';
    const nextMinute = originalMinute! === 59 ? originalMinute! - 1 : originalMinute! + 1;
    fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Minute' }), { key: minuteKey });
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'Edited memory\nwith a second line.' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const expectedMinute = String(nextMinute).padStart(2, '0');
    await waitFor(() => {
      const saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
      expect(saved.valid).toBe(true);
      if (!saved.valid) return;
      expect(saved.envelope.data.datedRhythmCompletions).toHaveLength(1);
      expect(saved.envelope.data.datedRhythmCompletions[0]).toMatchObject({
        id: originalRecord.id,
        rhythmId: originalRecord.rhythmId,
        effectiveDate: newDate,
        localTime: `${String(originalHour).padStart(2, '0')}:${expectedMinute}`,
        timeZone: originalRecord.timeZone,
        recordedAt: originalRecord.recordedAt,
        memory: 'Edited memory\nwith a second line.'
      });
    });
    history = within(details).getByRole('region', { name: 'History for Pray together' });
    const chart = within(history).getByRole('list', { name: 'Recorded completion count by date' });
    expect([...chart.querySelectorAll('time')].map(time => time.getAttribute('dateTime'))).toContain(newDate);
    expect(history.querySelector('.rhythm-history-view__logged-entry-memory')?.textContent)
      .toBe('Edited memory\nwith a second line.');
    const backdatedLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
      .format(new Date(`${newDate}T12:00:00`));
    expect(within(card).getByRole('button', { name: 'Tend Pray together' })).toBeTruthy();
    expect(within(card).getByText(`Last tended ${backdatedLabel}`)).toBeTruthy();

    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const reloadedCard = screen.getByRole('article', { name: 'Pray together' });
    await user.click(within(reloadedCard).getByRole('button', { name: historyButtonName('View scores and history for Pray together') }));
    const reloadedDetails = await screen.findByRole('dialog', { name: 'Pray together' });
    const reloadedHistory = within(reloadedDetails).getByRole('region', { name: 'History for Pray together' });
    expect(within(reloadedCard).getByRole('button', { name: 'Tend Pray together' })).toBeTruthy();
    expect(within(reloadedCard).getByText(`Last tended ${backdatedLabel}`)).toBeTruthy();
    await user.click(within(reloadedHistory).getByText('Logged moments (1)'));
    expect([...within(reloadedHistory).getByRole('list', { name: 'Recorded completion count by date' }).querySelectorAll('time')]
      .map(time => time.getAttribute('dateTime'))).toContain(newDate);
    expect(reloadedHistory.querySelector('.rhythm-history-view__logged-entry-memory')?.textContent)
      .toBe('Edited memory\nwith a second line.');
    const deleteLabel = /^Delete logged moment for Pray together/;
    await user.click(screen.getByRole('button', { name: deleteLabel }));
    const confirmation = screen.getByRole('alertdialog');
    expect(within(confirmation).getByText(new RegExp(`Delete Pray together from .* at `))).toBeTruthy();
    const cancelDelete = within(confirmation).getByRole('button', { name: 'Cancel' });
    await user.click(cancelDelete);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: deleteLabel }));

    await user.click(screen.getByRole('button', { name: deleteLabel }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete moment' }));
    expect(within(reloadedHistory).getByText('Your story starts with the first Tend.')).toBeTruthy();
    expect(document.activeElement).toBe(within(reloadedHistory).getByText('Logged moments (0)'));
    const savedAfterDelete = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(savedAfterDelete.valid && savedAfterDelete.envelope.data.datedRhythmCompletions).toEqual([]);
    expect(savedAfterDelete.valid && savedAfterDelete.envelope.data.activeRhythmCompletions).toEqual([]);
    expect(savedAfterDelete.valid && savedAfterDelete.envelope.data.completedRhythmIds).not.toContain('sample-pray-together');
    expect(within(reloadedCard).getByText('Due today')).toBeTruthy();
    const detailsOpener = within(reloadedCard).getByRole('button', { name: historyButtonName('View scores and history for Pray together') });
    await user.click(within(reloadedHistory).getByRole('button', { name: 'Close details' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(detailsOpener);
    expect(within(reloadedCard).getByRole('button', { name: 'Tend Pray together' })).toBeTruthy();

    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    expect(screen.getByRole('button', { name: 'Tend Pray together' })).toBeTruthy();
  });

  it('keeps chart totals and logged moments aligned and Undo removes only its own record', async () => {
    const user = userEvent.setup();
    render(<App />);
    const rhythmTitle = 'Daily connection';
    await user.click(screen.getByRole('button', { name: `Tend ${rhythmTitle}` }));
    const completionDialog = screen.getByRole('dialog', { name: 'When did you tend it?' });
    await user.type(within(completionDialog).getByLabelText(/Notes/), 'A meaningful conversation.');
    await user.click(within(completionDialog).getByRole('button', { name: 'Save' }));

    const card = screen.getByRole('article', { name: rhythmTitle });
    await waitFor(() => {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
      expect(raw).not.toBeNull();
      if (!raw) return;
      const parsed = parsePreviewBackup(raw, localDateString(new Date()));
      expect(parsed.valid && parsed.envelope.data.datedRhythmCompletions).toHaveLength(1);
      expect(parsed.valid && parsed.envelope.data.datedRhythmCompletions[0]?.memory).toBe('A meaningful conversation.');
    });
    await user.click(within(card).getByRole('button', { name: historyButtonName(`View scores and history for ${rhythmTitle}`) }));
    const details = screen.getByRole('dialog', { name: rhythmTitle });
    const history = within(details).getByRole('region', { name: `History for ${rhythmTitle}` });
    const chart = within(history).getByRole('list', { name: 'Recorded completion count by date' });
    expect(history.querySelector('.rhythm-history-view__completion-total strong')?.textContent).toBe('4');
    const chartTotal = [...chart.querySelectorAll('li')].reduce((sum, day) => {
      return sum + Number(day.getAttribute('aria-label')?.match(/: (\d+)/)?.[1] ?? 0);
    }, 0);
    expect(chartTotal).toBe(4);
    expect(chart.querySelector('li:last-child time')?.getAttribute('dateTime'))
      .toBe(localDateString(new Date()));
    expect(chart.querySelector('li:last-child')?.getAttribute('aria-label'))
      .toContain('1 completion, today');
    await user.click(within(history).getByText('Logged moments (4)'));
    const loggedMoments = history.querySelectorAll('.rhythm-history-view__logged-moments li');
    expect(loggedMoments).toHaveLength(chartTotal);
    expect(within(history).getByText('A meaningful conversation.')).toBeTruthy();
    const savedRecord = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(savedRecord.valid).toBe(true);
    if (savedRecord.valid) {
      const record = savedRecord.envelope.data.datedRhythmCompletions[0]!;
      const [hour, minute] = record.localTime.split(':').map(Number);
      const period = hour! < 12 ? 'AM' : 'PM';
      const displayTime = `${hour! % 12 || 12}:${String(minute).padStart(2, '0')} ${period}`;
      const editableEntry = history.querySelector('.rhythm-history-view__logged-entry') as HTMLLIElement;
      expect(editableEntry.querySelector('.rhythm-history-view__logged-entry-date')?.textContent)
        .toContain(displayTime);
      expect(within(editableEntry).getByRole('button', {
        name: new RegExp(`^Edit logged moment for ${rhythmTitle}, .* at ${displayTime}$`)
      })).toBeTruthy();
      expect(within(editableEntry).getByRole('button', {
        name: new RegExp(`^Delete logged moment for ${rhythmTitle}, .* at ${displayTime}$`)
      })).toBeTruthy();
    }

    await user.click(within(history).getByRole('button', { name: 'Close details' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(within(card).getByRole('button', { name: `Undo completion for ${rhythmTitle}` }));
    expect(within(card).getByRole('button', { name: `Tend ${rhythmTitle}` })).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: historyButtonName(`View scores and history for ${rhythmTitle}`) }));
    const reopenedDetails = screen.getByRole('dialog', { name: rhythmTitle });
    const historyAfterUndo = within(reopenedDetails).getByRole('region', { name: `History for ${rhythmTitle}` });
    expect(historyAfterUndo.querySelector('.rhythm-history-view__completion-total strong')?.textContent).toBe('3');
    expect(within(historyAfterUndo).queryByText('A meaningful conversation.')).toBeNull();
    const saved = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(saved.valid && saved.envelope.data.datedRhythmCompletions).toEqual([]);
    expect(saved.valid && saved.envelope.data.completedRhythmIds).not.toContain('sample-connect');
  });

  it('edits and removes date-only seeded logs without inventing unknown times', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');

    const title = 'Daily connection';
    await user.click(screen.getByRole('button', { name: historyButtonName(`View scores and history for ${title}`) }));
    const details = screen.getByRole('dialog', { name: title });
    const history = within(details).getByRole('region', { name: `History for ${title}` });
    await user.click(within(history).getByText('Logged moments (3)'));

    const firstLabel = /Edit logged moment for Daily connection, Tuesday, October 20, 2026/;
    await user.click(within(history).getByRole('button', { name: firstLabel }));
    expect(screen.getByRole('heading', { name: 'Edit logged moment' })).toBeTruthy();
    expect(screen.queryByRole('spinbutton', { name: 'Hour' })).toBeNull();
    expect(screen.getByText('Add time')).toBeTruthy();
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-10-20');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-16' } });
    await user.type(screen.getByLabelText(/Notes/), 'A remembered sample moment.');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
      expect(saved.valid).toBe(true);
      if (!saved.valid) return;
      expect(saved.envelope.data.rhythmCompletionOverrides).toEqual([{
        id: 'sample-connect-2026-10-20',
        rhythmId: 'sample-connect',
        effectiveDate: '2026-10-16',
        memory: 'A remembered sample moment.'
      }]);
    });
    expect(history.querySelector('.rhythm-history-view__completion-total strong')?.textContent).toBe('3');
    expect(within(history).getByText('A remembered sample moment.')).toBeTruthy();
    expect(within(history).getAllByText('Time not recorded').length).toBeGreaterThan(0);

    await user.click(within(history).getByRole('button', {
      name: /Edit logged moment for Daily connection, Friday, October 16, 2026/
    }));
    await user.click(screen.getByRole('button', { name: 'Add time' }));
    const hour = screen.getByRole('spinbutton', { name: 'Hour' });
    hour.focus();
    fireEvent.keyDown(hour, { key: 'ArrowUp' });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      const saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
      expect(saved.valid && saved.envelope.data.rhythmCompletionOverrides[0]).toMatchObject({
        id: 'sample-connect-2026-10-20',
        rhythmId: 'sample-connect',
        effectiveDate: '2026-10-16',
        memory: 'A remembered sample moment.',
        localTime: expect.any(String),
        timeZone: expect.any(String),
        completedAt: expect.any(String)
      });
      expect(saved.valid && saved.envelope.data.rhythmCompletionOverrides[0]?.recordedAt).toBeUndefined();
    });

    const removeLabel = /Delete logged moment for Daily connection, Sunday, October 18, 2026/;
    await user.click(within(history).getByRole('button', { name: removeLabel }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(within(history).getByRole('button', { name: removeLabel })).toBeTruthy();
    await user.click(within(history).getByRole('button', { name: removeLabel }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete moment' }));
    expect(history.querySelector('.rhythm-history-view__completion-total strong')?.textContent).toBe('2');
    await waitFor(() => {
      const saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
      expect(saved.valid && saved.envelope.data.removedSeedCompletionIds).toContain('sample-connect-2026-10-18');
    });

    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(screen.getByRole('button', { name: historyButtonName(`View scores and history for ${title}`) }));
    const reloadedDetails = screen.getByRole('dialog', { name: title });
    const reloadedHistory = within(reloadedDetails).getByRole('region', { name: `History for ${title}` });
    expect(reloadedHistory.querySelector('.rhythm-history-view__completion-total strong')?.textContent).toBe('2');
    await user.click(within(reloadedHistory).getByText('Logged moments (2)'));
    expect(within(reloadedHistory).queryByText('Sunday, October 18, 2026')).toBeNull();
    expect(within(reloadedHistory).getByText('A remembered sample moment.')).toBeTruthy();
  });

  it('opens chart history directly by keyboard and restores focus on Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    const opener = screen.getByRole('button', { name: historyButtonName('View scores and history for Pray together') });

    opener.focus();
    expect(document.activeElement).toBe(opener);
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Pray together' });
    const history = within(dialog).getByRole('region', { name: 'History for Pray together' });
    expect(dialog.classList.contains('today-rhythm-details-dialog--history')).toBe(true);
    expect(history.querySelector('.rhythm-history-view__rhythm-header')).toBeTruthy();
    expect(history.querySelector('.rhythm-history-view__body--dialog')).toBeTruthy();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it('undoes only the selected card completion and persists Tend and Undo across reloads', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await saveCardCompletion(user, 'Pray together');
    await saveCardCompletion(user, 'Daily connection');
    await waitFor(() => {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
      expect(raw).not.toBeNull();
      if (!raw) return;
      const parsed = parsePreviewBackup(raw, localDateString(new Date()));
      expect(parsed.valid && parsed.envelope.data.completedRhythmIds).toEqual([
        'sample-pray-together',
        'sample-connect'
      ]);
      expect(parsed.valid && parsed.envelope.data.datedRhythmCompletions).toHaveLength(2);
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

  it('uses the shared recording modal from inline cards and returns focus after Cancel and Close', async () => {
    const user = userEvent.setup();
    render(<App />);
    const tend = screen.getByRole('button', { name: 'Tend Pray together' });
    const expectedFormClass = 'rhythm-completion-form--dialog-layout';
    await screen.findByText('Preview data saved in this browser.');
    const savedBeforeDismissal = window.localStorage.getItem(PREVIEW_STORAGE_KEY);

    for (const action of ['Cancel', 'Close completion', 'Escape', 'Keyboard close'] as const) {
      await user.click(tend);
      const completionDialog = screen.getByRole('dialog', { name: 'When did you tend it?' });
      expect(completionDialog.querySelector('form')?.className).toContain(expectedFormClass);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      fireEvent.change(within(completionDialog).getByLabelText('Date'), {
        target: { value: localDateString(yesterday) }
      });
      await user.type(within(completionDialog).getByLabelText(/Notes/), `Unsaved ${action}`);
      if (action === 'Cancel') {
        await user.click(within(completionDialog).getByRole('button', { name: action }));
      } else if (action === 'Escape') {
        await user.keyboard('{Escape}');
      } else {
        const close = within(completionDialog).getByRole('button', { name: 'Close completion' });
        expect(close.getAttribute('type')).toBe('button');
        if (action === 'Keyboard close') {
          close.focus();
          await user.keyboard('{Enter}');
        } else {
          await user.click(close);
        }
      }
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(document.activeElement).toBe(tend);
      expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(savedBeforeDismissal);
    }
  });

  it('returns focus to the originating inline Tend control after Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    const tend = screen.getByRole('button', { name: 'Tend Pray together' });
    await user.click(tend);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(tend);
    expect(parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    ).valid).toBe(true);
  });

  it('shows the shared empty placeholder for each Today tab based on its displayed Rhythms', async () => {
    const user = userEvent.setup();
    render(<App />);

    const panel = screen.getByRole('tabpanel');
    const expectOneEmptyPlaceholder = () => {
      expect(within(panel).getByRole('status').textContent).toBe('No active Rhythms.');
      expect(panel.querySelectorAll('.dashed-empty-state')).toHaveLength(1);
      expect(panel.querySelector('.dashed-empty-state')?.textContent).toBe('No active Rhythms.');
    };

    expect(within(panel).getAllByRole('article').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('tab', { name: 'Anytime' }));
    expectOneEmptyPlaceholder();
    await user.click(screen.getByRole('tab', { name: 'All-day' }));
    expectOneEmptyPlaceholder();

    await user.click(screen.getByRole('tab', { name: 'Scheduled' }));
    const search = screen.getByRole('searchbox', { name: 'Search sample Rhythms' });
    await user.type(search, 'no matching Rhythm');
    expectOneEmptyPlaceholder();

    await user.click(screen.getByRole('tab', { name: 'Anytime' }));
    expectOneEmptyPlaceholder();
    await user.click(screen.getByRole('tab', { name: 'All-day' }));
    expectOneEmptyPlaceholder();

    await user.clear(search);
    await user.click(screen.getByRole('tab', { name: 'Scheduled' }));
    expect(screen.getByRole('article', { name: 'Take a walk' })).toBeTruthy();
    expect(panel.querySelector('.dashed-empty-state')).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Anytime' }));
    expectOneEmptyPlaceholder();
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
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    const addButton = screen.getByRole('button', { name: 'Add Rhythm' });
    await user.click(addButton);
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    expect(within(editor).queryByRole('button', { name: /Archive/ })).toBeNull();
    expect(within(editor).queryByRole('checkbox', { name: 'Personal' })).toBeNull();
    await user.type(within(editor).getByLabelText('Title'), 'After-lunch walk');
    await user.type(within(editor).getByLabelText('Description (optional)'), 'A small sample habit.');
    await user.click(within(editor).getByRole('combobox', { name: 'Frequency: Daily' }));
    await user.click(within(editor).getByRole('option', { name: 'Select Days' }));
    await user.click(within(editor).getByRole('checkbox', { name: 'Monday' }));
    await user.click(within(editor).getByRole('checkbox', { name: 'Wednesday' }));
    await user.click(within(editor).getByRole('combobox', { name: 'Time of day: Anytime' }));
    await user.click(within(editor).getByRole('option', { name: 'Afternoon' }));
    await user.click(within(editor).getByRole('button', { name: /^Choose people/ }));
    let association = associationPicker('Choose people');
    await user.click(within(association).getByRole('button', { name: 'Select Marriage people' }));
    expect(within(association).getByRole('button', { name: 'Avery Brooks' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(association).getByRole('button', { name: 'Morgan Reed' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(association).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: /^Choose categories/ }));
    association = associationPicker('Choose categories');
    await user.click(within(association).getByRole('button', { name: 'Marriage' }));
    await user.click(within(association).getByRole('button', { name: 'Done' }));
    expect(within(editor).getByRole('button', { name: /^Choose categories/ })).toBeTruthy();
    expect(within(editor).getByRole('button', { name: /^Choose people/ })).toBeTruthy();
    expect(within(editor).getByRole('region', { name: 'Associations' })).toBeTruthy();
    const selectedPeople = within(editor).getByRole('button', { name: /^Choose people,/ });
    expect(within(selectedPeople).getByRole('img', { name: 'Morgan Reed' }).querySelector('.person-badge-visual'))
      .toBeTruthy();
    expect(within(selectedPeople).queryByRole('button')).toBeNull();
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    let rhythmCard = screen.getByRole('article', { name: 'After-lunch walk' });
    expect(within(rhythmCard).getByRole('button', { name: 'Open synthetic profile for Avery Brooks' })).toBeTruthy();
    await saveCardCompletion(user, 'After-lunch walk');

    const editButton = within(rhythmCard).getByRole('button', { name: 'Edit After-lunch walk' });
    editButton.focus();
    await user.keyboard('{Enter}');
    const edit = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    const title = within(edit).getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Walk after lunch');
    await user.click(within(edit).getByRole('button', { name: /^Choose people/ }));
    association = associationPicker('Choose people');
    await user.click(within(association).getByRole('button', { name: 'Jordan Bell' }));
    await user.click(within(association).getByRole('button', { name: 'Done' }));
    await user.click(within(edit).getByRole('button', { name: 'Save Rhythm' }));

    expect(document.activeElement).toBe(editButton);
    rhythmCard = screen.getByRole('article', { name: 'Walk after lunch' });
    expect(within(rhythmCard).getByRole('button', { name: 'Tended Walk after lunch' }).matches(':disabled')).toBe(true);
    expect(within(rhythmCard).getByRole('button', { name: 'Open synthetic profile for Avery Brooks' })).toBeTruthy();
    expect(within(rhythmCard).getByRole('button', { name: 'Open synthetic profile for Morgan Reed' })).toBeTruthy();
    expect(within(rhythmCard).getByRole('button', { name: 'Open synthetic profile for Jordan Bell' })).toBeTruthy();

    const savedRaw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    expect(savedRaw).not.toBeNull();
    const saved = parsePreviewBackup(savedRaw!, localDateString(new Date()));
    expect(saved.valid).toBe(true);
    if (saved.valid) {
      expect(saved.envelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
      expect(saved.envelope.data.savedRhythms).toHaveLength(1);
      expect(saved.envelope.data.savedRhythms[0]).toMatchObject({
        id: expect.stringMatching(/^user-rhythm-/),
        title: 'Walk after lunch',
        cadence: 'Every week on Monday and Wednesday.',
        personIds: ['sample-person-avery', 'sample-person-morgan', 'sample-person-jordan'],
        categoryIds: ['marriage'],
        schedule: { frequency: 'weekly', weekdays: [1, 3] },
      });
      expect(saved.envelope.data.completedRhythmIds).toContain(saved.envelope.data.savedRhythms[0]!.id);
    }

    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Browse suggestions' }));
    const picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    const suggestionHeading = within(picker).getByRole('heading', { name: 'Dream Together' });
    const suggestion = suggestionHeading.closest('li')!;
    expect(within(suggestion).queryByRole('button', { name: /Tend|Edit rhythm|View scores/ })).toBeNull();
    expect(within(suggestion).getByRole('button', { name: 'Add' })).toBeTruthy();

    unmount();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await waitFor(() => {
      expect(screen.getByRole('article', { name: 'Walk after lunch' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Tended Walk after lunch' }).matches(':disabled')).toBe(true);
    });
    const reloadedCard = screen.getByRole('article', { name: 'Walk after lunch' });
    expect(reloadedCard.querySelector('.rhythm-metadata-schedule-group')?.textContent)
      .toContain('Mon · Wed');
    expect(within(reloadedCard).getByRole('button', { name: 'Open synthetic profile for Morgan Reed' })).toBeTruthy();
    expect(within(reloadedCard).getByRole('button', { name: 'Open synthetic profile for Jordan Bell' })).toBeTruthy();
    await user.click(within(reloadedCard).getByRole('button', { name: 'Edit Walk after lunch' }));
    const reloadedEditor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    expect(within(reloadedEditor).getByRole('button', {
      name: 'Change frequency, currently Mon · Wed'
    })).toBeTruthy();
    expect(within(reloadedEditor).queryByRole('combobox', { name: /Frequency:/ })).toBeNull();
    await user.click(within(reloadedEditor).getByRole('button', { name: 'Change frequency, currently Mon · Wed' }));
    expect(within(reloadedEditor).getByRole('combobox', { name: 'Frequency: Select Days' })).toBeTruthy();
    expect((within(reloadedEditor).getByRole('checkbox', { name: 'Monday' }) as HTMLInputElement).checked).toBe(true);
    expect((within(reloadedEditor).getByRole('checkbox', { name: 'Wednesday' }) as HTMLInputElement).checked).toBe(true);
    expect(within(reloadedEditor).getByRole('button', { name: /^Choose categories/ })).toBeTruthy();
    expect(within(reloadedEditor).getByRole('button', { name: /^Choose people/ })).toBeTruthy();
    await user.click(within(reloadedEditor).getByRole('button', { name: /^Choose people/ }));
    association = associationPicker('Choose people');
    expect(within(association).getByRole('button', { name: 'Select Marriage people' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(association).getByRole('button', { name: 'Cancel' }));
    await user.click(within(reloadedEditor).getByRole('button', { name: /^Choose categories/ }));
    association = associationPicker('Choose categories');
    expect(within(association).getByRole('button', { name: 'Marriage' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(association).getByRole('button', { name: 'Cancel' }));
    await user.click(within(reloadedEditor).getByRole('button', { name: 'Cancel' }));
    await user.click(within(reloadedCard).getByRole('button', {
      name: historyButtonName('View scores and history for Walk after lunch')
    }));
    expect(screen.getByRole('dialog', { name: 'Walk after lunch' })).toBeTruthy();
    const scheduleHistory = screen.getByRole('region', { name: 'History for Walk after lunch' });
    expect(within(scheduleHistory).getAllByText('Mon · Wed').length).toBeGreaterThan(0);
    expect(within(scheduleHistory).getByText('Afternoon')).toBeTruthy();
  });

  it('validates Rhythm fields, cancels without saving, and restores focus to Add Rhythm', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
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
    await saveCardCompletion(user, 'Pray together');
    const card = screen.getByRole('article', { name: 'Pray together' });
    await user.click(within(card).getByRole('button', { name: 'Edit Pray together' }));
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    expect(within(editor).getByRole('button', { name: 'Change frequency, currently Daily' })).toBeTruthy();
    expect(within(editor).getByText('Daily')).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(within(card).getByRole('button', { name: 'Tended Pray together' }).matches(':disabled')).toBe(true);
    expect(card.textContent).toContain('Tended today');
    await waitFor(() => {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
      expect(raw).not.toBeNull();
      if (!raw) return;
      const parsed = parsePreviewBackup(raw, localDateString(new Date()));
      expect(parsed.valid && parsed.envelope.data.completedRhythmIds).toContain('sample-pray-together');
      expect(parsed.valid && parsed.envelope.data.savedRhythms[0]?.cadence).toBe('Daily');
      expect(parsed.valid && parsed.envelope.data.savedRhythms[0]?.schedule).toBeUndefined();
    });
  });

  it('archives a saved fixture without saving cancelled edits, then restores its identity and history', async () => {
    const user = userEvent.setup();
    render(<App />);
    await saveCardCompletion(user, 'Pray together');
    const originalCard = screen.getByRole('article', { name: 'Pray together' });
    await user.click(within(originalCard).getByRole('button', { name: 'Edit Pray together' }));

    let editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    const title = within(editor).getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Updated prayer rhythm');
    await user.click(within(editor).getByRole('button', { name: /^Choose categories/ }));
    const association = associationPicker('Choose categories');
    await user.click(within(association).getByRole('button', { name: 'Marriage' }));
    await user.click(within(association).getByRole('button', { name: 'Done' }));
    expect(within(editor).queryByRole('checkbox', { name: 'Personal' })).toBeNull();
    await user.click(within(editor).getByRole('button', { name: 'Change frequency, currently Daily' }));
    await user.click(within(editor).getByRole('combobox', { name: 'Frequency: Daily' }));
    await user.click(within(editor).getByRole('option', { name: 'Weekly' }));
    await user.click(within(editor).getByRole('radio', { name: 'Monday' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    await user.click(within(screen.getByRole('dialog', { name: 'Change schedule' }))
      .getByRole('button', { name: 'Apply' }));
    const updatedCard = screen.getByRole('article', { name: 'Updated prayer rhythm' });
    expect(updatedCard.querySelector('.rhythm-metadata-schedule-group')?.textContent).toContain('Every Mon');
    await user.click(within(updatedCard).getByRole('button', { name: 'Edit Updated prayer rhythm' }));
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
        categoryIds: ['marriage'],
        cadence: 'Every week on Monday.',
        schedule: { frequency: 'weekly', weekdays: [1] },
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
    expect(screen.queryByRole('article', { name: 'Updated prayer rhythm' })).toBeNull();
    expect(document.activeElement).toBe(
      within(screen.getByRole('navigation', { name: 'Tools and navigation' }))
        .getByRole('button', { name: 'Today' })
    );
    await waitFor(() => {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
      expect(raw).not.toBeNull();
      if (!raw) return;
      const parsed = parsePreviewBackup(raw, localDateString(new Date()));
      expect(parsed.valid && parsed.envelope.data.savedRhythms[0]).toMatchObject({
        id: 'sample-pray-together',
        title: 'Updated prayer rhythm',
        personIds: ['sample-person-avery', 'sample-person-morgan'],
        categoryIds: ['marriage'],
        cadence: 'Every week on Monday.',
        schedule: { frequency: 'weekly', weekdays: [1] }
      });
      expect(parsed.valid && parsed.envelope.data.completedRhythmIds).toContain('sample-pray-together');
      expect(parsed.valid && parsed.envelope.data.archivedRhythmIds).toEqual(['sample-pray-together']);
    });

    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.queryByRole('article', { name: 'Updated prayer rhythm' })).toBeNull();
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
      name: historyButtonName('View scores and history for Updated prayer rhythm')
    })).toBeTruthy();
    expect(archivedDetails.querySelector('.rhythm-metadata-schedule-group')?.textContent).toContain('Every Mon');
    expect(within(archivedDetails).queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(within(archivedDetails).queryByRole('button', { name: 'Tend Updated prayer rhythm' })).toBeNull();
    expect(within(archivedDetails).queryByRole('button', { name: /Undo completion/ })).toBeNull();
    expect(within(archivedDetails).queryByRole('button', { name: 'Close details' })).toBeNull();
    expect(within(archiveDialog).getAllByRole('button', { name: /Close/ })).toHaveLength(1);
    const archivedHistory = within(archivedDetails).getByRole('button', {
      name: historyButtonName('View scores and history for Updated prayer rhythm')
    });
    await user.click(archivedHistory);
    expect(within(archivedDetails).queryByRole('button', { name: '+ Log a moment' })).toBeNull();
    expect(within(archivedDetails).queryByRole('button', { name: /^Edit logged moment/ })).toBeNull();
    expect(within(archivedDetails).queryByRole('button', { name: /^Delete logged moment/ })).toBeNull();
    expect(within(archivedDetails).queryByRole('button', { name: 'Back to rhythm details' })).toBeNull();
    expect(within(archivedDetails).getByRole('button', { name: 'Close details' })).toBeTruthy();
    await user.click(within(archivedDetails).getByRole('button', { name: 'Close details' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Archived rhythms' })).toBeNull());
    expect(document.activeElement).toBe(archivedToggle);
    await user.click(archivedToggle);
    const reopenedArchiveDialog = screen.getByRole('dialog', { name: 'Archived rhythms' });
    const reopenedCard = within(reopenedArchiveDialog).getByRole('article', { name: 'Updated prayer rhythm' });
    const reopenedDetailsOpener = within(reopenedCard).getByRole('button', {
      name: 'Details for Updated prayer rhythm'
    });
    await user.click(reopenedDetailsOpener);
    const reopenedDetails = within(reopenedArchiveDialog).getByRole('region', { name: 'Updated prayer rhythm' });
    await user.click(within(reopenedDetails).getByRole('button', {
      name: historyButtonName('View scores and history for Updated prayer rhythm')
    }));
    expect(within(reopenedDetails).queryByRole('button', { name: 'Back to rhythm details' })).toBeNull();
    await user.click(within(reopenedArchiveDialog).getByRole('button', { name: 'Back to archived rhythms' }));
    expect(document.activeElement).toBe(reopenedDetailsOpener);

    const restoreButton = within(reopenedArchiveDialog).getByRole('button', {
      name: 'Restore rhythm Updated prayer rhythm'
    });
    restoreButton.focus();
    await user.keyboard('{Enter}');
    expect(within(reopenedArchiveDialog).getByRole('heading', { name: 'No archived Rhythms' })).toBeTruthy();
    expect(document.activeElement).toBe(within(reopenedArchiveDialog).getByRole('heading', { name: 'No archived Rhythms' }));
    const restoredCard = screen.getByRole('article', { name: 'Updated prayer rhythm' });
    expect(restoredCard).toBeTruthy();
    expect(within(screen.getByRole('article', { name: 'Updated prayer rhythm' })).queryByText('Archived', { exact: true })).toBeNull();
    expect(restoredCard.querySelector('.rhythm-metadata-schedule-group')?.textContent).toContain('Every Mon');
    await waitFor(() => {
      const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
      expect(raw).not.toBeNull();
      if (!raw) return;
      const parsed = parsePreviewBackup(raw, localDateString(new Date()));
      expect(parsed.valid && parsed.envelope.data.archivedRhythmIds).toEqual([]);
      expect(parsed.valid && parsed.envelope.data.savedRhythms.filter(rhythm => rhythm.id === 'sample-pray-together')).toHaveLength(1);
      expect(parsed.valid && parsed.envelope.data.completedRhythmIds).toContain('sample-pray-together');
    });

    await user.click(within(reopenedArchiveDialog).getByRole('button', { name: 'Close archived rhythms' }));
    expect(document.activeElement).toBe(archivedToggle);
    await user.click(within(screen.getByRole('navigation', { name: 'Tools and navigation' })).getByRole('button', { name: 'Today' }));
    expect(screen.getByText('1 of 3 tended')).toBeTruthy();
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
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
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

  it('routes Faith to shared Practice terminology and scoped scoring, then returns to Today', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Faith' }));
    expect(screen.getByRole('heading', { name: 'Faith' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Practices' })).toBeTruthy();
    expect(screen.queryByText('This destination is not implemented in this preview.')).toBeNull();
    await user.click(within(screen.getByRole('navigation', { name: 'Tools and navigation' }))
      .getByRole('button', { name: 'Today' }));
    expect(screen.getByRole('heading', { name: 'Your plan' })).toBeTruthy();
  });

  it('shows unavailable calculated Marriage summary values and routes its partner shortcut to People', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    expect(screen.getByRole('heading', { name: 'Marriage' })).toBeTruthy();
    expect(screen.getByText('Synthetic example')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Your partner/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Marriage Health' })).toBeTruthy();
    expect(screen.getByText('No scored Foundations yet')).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Marriage Health score' }).getAttribute('aria-valuenow')).toBeNull();
    expect(screen.getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBeNull();
    expect(screen.getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBeNull();
    expect(screen.queryByText('Illustrative sample values · not calculated')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show Marriage scoring explanation' }));
    const categoryExplanation = screen.getByRole('region', { name: 'Marriage Health explanation' });
    expect(within(categoryExplanation).getByText('Each scored Foundation counts equally.')).toBeTruthy();
    expect(within(categoryExplanation).getByText('75%')).toBeTruthy();
    expect(within(categoryExplanation).getByText('25%')).toBeTruthy();
    expect(within(categoryExplanation).getByText('Foundations need both scores to count.')).toBeTruthy();
    expect(within(categoryExplanation).queryByText(/Marriage Consistency and On Track average/)).toBeNull();
    expect(within(categoryExplanation).queryByText(/Health combines 75%/)).toBeNull();
    expect(screen.getByRole('tab', { name: 'Today' }).getAttribute('aria-selected')).toBe('true');
    const page = screen.getByRole('main', { name: 'Marriage' });
    const ids = [...page.querySelectorAll('[id]')].map(element => element.id);
    expect(new Set(ids).size).toBe(ids.length);

    await user.click(screen.getByRole('button', { name: /Your partner/ }));
    expect(screen.getByRole('heading', { name: 'People' })).toBeTruthy();
    expect(screen.getByText('This destination is not implemented in this preview.')).toBeTruthy();
  });

  it('keeps the shared score explanation scoped to the selected Category without changing saved data', async () => {
    const user = userEvent.setup();
    render(<App />);
    const savedPreview = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    const areas = within(screen.getByRole('navigation', { name: 'Areas' }));

    await user.click(areas.getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('button', { name: 'Show Marriage scoring explanation' }));
    expect(screen.getByRole('region', { name: 'Marriage Health explanation' })).toBeTruthy();

    await user.click(areas.getByRole('button', { name: 'Parenting' }));
    const parentingInfo = screen.getByRole('button', { name: 'Show Parenting scoring explanation' });
    expect(parentingInfo.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('region', { name: 'Parenting Health explanation' })).toBeNull();
    expect(screen.getByText('No scored Foundations yet')).toBeTruthy();
    await user.click(parentingInfo);
    expect(screen.getByText(/These scores reflect follow-through on chosen Rhythms\./)).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(savedPreview);
  });

  it('places the Foundation info button beside its title and keeps the description below', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Marriage' }));

    await user.click(screen.getByRole('tab', { name: 'Foundations' }));

    const foundationsSection = document.querySelector('.marriage-foundations-section')!;
    const titleRow = foundationsSection.querySelector('.marriage-foundations-section__title-row')!;
    const heading = within(titleRow as HTMLElement).getByRole('heading', { name: 'Marriage foundations' });
    const info = within(titleRow as HTMLElement).getByRole('button', {
      name: 'Show Foundation scoring explanation'
    });
    expect(heading.compareDocumentPosition(info) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(foundationsSection as HTMLElement).getByText('Ongoing areas of care.')).toBeTruthy();
    expect(foundationsSection.querySelector('.marriage-sample-tag')).toBeNull();
    expect(screen.getByText('Synthetic example')).toBeTruthy();

    await user.click(info);
    expect(screen.getByRole('region', { name: 'Each rhythm counts equally.' })).toBeTruthy();
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

  it('keeps Marriage Today empty and moves rhythm entry to the Rhythms tab', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));

    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.getByText('0 of 0 Rhythms tended today')).toBeTruthy();
    expect(within(document.getElementById('marriage-panel-today')!).getByText('No active Rhythms.')).toBeTruthy();
    expect(screen.queryByText('Daily Connection')).toBeNull();
    expect(screen.queryByText('Weekly connection')).toBeNull();
    expect(screen.queryByText(/\d+ active/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Rhythm' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Browse suggestions' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'View all rhythms' })).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.getByRole('heading', { name: 'Start with a rhythm.' })).toBeTruthy();
    const add = screen.getByRole('button', { name: 'Add Rhythm' });
    await user.click(add);
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(add);

    const browse = screen.getByRole('button', { name: 'Browse suggestions' });
    await user.click(browse);
    expect(screen.getByRole('tab', { name: 'Rhythms' }).getAttribute('aria-selected')).toBe('true');
    const picker = await screen.findByRole('dialog', { name: 'Marriage rhythms' });
    expect(within(picker).getByText('Choose a starting point. Make it yours.')).toBeTruthy();
    cancelNativeDialog(picker);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(browse);
  });

  it('uses the populated entry heading and the Today placeholder when active Rhythms are not due today', async () => {
    const user = userEvent.setup();
    const data = createSamplePreviewData();
    const weekdayOptions = [0, 1, 2, 3, 4, 5, 6] as const;
    const weekday = weekdayOptions[(new Date().getDay() + 1) % weekdayOptions.length]!;
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const rhythm = savedMarriageRhythm(
      'user-rhythm-20000000-0000-4000-8000-000000000003',
      'Weekly check-in'
    );
    rhythm.schedule = { frequency: 'weekly', weekdays: [weekday] };
    rhythm.cadence = `Every week on ${weekdayNames[weekday]}.`;
    data.savedRhythms = [rhythm];
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));

    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Marriage' }));

    expect(screen.getByText('All caught up. Nothing to tend to.')).toBeTruthy();
    expect(screen.getByText('0 of 0 Rhythms tended today')).toBeTruthy();
    expect(screen.queryByText(/\d+ active/)).toBeNull();
    expect(screen.queryByRole('article', { name: 'Weekly check-in' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Rhythm' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Browse suggestions' })).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.getByRole('heading', { name: 'Add a rhythm.' })).toBeTruthy();
    const weeklyGroup = screen.getByRole('region', { name: 'Weekly' });
    expect(within(weeklyGroup).getByText('1')).toBeTruthy();
    expect(within(weeklyGroup).getByRole('article', { name: 'Weekly check-in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Archived rhythms (0)' })).toBeTruthy();
  });

  it('keeps creation and archive management out of main Today', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole('button', { name: 'Add Rhythm' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Archived rhythms/ })).toBeNull();
    expect(screen.getByRole('article', { name: 'Pray together' })).toBeTruthy();

    const tools = screen.getByRole('navigation', { name: 'Tools and navigation' });
    const today = within(tools).getByRole('button', { name: 'Today' });
    expect(today.getAttribute('aria-current')).toBe('page');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Marriage' }));
    expect(screen.queryByRole('button', { name: 'Add Rhythm' })).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    expect(screen.getByRole('button', { name: 'Add Rhythm' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Browse suggestions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Archived rhythms (0)' })).toBeTruthy();
  });

  it('keeps suggestions out of active lists and presents the nine grouped recommendations accessibly', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));

    expect(screen.getByRole('heading', { name: 'Daily', level: 4 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Weekly', level: 4 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Seasonal & Annual', level: 4 })).toBeTruthy();
    expect(within(document.getElementById('marriage-panel-rhythms')!).getAllByText('No active Rhythms.'))
      .toHaveLength(3);
    expect(screen.queryByRole('article', { name: 'Dream Together' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Browse suggestions' }));
    const picker = await screen.findByRole('dialog', { name: 'Marriage rhythms' });
    const groups = within(picker).getAllByRole('region');
    expect(groups.map(group => group.querySelector('h3')?.textContent)).toEqual([
      'Daily Connection', 'Weekly Investment', 'Seasonal & Annual'
    ]);
    expect(groups.map(group => group.querySelector('p')?.textContent)).toEqual([
      'The little things that matter most.',
      'Protect time for your relationship.',
      'Make room for deeper connection.'
    ]);
    expect(within(picker).getAllByRole('listitem')).toHaveLength(9);
  });

  it('prefills all Marriage suggestion frequencies and times without choosing recurrence details', async () => {
    const user = userEvent.setup();
    const recommendations = [
      ['Daily Connection', 'Select Days', 'Anytime'],
      ['Pray Together', 'Daily', 'Evening'],
      ['Date Night', 'Weekly', 'Evening'],
      ['Marriage Check-In', 'Weekly', 'Anytime'],
      ['Thoughtful Act of Love', 'Weekly', 'Anytime'],
      ['Dream Together', 'Quarterly', 'Anytime'],
      ['Overnight Away', 'Quarterly', 'Anytime'],
      ['Marriage Enrichment', 'Yearly', 'Anytime'],
      ['Week Away Together', 'Yearly', 'Anytime']
    ] as const;
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' }))
      .getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Browse suggestions' }));

    let picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    const savedBefore = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    for (const [title, frequency, time] of recommendations) {
      await user.click(within(suggestionRow(picker, title)).getByRole('button', { name: 'Add' }));
      const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
      expect(within(editor).queryByRole('checkbox', { name: 'Personal' })).toBeNull();
      expect(within(editor).getByRole('combobox', { name: `Frequency: ${frequency}` })).toBeTruthy();
      expect(within(editor).getByRole('combobox', { name: `Time of day: ${time}` })).toBeTruthy();
      if (frequency === 'Select Days') {
        expect(within(editor).getByText(/Choose the days/)).toBeTruthy();
        expect((within(editor).getByRole('checkbox', { name: 'Monday' }) as HTMLInputElement).checked).toBe(false);
      }
      if (frequency === 'Weekly') {
        expect(within(editor).getByRole('radio', { name: 'Monday' })).toBeTruthy();
      }
      if (frequency === 'Quarterly') {
        expect(within(editor).getByRole('combobox', { name: 'Quarter months: Choose months' })).toBeTruthy();
        expect(within(editor).getByRole('combobox', { name: 'Repeat on: Choose a pattern' })).toBeTruthy();
      }
      if (frequency === 'Yearly') {
        expect(within(editor).getByRole('combobox', { name: 'Repeat on: Choose a pattern' })).toBeTruthy();
      }
      await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
      picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
      expect(within(suggestionRow(picker, title)).getByRole('button', { name: 'Add' })).toBeTruthy();
    }
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(savedBefore);
    expect([...picker.querySelectorAll('.rhythm-suggestion-picker__details h4')].map(title => title.textContent))
      .toEqual([
        'Daily Connection', 'Pray Together', 'Date Night', 'Marriage Check-In',
        'Thoughtful Act of Love', 'Dream Together', 'Overnight Away',
        'Marriage Enrichment', 'Week Away Together'
      ]);
    expect([...picker.querySelectorAll('.rhythm-suggestion-picker__schedule')].map(hint => hint.textContent))
      .toEqual([
        '5 times a week · Flexible', 'Daily · Evening', 'Weekly · Evening',
        'Weekly · Flexible', 'Weekly · Flexible', 'Quarterly · Flexible',
        'Quarterly · Flexible', 'Yearly · Flexible', 'Yearly · Flexible'
      ]);
    expect(within(picker).getAllByRole('button', { name: 'Add' })).toHaveLength(9);
    expect(within(picker).queryByRole('button', { name: /Tend|Edit rhythm|View scores/ })).toBeNull();
    expect(within(picker).queryByText(/82|68|64/)).toBeNull();
    expect(within(picker).getByText(marriageRhythmSuggestions.find(item =>
      item.templateId === 'marriage.dream-together'
    )!.rhythm.description!)).toBeTruthy();
    cancelNativeDialog(picker);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Browse suggestions' }));
    expect(screen.queryByRole('article', { name: 'Dream Together' })).toBeNull();
  });

  it('uses only saved active Rhythms across Marriage lists, Foundation links, scoring coverage, and management', async () => {
    const user = userEvent.setup();
    const communicationRhythms = rhythmsSupportingFoundation(marriageRhythms, 'communication');
    expect(communicationRhythms.map(rhythm => rhythm.id)).toEqual(['sample-marriage-connection']);
    expect(rhythmsSupportingFoundation(marriageRhythms, 'intimacy')).toHaveLength(1);
    expect(rhythmsSupportingFoundation(marriageRhythms, 'partnership').map(rhythm => rhythm.id)).toEqual(['sample-marriage-dream']);
    expect(marriageFoundations.map(foundation => foundation.id)).toEqual([
      'connection', 'communication', 'fun-adventure', 'spiritual-growth', 'partnership', 'intimacy'
    ]);

    const data = createSamplePreviewData();
    const dailyConnectionId = activeIdForMarriageSuggestion('marriage.daily-connection')!;
    const prayerId = activeIdForMarriageSuggestion('marriage.pray-together')!;
    data.savedRhythms = [
      savedMarriageRhythm(dailyConnectionId, 'Daily Connection', ['connection', 'communication']),
      savedMarriageRhythm(prayerId, 'Pray Together', ['spiritual-growth', 'connection'])
    ];
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    const dailyGroup = screen.getByRole('region', { name: 'Daily' });
    expect(within(dailyGroup).getByRole('article', { name: 'Daily Connection' })).toBeTruthy();
    expect(within(dailyGroup).getByRole('article', { name: 'Pray Together' })).toBeTruthy();
    expect(within(dailyGroup).getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByRole('article', { name: 'Date Night' })).toBeNull();
    expect(screen.queryByRole('article', { name: 'Dream Together' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Browse suggestions' }));
    const suggestionPicker = await screen.findByRole('dialog', { name: 'Marriage rhythms' });
    expect(within(suggestionPicker).getAllByRole('listitem')).toHaveLength(9);
    cancelNativeDialog(suggestionPicker);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Marriage rhythms' })).toBeNull());

    await user.click(screen.getByRole('tab', { name: 'Foundations' }));
    const openDetail = screen.getByRole('button', {
      name: /Open Connection foundation details, Connection Foundation Health score unavailable, 0 of 2 linked Rhythms scored/
    });
    expect(openDetail.querySelector('button')).toBeNull();
    expect(openDetail.querySelector('.foundation-card__score')?.textContent).toBe('—');
    expect(openDetail.querySelector('.foundation-progress__fill')?.getAttribute('style')).toContain('width: 0%');
    expect(openDetail.querySelector('.preview-score-marker')).toBeNull();
    expect(openDetail.querySelector('.foundation-card__coverage')?.textContent).toBe('0 of 2 linked Rhythms scored');
    expect(screen.getByRole('button', {
      name: /Open Partnership foundation details, Partnership Foundation Health score unavailable, No linked Rhythms/
    })).toBeTruthy();
    openDetail.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement?.textContent).toBe('Connection');
    expect(screen.getByRole('meter', { name: 'Connection Foundation Health score' }).getAttribute('aria-valuetext')).toBe('Score unavailable');
    expect(screen.getByRole('heading', { name: 'Linked Rhythms · 2', level: 3 })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Linked Rhythms · 2' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { name: 'Linked Rhythms · 2' })).toHaveLength(1);
    expect(screen.queryByRole('region', { name: /Primary|Secondary associations/ })).toBeNull();
    const dailyConnection = screen.getByRole('article', { name: 'Daily Connection' });
    expect(screen.getByRole('article', { name: 'Pray Together' })).toBeTruthy();
    expect(screen.getAllByRole('article', { name: 'Daily Connection' })).toHaveLength(1);
    expect(screen.queryByRole('article', { name: 'Date Night' })).toBeNull();
    expect(screen.queryByRole('article', { name: 'Dream Together' })).toBeNull();
    expect(within(dailyConnection).getByRole('heading', { name: 'Daily Connection' })).toBeTruthy();
    expect(within(dailyConnection).getByText('Anytime')).toBeTruthy();
    expect(within(document.querySelector('.marriage-foundation-support')!).queryByText(/sample score · .*not calculated/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Manage linked Rhythms' }));
    const manager = screen.getByRole('dialog', { name: 'Linked Rhythms' });
    expect(within(manager).getAllByRole('checkbox')).toHaveLength(2);
    expect(within(manager).getByRole('checkbox', { name: /Daily Connection/ })).toBeTruthy();
    expect(within(manager).getByRole('checkbox', { name: /Pray Together/ })).toBeTruthy();
    expect(within(manager).queryByRole('checkbox', { name: /Date Night|Dream Together/ })).toBeNull();
    await user.click(within(manager).getByRole('checkbox', { name: /Daily Connection/ }));
    await user.click(within(manager).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Linked Rhythms' })).toBeNull());
    expect(screen.getByRole('heading', { name: 'Linked Rhythms · 1', level: 3 })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Daily Connection' })).toBeNull();
    expect(screen.getByRole('article', { name: 'Pray Together' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '‹ All Foundations' }));
    expect((document.activeElement as HTMLButtonElement).id).toBe('marriage-foundation-select-connection');
    expect(screen.getByRole('button', { name: /Open Connection foundation details/ })).toBeTruthy();

    const persisted = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(persisted.valid).toBe(true);
    if (!persisted.valid) return;
    expect(persisted.envelope.data.savedRhythms.find(rhythm => rhythm.id === dailyConnectionId))
      .toMatchObject({ primaryFoundationId: 'communication', secondaryFoundationIds: [] });

    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Foundations' }));
    await user.click(screen.getByRole('button', { name: /Open Connection foundation details/ }));
    expect(screen.getByRole('heading', { name: 'Linked Rhythms · 1', level: 3 })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Pray Together' })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Daily Connection' })).toBeNull();
  });

  it('keeps saved sample-backed overrides by identity and excludes archived Rhythms from Marriage Foundations', async () => {
    const user = userEvent.setup();
    const data = createSamplePreviewData();
    const sampleBackedId = 'sample-marriage-connection';
    const archivedId = 'user-rhythm-73000000-0000-4000-8000-000000000001';
    data.savedRhythms = [
      savedMarriageRhythm(sampleBackedId, 'My saved connection', ['connection', 'communication']),
      savedMarriageRhythm(archivedId, 'Archived connection', ['connection'])
    ];
    data.archivedRhythmIds = [archivedId];
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));

    const dailyGroup = screen.getByRole('region', { name: 'Daily' });
    expect(within(dailyGroup).getByRole('article', { name: 'My saved connection' })).toBeTruthy();
    expect(within(dailyGroup).queryByRole('article', { name: 'Archived connection' })).toBeNull();
    expect(within(dailyGroup).queryByRole('article', { name: 'Daily Connection' })).toBeNull();
    expect(within(dailyGroup).getAllByRole('article')).toHaveLength(1);

    await user.click(screen.getByRole('tab', { name: 'Foundations' }));
    await user.click(screen.getByRole('button', { name: /Open Connection foundation details/ }));
    expect(screen.getByRole('heading', { name: 'Linked Rhythms · 1', level: 3 })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'My saved connection' })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Archived connection' })).toBeNull();
    expect(screen.queryByRole('article', { name: 'Date Night' })).toBeNull();
  });

  it('uses the shared full card for editable linked Rhythms without inventing missing metadata', async () => {
    const user = userEvent.setup();
    const longTitle = 'A deliberately long editable Foundation Rhythm title that needs to wrap';
    const rhythmId = 'user-rhythm-71000000-0000-4000-8000-000000000001';
    const data = createSamplePreviewData();
    data.savedRhythms.push({
      id: rhythmId,
      title: longTitle,
      cadence: 'Daily',
      timeLabel: 'Evening',
      timeOfDay: 'evening',
      personIds: [],
      categoryIds: ['marriage'],
      primaryFoundationId: 'connection',
      secondaryFoundationIds: [],
      schedule: { frequency: 'daily' }
    });
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));

    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const todayCard = screen.getByRole('article', { name: longTitle });
    const todaySchedule = todayCard.querySelector('.rhythm-metadata-schedule-group')?.textContent?.trim();
    const todayStatus = todayCard.querySelector('.rhythm-metadata-status')?.textContent?.trim();
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Foundations' }));
    await user.click(screen.getByRole('button', { name: /Open Connection foundation details/ }));

    const rhythmCard = screen.getByRole('article', { name: longTitle });
    expect(within(rhythmCard).getByRole('heading', { name: longTitle })).toBeTruthy();
    expect(rhythmCard.querySelector('.today-rhythm-details__description')).toBeNull();
    expect(rhythmCard.querySelector('.person-badge')).toBeNull();
    expect(within(rhythmCard).getByRole('button', { name: 'Marriage' })).toBeTruthy();
    expect(within(rhythmCard).getByText('Evening')).toBeTruthy();
    expect(rhythmCard.querySelector('.rhythm-metadata-schedule-group')?.textContent).toContain('Daily');
    expect(rhythmCard.querySelector('.rhythm-metadata-status')?.textContent?.trim()).toBeTruthy();
    expect(rhythmCard.querySelector('.rhythm-metadata-schedule-group')?.textContent?.trim()).toBe(todaySchedule);
    expect(rhythmCard.querySelector('.rhythm-metadata-status')?.textContent?.trim()).toBe(todayStatus);

    const editButton = within(rhythmCard).getByRole('button', { name: `Edit ${longTitle}` });
    const tendButton = within(rhythmCard).getByRole('button', { name: `Tend ${longTitle}` });
    expect(tendButton.matches(':disabled')).toBe(false);
    await user.click(tendButton);
    const completion = screen.getByRole('dialog', { name: 'When did you tend it?' });
    await user.click(within(completion).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'When did you tend it?' })).toBeNull());
    expect(within(rhythmCard).getByRole('button', { name: `Tend ${longTitle}` })).toBeTruthy();

    await user.click(editButton);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit Rhythm' })).toBeNull());
    expect(document.activeElement).toBe(editButton);
    expect(within(rhythmCard).getByRole('button', { name: historyButtonName(`View scores and history for ${longTitle}`) })).toBeTruthy();

    const saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    saved.envelope.data.archivedRhythmIds.push(rhythmId);
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(saved.envelope.data)));
    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Foundations' }));
    await user.click(screen.getByRole('button', { name: /Open Connection foundation details/ }));
    expect(screen.getByRole('heading', { name: 'Linked Rhythms · 0', level: 3 })).toBeTruthy();
    expect(screen.queryByRole('article', { name: longTitle })).toBeNull();
    expect(screen.getByRole('meter', { name: 'Connection Foundation Health score' })
      .getAttribute('aria-valuetext')).toBe('Score unavailable');
  });

  it('uses shared Rhythm selector results for Marriage Foundation cards and shared history', async () => {
    const user = userEvent.setup();
    const today = localDateString(new Date());
    const trackingStartDate = addCalendarDays(today, -29);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const rhythmId = 'user-rhythm-70000000-0000-4000-8000-000000000001';
    const data = createSamplePreviewData();
    data.savedRhythms.push({
      id: rhythmId,
      title: 'Foundation score fixture',
      cadence: 'Daily',
      timeLabel: 'Evening',
      timeOfDay: 'evening',
      personIds: [],
      categoryIds: ['marriage'],
      primaryFoundationId: 'connection',
      secondaryFoundationIds: [],
      schedule: { frequency: 'daily' },
      createdLocalDate: trackingStartDate,
      createdTimeZone: timeZone
    });
    data.rhythmHistoryIds.push(rhythmId);
    const completionDates = [
      ...Array.from({ length: 23 }, (_, index) => addCalendarDays(trackingStartDate, index)),
      today
    ];
    data.datedRhythmCompletions.push(...completionDates.map((effectiveDate, index) => {
      const completedAt = localDateTimeInZone(effectiveDate, '19:00', timeZone).toISOString();
      return {
        id: `foundation-score-completion-${index}`,
        rhythmId,
        effectiveDate,
        localTime: '19:00',
        timeZone,
        completedAt,
        recordedAt: completedAt
      };
    }));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Foundations' }));

    const connection = screen.getByRole('button', {
      name: /Open Connection foundation details, Connection Foundation Health score 85 out of 100/
    });
    expect(connection.querySelector('.foundation-card__score')?.textContent).toBe('85');
    expect(screen.getByText('1 of 6 Foundations scored')).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Marriage Health score' }).getAttribute('aria-valuenow')).toBe('85');
    expect(screen.getByText('80', { selector: '.health-summary-score' })).toBeTruthy();
    expect(screen.getByText('100', { selector: '.health-summary-score' })).toBeTruthy();
    const unavailable = screen.getByRole('button', {
      name: /Open Partnership foundation details, Partnership Foundation Health score unavailable, No linked Rhythms/
    });
    expect(unavailable.querySelector('.foundation-card__score')?.textContent).toBe('—');

    const showFoundationInfo = screen.getByRole('button', { name: 'Show Foundation scoring explanation' });
    expect(showFoundationInfo.getAttribute('aria-expanded')).toBe('false');
    const foundationsSection = document.querySelector('.marriage-foundations-section')!;
    const foundationTitleRow = foundationsSection.querySelector('.marriage-foundations-section__title-row')!;
    expect(within(foundationTitleRow as HTMLElement).getByRole('heading', {
      name: 'Marriage foundations'
    })).toBeTruthy();
    expect(within(foundationTitleRow as HTMLElement).getByRole('button', {
      name: 'Show Foundation scoring explanation'
    })).toBe(showFoundationInfo);
    expect(foundationsSection.querySelector('.marriage-sample-tag')).toBeNull();
    expect(within(foundationsSection as HTMLElement).getByText('Ongoing areas of care.')).toBeTruthy();
    expect(screen.getByText('Synthetic example')).toBeTruthy();
    showFoundationInfo.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(showFoundationInfo);
    const foundationInfo = screen.getByRole('region', { name: 'Each rhythm counts equally.' });
    expect(within(foundationInfo).getByText(
      'We combine their Consistency and On Track scores to calculate this Foundation’s Health.'
    )).toBeTruthy();
    expect(within(foundationInfo).getByText('75%')).toBeTruthy();
    expect(within(foundationInfo).getByText('25%')).toBeTruthy();
    expect(within(foundationInfo).getByText('How regularly you follow through')).toBeTruthy();
    expect(within(foundationInfo).getByText('How caught up you are')).toBeTruthy();
    expect(within(foundationInfo).getByText('Rhythms need both scores to count.')).toBeTruthy();
    expect(foundationInfo.querySelector('.rhythm-history-view__health-weight-panels')).toBeTruthy();
    const foundationInfoToggle = screen.getByRole('button', { name: 'Hide Foundation scoring explanation' });
    expect(foundationInfoToggle.getAttribute('aria-expanded')).toBe('true');

    await user.click(connection);
    expect(screen.getByRole('meter', { name: 'Connection Foundation Health score' }).getAttribute('aria-valuenow')).toBe('85');
    const historyOpener = screen.getByRole('button', {
      name: historyButtonName('View scores and history for Foundation score fixture')
    });
    await user.click(historyOpener);
    const rhythmDialog = await screen.findByRole('dialog', { name: 'Foundation score fixture' });
    const history = within(rhythmDialog).getByRole('region', { name: 'History for Foundation score fixture' });
    expect(within(history).getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('80');
    expect(within(history).getByRole('meter', { name: 'On Track score' }).getAttribute('aria-valuenow')).toBe('100');
    expect(within(history).getByRole('meter', { name: 'Health score' }).getAttribute('aria-valuenow')).toBe('85');

    await user.click(within(history).getByText('Logged moments (24)'));
    const completionToDelete = addCalendarDays(trackingStartDate, 22);
    const formattedCompletionDate = new Date(`${completionToDelete}T12:00:00`).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    await user.click(within(history).getByRole('button', {
      name: `Delete logged moment for Foundation score fixture, ${formattedCompletionDate} at 7:00 PM`
    }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete moment' }));
    expect(within(history).getByRole('meter', { name: 'Consistency score' }).getAttribute('aria-valuenow')).toBe('77');
    expect(within(history).getByRole('meter', { name: 'Health score' }).getAttribute('aria-valuenow')).toBe('82.5');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Foundation score fixture' })).toBeNull());
    expect(screen.getByRole('meter', { name: 'Connection Foundation Health score' }).getAttribute('aria-valuenow'))
      .toBe('82.5');
    expect(document.querySelector('.foundation-card__score')?.textContent).toBe('83');
    expect(screen.getByText('1 of 6 Foundations scored')).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Marriage Health score' }).getAttribute('aria-valuenow')).toBe('82.5');
    expect(screen.getByText('77', { selector: '.health-summary-score' })).toBeTruthy();
    expect(screen.getByText('100', { selector: '.health-summary-score' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '‹ All Foundations' }));
    await user.click(screen.getByRole('button', {
      name: /Open Communication foundation details/
    }));
    await user.click(screen.getByRole('button', { name: 'Manage linked Rhythms' }));
    const associationDialog = screen.getByRole('dialog', { name: 'Linked Rhythms' });
    await user.click(within(associationDialog).getByRole('checkbox', { name: /Foundation score fixture/ }));
    await user.click(within(associationDialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Linked Rhythms' })).toBeNull());
    expect(screen.getByRole('meter', { name: 'Communication Foundation Health score' }).getAttribute('aria-valuenow'))
      .toBe('82.5');
    expect(screen.queryByText(/linked Rhythms scored/)).toBeNull();
    expect(screen.getByText('2 of 6 Foundations scored')).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Marriage Health score' }).getAttribute('aria-valuenow')).toBe('82.5');
  });

  it('saves Marriage associations through reload and export/import, then opens shared read-only Rhythm history', async () => {
    const user = userEvent.setup();
    const data = createSamplePreviewData();
    data.savedRhythms.push(savedMarriageRhythm(
      'sample-marriage-dream',
      'Dream Together',
      ['partnership', 'fun-adventure']
    ));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Foundations' }));
    await user.click(screen.getByRole('button', { name: /Open Connection foundation details/ }));

    const manage = screen.getByRole('button', { name: 'Manage linked Rhythms' });
    manage.focus();
    await user.keyboard('{Enter}');
    const editor = screen.getByRole('dialog', { name: 'Linked Rhythms' });
    await user.click(within(editor).getByRole('checkbox', { name: /Dream Together/ }));
    await user.click(within(editor).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Linked Rhythms' })).toBeNull());
    expect(document.activeElement).toBe(manage);
    expect(screen.getByRole('heading', { name: 'Linked Rhythms · 1', level: 3 })).toBeTruthy();

    const firstSave = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(firstSave.valid).toBe(true);
    if (!firstSave.valid) return;
    expect(firstSave.envelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(firstSave.envelope.data.savedRhythms.find(item => item.id === 'sample-marriage-dream')).toMatchObject({
      primaryFoundationId: 'partnership',
      secondaryFoundationIds: ['fun-adventure', 'connection']
    });

    const backup = JSON.stringify(createPreviewEnvelope(firstSave.envelope.data));
    const parsedBackup = parsePreviewBackup(backup, localDateString(new Date()));
    expect(parsedBackup.valid).toBe(true);
    if (!parsedBackup.valid) return;
    expect(parsedBackup.envelope.data.savedRhythms.find(item => item.id === 'sample-marriage-dream')?.secondaryFoundationIds)
      .toEqual(['fun-adventure', 'connection']);

    cleanup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Foundations' }));
    await user.click(screen.getByRole('button', { name: /Open Connection foundation details/ }));
    const dream = screen.getByRole('article', { name: 'Dream Together' });
    expect(within(dream).queryByRole('button', { name: /^Tend/ })).toBeNull();
    expect(within(dream).queryByRole('button', { name: /^Edit Dream Together/ })).toBeNull();
    const historyOpener = within(dream).getByRole('button', {
      name: historyButtonName('View scores and history for Dream Together')
    });
    await user.click(historyOpener);
    const history = screen.getByRole('region', { name: 'History for Dream Together' });
    expect(within(history).getByRole('heading', { name: 'All completion history' })).toBeTruthy();
    expect(history.querySelector('.rhythm-history-view__completion-total strong')?.textContent).toBe('1');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(historyOpener);
    expect(screen.getByRole('heading', { name: 'Linked Rhythms · 1', level: 3 })).toBeTruthy();

    const backupFile = new File([backup], 'marriage-associations.json', { type: 'application/json' });
    await openPreviewSettings(user);
    fireEvent.change(screen.getByLabelText('Import preview backup'), { target: { files: [backupFile] } });
    const importDialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    await user.click(within(importDialog).getByRole('button', { name: 'Replace with backup' }));
    await screen.findByText('Preview backup imported.');
    const afterImport = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(afterImport.valid).toBe(true);
    if (afterImport.valid) {
      expect(afterImport.envelope.data.savedRhythms.find(item => item.id === 'sample-marriage-dream')?.secondaryFoundationIds)
        .toEqual(['fun-adventure', 'connection']);
    }
  });

  it('cancels a Foundation association draft unchanged and retains it after a storage failure', async () => {
    const user = userEvent.setup();
    const data = createSamplePreviewData();
    data.savedRhythms.push(savedMarriageRhythm(
      'sample-marriage-dream',
      'Dream Together',
      ['partnership', 'fun-adventure']
    ));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Foundations' }));
    await user.click(screen.getByRole('button', { name: /Open Connection foundation details/ }));
    const manage = screen.getByRole('button', { name: 'Manage linked Rhythms' });
    const savedBefore = window.localStorage.getItem(PREVIEW_STORAGE_KEY);

    await user.click(manage);
    let editor = screen.getByRole('dialog', { name: 'Linked Rhythms' });
    const dreamCheckbox = within(editor).getByRole('checkbox', { name: /Dream Together/ });
    await user.click(dreamCheckbox);
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Linked Rhythms' })).toBeNull());
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(savedBefore);
    expect(document.activeElement).toBe(manage);

    const storage = window.localStorage as unknown as MemoryStorage;
    const originalSetItem = storage.setItem.bind(storage);
    vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
      if (key === PREVIEW_STORAGE_KEY) throw new Error('Quota exceeded.');
      originalSetItem(key, value);
    });
    await user.click(manage);
    editor = screen.getByRole('dialog', { name: 'Linked Rhythms' });
    const retainedCheckbox = within(editor).getByRole('checkbox', { name: /Dream Together/ });
    await user.click(retainedCheckbox);
    await user.click(within(editor).getByRole('button', { name: 'Save' }));
    expect(within(editor).getByRole('alert').textContent).toContain('Quota exceeded.');
    expect((retainedCheckbox as HTMLInputElement).checked).toBe(true);
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(savedBefore);
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
    expect(screen.getByRole('meter', { name: 'Marriage Health score' }).getAttribute('aria-valuenow')).toBeNull();
    expect(screen.getByText('No scored Foundations yet')).toBeTruthy();
    expect(within(document.getElementById('marriage-panel-today')!).getByText('No active Rhythms.')).toBeTruthy();
    expect(screen.queryByText('No sample invitation or topic is available.')).toBeNull();
    expect(screen.getByText('—', { selector: '.category-health-score' })).toBeTruthy();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Marriage example' }), 'populated');
    expect(screen.getByText('—', { selector: '.category-health-score' })).toBeTruthy();
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
    expect(within(document.getElementById('marriage-panel-rhythms')!).getAllByText('No active Rhythms.'))
      .toHaveLength(3);
    expect(screen.queryByRole('article', { name: 'Dream Together' })).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Foundations' }));

    const cards = screen.getAllByRole('button').filter(card => card.classList.contains('foundation-card--interactive'));
    expect(cards.map(card => card.querySelector('[role="heading"]')?.textContent)).toEqual([
      'Connection', 'Communication', 'Fun & Adventure', 'Spiritual Growth', 'Partnership', 'Intimacy'
    ]);
    expect(cards.filter(card => card.querySelector('[role="meter"]') === null)).toHaveLength(6);
    expect(screen.getAllByText('No linked Rhythms')).toHaveLength(6);
    expect(screen.getByText('Ongoing areas of care; scores are unavailable without scored linked Rhythms.')).toBeTruthy();
    expect(cards[0]?.getAttribute('aria-label')).toContain('score unavailable');
    expect(cards[0]?.querySelector('.foundation-card__score')?.textContent).toBe('—');
    await user.click(cards[0]!);
    expect(await screen.findByText(/No Rhythms are linked to this ongoing Foundation yet/)).toBeTruthy();
    expect(screen.getByRole('meter', { name: 'Connection Foundation Health score' }).getAttribute('aria-valuetext')).toBe('Score unavailable');
  });

  it('reuses suggestion sources across independent Rhythm instances and returns through the shared picker', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    const browse = screen.getByRole('button', { name: 'Browse suggestions' });
    await user.click(browse);
    let picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    let row = suggestionRow(picker, 'Daily Connection');
    expect(within(row).queryByText(/Added/)).toBeNull();
    expect(within(row).getByRole('button', { name: 'Add' })).toBeTruthy();

    await user.click(within(row).getByRole('button', { name: 'Add' }));
    let editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect((within(editor).getByLabelText('Title') as HTMLInputElement).value).toBe('Daily Connection');
    await user.click(within(editor).getByRole('button', { name: /^Choose people/ }));
    let association = associationPicker('Choose people');
    expect(within(association).getByRole('button', { name: 'Avery Brooks' }).getAttribute('aria-pressed')).toBe('false');
    expect(within(association).getByRole('button', { name: 'Morgan Reed' }).getAttribute('aria-pressed')).toBe('false');
    await user.click(within(association).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('checkbox', { name: 'Monday' }));
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));

    let parsed = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.envelope.data.savedRhythms).toHaveLength(1);
    const first = parsed.envelope.data.savedRhythms[0]!;
    expect(first.id).not.toBe(activeIdForMarriageSuggestion('marriage.daily-connection'));
    expect(first.id).toMatch(/^user-rhythm-[0-9a-f-]{36}$/i);
    expect(first.suggestionSourceId).toBe('marriage.daily-connection');
    expect(first.personIds).toEqual([]);

    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    row = suggestionRow(picker, 'Daily Connection');
    expect(within(row).getByText('Added')).toBeTruthy();
    await user.click(within(row).getByRole('button', { name: 'Add' }));
    expect(within(picker).getByRole('heading', { name: 'You’ve added Daily Connection' })).toBeTruthy();
    expect(within(picker).getByText('Edit an existing rhythm or create another.')).toBeTruthy();
    expect(within(picker).getByText('Selected days: Monday')).toBeTruthy();
    await user.click(within(picker).getByRole('button', { name: 'Back' }));
    await waitFor(() => {
      const currentPicker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
      const currentRow = suggestionRow(currentPicker, 'Daily Connection');
      expect(document.activeElement).toBe(within(currentRow).getByRole('button', { name: 'Add' }));
    });

    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    row = suggestionRow(picker, 'Daily Connection');
    await user.click(within(row).getByRole('button', { name: 'Add' }));
    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    await user.click(within(picker).getByRole('button', { name: '＋ Add another' }));
    editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    await user.click(within(editor).getByRole('button', { name: /^Choose people/ }));
    association = associationPicker('Choose people');
    await user.click(within(association).getByRole('button', { name: 'Morgan Reed' }));
    await user.click(within(association).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('checkbox', { name: 'Wednesday' }));
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));

    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    expect(within(picker).getByRole('heading', { name: 'You’ve added Daily Connection' })).toBeTruthy();
    expect(within(picker).getByText('Morgan Reed')).toBeTruthy();
    expect(within(picker).getByText('Selected days: Wednesday')).toBeTruthy();
    await user.click(within(picker).getByRole('button', { name: 'Back' }));
    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    row = suggestionRow(picker, 'Daily Connection');
    expect(within(row).getByText('2 added')).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Add' })).toBeTruthy();
    await user.click(within(row).getByRole('button', { name: 'Add' }));
    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    let instances = within(picker).getAllByRole('listitem');
    expect(instances.map(item => item.textContent).join(' ')).not.toContain('Avery Brooks');
    expect(instances.map(item => item.textContent).join(' ')).toContain('Morgan Reed');
    const editButtons = within(picker).getAllByRole('button', { name: 'Edit Daily Connection' });
    expect(editButtons).toHaveLength(2);
    const beforeCancel = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    await user.click(editButtons[1]!);
    editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(beforeCancel);
    await user.click(within(picker).getAllByRole('button', { name: 'Edit Daily Connection' })[1]!);
    editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.clear(within(editor).getByLabelText('Title'));
    await user.type(within(editor).getByLabelText('Title'), 'Evening connection');
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    expect(within(picker).getByRole('button', { name: 'Edit Evening connection' })).toBeTruthy();
    await user.click(within(picker).getByRole('button', { name: 'Back' }));
    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    row = suggestionRow(picker, 'Daily Connection');
    expect(within(row).getByText('2 added')).toBeTruthy();
    await user.click(within(row).getByRole('button', { name: 'Add' }));
    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    const renamedEdit = within(picker).getByRole('button', { name: 'Edit Evening connection' });
    await user.click(renamedEdit);
    editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.click(within(editor).getByRole('button', { name: 'Archive Evening connection' }));
    await user.click(within(within(editor).getByRole('alertdialog')).getByRole('button', {
      name: 'Confirm archive Evening connection'
    }));
    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    await user.click(within(picker).getByRole('button', { name: 'Back' }));
    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    row = suggestionRow(picker, 'Daily Connection');
    expect(within(row).getByText('Added')).toBeTruthy();
    await user.click(within(row).getByRole('button', { name: 'Add' }));
    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    expect(within(picker).getByRole('heading', { name: 'Archived' })).toBeTruthy();
    expect(within(picker).getByText('Evening connection')).toBeTruthy();
    await user.click(within(picker).getByRole('button', { name: 'Restore' }));
    await user.click(within(picker).getByRole('button', { name: 'Back' }));
    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    await waitFor(() => expect(within(suggestionRow(picker, 'Daily Connection')).getByText('2 added')).toBeTruthy());

    parsed = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    const saved = parsed.envelope.data.savedRhythms;
    expect(saved).toHaveLength(2);
    expect(new Set(saved.map(rhythm => rhythm.id)).size).toBe(2);
    expect(saved.map(rhythm => rhythm.suggestionSourceId)).toEqual([
      'marriage.daily-connection', 'marriage.daily-connection'
    ]);
    expect(saved.map(rhythm => rhythm.title)).toContain('Evening connection');
    expect(saved.map(rhythm => rhythm.personIds)).toContainEqual([]);
    expect(saved.map(rhythm => rhythm.personIds)).toContainEqual(['sample-person-morgan']);
    const backup = JSON.stringify(createPreviewEnvelope(parsed.envelope.data));
    const backupData = parsePreviewBackup(backup, localDateString(new Date()));
    expect(backupData.valid && backupData.envelope.data.savedRhythms).toHaveLength(2);

    cancelNativeDialog(picker);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(browse));
    const backupFile = new File([backup], 'reusable-rhythms.json', { type: 'application/json' });
    await openPreviewSettings(user);
    fireEvent.change(screen.getByLabelText('Import preview backup'), { target: { files: [backupFile] } });
    const importDialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    await user.click(within(importDialog).getByRole('button', { name: 'Replace with backup' }));
    await screen.findByText('Preview backup imported.');

    unmount();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Browse suggestions' }));
    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    row = suggestionRow(picker, 'Daily Connection');
    expect(within(row).getByText('2 added')).toBeTruthy();
    await user.click(within(row).getByRole('button', { name: 'Add' }));
    expect(within(screen.getByRole('dialog', { name: 'Marriage rhythms' })).getByText('Evening connection')).toBeTruthy();
  });

  it('keeps the Marriage suggestion draft open and unchanged when preview persistence fails', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Browse suggestions' }));
    const picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    await user.click(within(suggestionRow(picker, 'Daily Connection')).getByRole('button', { name: 'Add' }));
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    await user.click(within(editor).getByRole('checkbox', { name: 'Monday' }));
    await user.click(within(editor).getByRole('checkbox', { name: 'Thursday' }));
    const before = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    const storage = window.localStorage as unknown as MemoryStorage;
    const originalSetItem = storage.setItem.bind(storage);
    vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
      if (key === PREVIEW_STORAGE_KEY) throw new Error('Quota exceeded.');
      originalSetItem(key, value);
    });

    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(screen.getByRole('dialog', { name: 'Add Rhythm' })).toBeTruthy();
    expect(within(editor).getByRole('alert').textContent).toContain('Review the highlighted Rhythm fields.');
    expect(within(editor).getByText(/Preview could not save this Rhythm\. Quota exceeded\./)).toBeTruthy();
    expect((within(editor).getByLabelText('Title') as HTMLInputElement).value).toBe('Daily Connection');
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(before);
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    const returnedPicker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    const dailyRow = suggestionRow(returnedPicker, 'Daily Connection');
    expect(within(dailyRow).getByRole('button', { name: 'Add' })).toBeTruthy();
    expect(within(dailyRow).queryByText('Added')).toBeNull();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(before);
  });

  it('requires explicit quarterly and yearly pattern choices instead of default dates', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Browse suggestions' }));
    const initialData = window.localStorage.getItem(PREVIEW_STORAGE_KEY);

    let picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    const dateNight = suggestionRow(picker, 'Date Night');
    await user.click(within(dateNight).getByRole('button', { name: 'Add' }));
    let editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Weekly' })).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(within(editor).getByText('Choose one day.')).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));

    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    const overnight = suggestionRow(picker, 'Overnight Away');
    await user.click(within(overnight).getByRole('button', { name: 'Add' }));
    editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Quarterly' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Quarter months: Choose months' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Repeat on: Choose a pattern' })).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(within(editor).getByText('Complete the schedule details before saving.')).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));

    picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    const enrichment = suggestionRow(picker, 'Marriage Enrichment');
    await user.click(within(enrichment).getByRole('button', { name: 'Add' }));
    editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Yearly' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Repeat on: Choose a pattern' })).toBeTruthy();
    await user.click(within(editor).getByRole('combobox', { name: 'Repeat on: Choose a pattern' }));
    await user.click(within(editor).getByRole('option', { name: 'A date' }));
    expect(within(editor).getByRole('combobox', { name: 'Month: Choose a month' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Date: Choose a date' })).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(within(editor).getByText('Complete the schedule details before saving.')).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(initialData);
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
  });

  it('opens the populated Today sample through the shared history view and restores focus', async () => {
    const user = userEvent.setup();
    render(<App />);
    const opener = screen.getByRole('button', { name: historyButtonName('View scores and history for Daily connection') });
    await user.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Daily connection' });
    const history = within(dialog).getByRole('region', { name: 'History for Daily connection' });
    expect(within(history).getByRole('meter', { name: 'Health score' })).toBeTruthy();
    expect(within(history).getByRole('meter', { name: 'Consistency score' })).toBeTruthy();
    expect(within(history).getByRole('meter', { name: 'On Track score' })).toBeTruthy();
    expect(within(history).getByRole('status').textContent).not.toContain('Confirm when tracking starts');
    expect(within(history).getByRole('heading', { name: 'All completion history' })).toBeTruthy();
    expect(history.querySelector('.rhythm-history-view__completion-total > span')?.textContent)
      .toBe('moments tended');
    expect(history.querySelector('.rhythm-history-view__completion-span')?.textContent)
      .toBe(`across ${inclusiveCalendarDays('2026-10-17', localDateString(new Date()))} days`);
    expect(within(history).queryByRole('heading', { name: 'Recent opportunities' })).toBeNull();
    expect(within(history).getByRole('heading', { name: 'All completion history' })).toBeTruthy();
    const chart = within(history).getByRole('list', { name: 'Recorded completion count by date' });
    expect(chart.querySelector('li:last-child time')?.getAttribute('dateTime')).toBe(localDateString(new Date()));
    expect(chart.querySelector('li:last-child')?.getAttribute('aria-label'))
      .toContain('no completion recorded yet, today');

    await user.click(within(history).getByRole('button', { name: 'Close details' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it('keeps suggestion rows scoreless and retains shared history on active Marriage cards', async () => {
    const user = userEvent.setup();
    const data = createSamplePreviewData();
    data.savedRhythms.push(savedMarriageRhythm(
      'sample-marriage-connection',
      'Daily Connection',
      ['connection', 'communication', 'intimacy']
    ));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Marriage' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Browse suggestions' }));
    const picker = screen.getByRole('dialog', { name: 'Marriage rhythms' });
    for (const title of ['Pray Together', 'Dream Together']) {
      const heading = within(picker).getByRole('heading', { name: title, level: 4 });
      const row = heading.closest('li')!;
      expect(within(row).queryByText(/score|history/i)).toBeNull();
      expect(within(row).queryByRole('button', { name: /View scores|View .*history/i })).toBeNull();
      expect(within(row).getByRole('button', { name: 'Add' })).toBeTruthy();
    }
    cancelNativeDialog(picker);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.click(screen.getByRole('tab', { name: 'Foundations' }));
    await user.click(screen.getByRole('button', { name: /Open Communication foundation details/ }));
    const dailyCard = screen.getByRole('article', { name: 'Daily Connection' });
    const opener = within(dailyCard).getByRole('button', {
      name: historyButtonName('View scores and history for Daily Connection')
    });
    await user.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Daily Connection' });
    const historyRegion = within(dialog).getByRole('region', { name: 'History for Daily Connection' });
    expect(historyRegion.querySelector('.rhythm-history-view__completion-total strong')?.textContent).toBe('3');
    expect(historyRegion.querySelector('.rhythm-history-view__completion-total > span')?.textContent)
      .toBe('moments tended');
    expect(historyRegion.querySelector('.rhythm-history-view__completion-span')?.textContent)
      .toBe(`across ${inclusiveCalendarDays('2026-10-17', localDateString(new Date()))} days`);
    const loggedMoments = within(historyRegion).getByText('Logged moments (3)');
    await user.click(loggedMoments);
    const dates = [...historyRegion.querySelectorAll('.rhythm-history-view__logged-moments ol li')]
      .map(item => item.querySelector('time')?.textContent);
    expect(dates).toEqual(['Tuesday, October 20, 2026', 'Sunday, October 18, 2026', 'Saturday, October 17, 2026']);
    expect(within(historyRegion).getByRole('list', { name: 'Recorded completion count by date' })).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: /^Tend/ })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /^Undo/ })).toBeNull();
    await user.click(within(historyRegion).getByRole('button', { name: 'Close details' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(opener);
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

  it('links one Strength workout log to exactly one shared Rhythm completion and deletes only that completion', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      within(screen.getByRole('navigation', { name: 'Areas' }))
        .getByRole('button', { name: 'Health & Fitness' })
    );
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Add Rhythm' }));
    const rhythmEditor = screen.getByRole('dialog');
    await user.type(within(rhythmEditor).getByLabelText('Title'), 'Strength integration session');
    await user.click(within(rhythmEditor).getByRole('button', { name: 'Add Rhythm' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.click(screen.getByRole('button', { name: /^Log workout/ }));
    const workoutDialog = screen.getByRole('dialog', { name: 'Log workout' });
    await user.click(within(workoutDialog).getByRole('checkbox', { name: 'Chest' }));
    await user.click(within(workoutDialog).getByRole('button', { name: 'Save workout' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Log workout' })).toBeNull());

    const saved = parsePreviewBackup(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!, localDateString(new Date()));
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    const log = saved.envelope.data.strength.workouts[0]!;
    expect(log).toMatchObject({
      rhythmOccurrence: log.date,
      muscleIds: ['chest']
    });
    expect(log.rhythmId).toBeTruthy();
    expect(log.completionId).toBeTruthy();
    expect(saved.envelope.data.datedRhythmCompletions.filter(item => item.id === log.completionId)).toHaveLength(1);
    expect(saved.envelope.data.activeRhythmCompletions.filter(item => item.completionId === log.completionId)).toHaveLength(1);

    await user.click(screen.getByRole('tab', { name: 'Workouts' }));
    await user.click(screen.getByRole('tab', { name: 'History' }));
    const history = screen.getByRole('tabpanel', { name: 'History' });
    await user.click(within(history).getByRole('button', { name: /View Custom workout/ }));
    const details = screen.getByRole('dialog', { name: 'Custom workout' });
    await user.click(within(details).getByRole('button', { name: 'Delete' }));
    const confirmation = within(details).getByRole('alertdialog', { name: 'Delete this workout?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Delete workout' }));
    await waitFor(() => {
      const afterDelete = parsePreviewBackup(
        window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
        localDateString(new Date())
      );
      expect(afterDelete.valid).toBe(true);
      if (afterDelete.valid) {
        expect(afterDelete.envelope.data.strength.workouts).toHaveLength(0);
        expect(afterDelete.envelope.data.datedRhythmCompletions.some(item => item.id === log.completionId)).toBe(false);
        expect(afterDelete.envelope.data.savedRhythms.some(item => item.id === log.rhythmId)).toBe(true);
      }
    });
  });

  it('logs and deletes a Weight weigh-in through its opted-in shared Rhythm and preview storage', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      within(screen.getByRole('navigation', { name: 'Areas' }))
        .getByRole('button', { name: 'Health & Fitness' })
    );
    await user.click(screen.getByRole('tab', { name: 'Weight' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Add Weight Rhythm' }));
    const editor = screen.getByRole('dialog');
    await user.type(within(editor).getByLabelText('Title'), 'Weight integration rhythm');
    await user.click(within(editor).getByRole('checkbox', { name: 'Can log a weigh-in' }));
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.click(screen.getByRole('button', { name: /^Log weigh-in/ }));
    const logDialog = screen.getByRole('dialog', { name: 'Add weigh-in' });
    await user.type(within(logDialog).getByLabelText('Weight (lb)'), '180');
    await user.click(within(logDialog).getByRole('button', { name: 'Save weigh-in' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add weigh-in' })).toBeNull());

    const saved = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    const weighIn = saved.envelope.data.weight.weighIns[0] as {
      id: string;
      date: string;
      rhythmId: string;
      completionId: string;
    };
    expect(weighIn.rhythmId).toBeTruthy();
    expect(weighIn.completionId).toBeTruthy();
    expect(saved.envelope.data.datedRhythmCompletions.filter(item => item.id === weighIn.completionId))
      .toHaveLength(1);

    await user.click(screen.getByRole('tab', { name: 'Progress' }));
    await user.click(screen.getByRole('button', { name: /^Delete weigh-in from/ }));
    await waitFor(() => {
      const afterDelete = parsePreviewBackup(
        window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
        localDateString(new Date())
      );
      expect(afterDelete.valid).toBe(true);
      if (afterDelete.valid) {
        expect(afterDelete.envelope.data.weight.weighIns).toHaveLength(0);
        expect(afterDelete.envelope.data.datedRhythmCompletions.some(item => item.id === weighIn.completionId))
          .toBe(false);
      }
    });
  });

  it('links a Cardio run to one shared Rhythm completion, reloads it, and deletes only owned credit', async () => {
    const user = userEvent.setup();
    const data = createSamplePreviewData();
    const rhythmId = 'user-rhythm-22222222-2222-4222-8222-222222222222';
    data.savedRhythms.push({
      id: rhythmId,
      title: 'Cardio integration rhythm',
      cadence: 'Daily',
      timeLabel: 'Anytime',
      timeOfDay: 'anytime',
      personIds: [],
      categoryIds: ['health'],
      schedule: { frequency: 'daily' },
      healthLogCapability: 'cardio'
    });
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data)));
    render(<App />);
    await user.click(
      within(screen.getByRole('navigation', { name: 'Areas' }))
        .getByRole('button', { name: 'Health & Fitness' })
    );
    await user.click(screen.getByRole('tab', { name: 'Cardio' }));
    await user.click(screen.getByRole('tab', { name: 'Rhythms' }));
    await user.click(screen.getByRole('button', { name: 'Log run Cardio integration rhythm' }));
    const logDialog = screen.getByRole('dialog', { name: 'Log run' });
    await user.type(within(logDialog).getByLabelText('Distance (miles)'), '3');
    await user.click(within(logDialog).getByRole('button', { name: 'Save run' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Log run' })).toBeNull());

    const saved = parsePreviewBackup(
      window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
      localDateString(new Date())
    );
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    const run = saved.envelope.data.cardio.runs[0] as {
      id: string;
      date: string;
      rhythmId: string;
      completionId: string;
    };
    expect(run.rhythmId).toBe(rhythmId);
    expect(saved.envelope.data.datedRhythmCompletions.filter(item => item.id === run.completionId))
      .toHaveLength(1);
    expect(saved.envelope.data.activeRhythmCompletions.filter(item => item.completionId === run.completionId))
      .toHaveLength(1);

    cleanup();
    render(<App />);
    await user.click(
      within(screen.getByRole('navigation', { name: 'Areas' }))
        .getByRole('button', { name: 'Health & Fitness' })
    );
    await user.click(screen.getByRole('tab', { name: 'Cardio' }));
    expect(screen.getByText('3 mi')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Delete run from/ }));
    await waitFor(() => {
      const afterDelete = parsePreviewBackup(
        window.localStorage.getItem(PREVIEW_STORAGE_KEY)!,
        localDateString(new Date())
      );
      expect(afterDelete.valid).toBe(true);
      if (afterDelete.valid) {
        expect(afterDelete.envelope.data.cardio.runs).toHaveLength(0);
        expect(afterDelete.envelope.data.datedRhythmCompletions.some(item => item.id === run.completionId))
          .toBe(false);
        expect(afterDelete.envelope.data.savedRhythms.some(item => item.id === rhythmId)).toBe(true);
      }
    });
  });
});
