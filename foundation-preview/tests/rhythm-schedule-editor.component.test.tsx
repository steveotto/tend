import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RhythmEditor } from '../src/components/RhythmEditor.tsx';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmDraft } from '../src/domain/rhythm-editor.ts';
import { rhythmDraftFrom, saveRhythmDraft, validateRhythmDraft } from '../src/domain/rhythm-editor.ts';
import type { RhythmSchedule } from '../src/domain/rhythm-schedule.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';

afterEach(cleanup);

function renderEditor(onSave = vi.fn((_draft: RhythmDraft) => ({}))) {
  render(<RhythmEditor onSave={onSave} onClose={vi.fn()} />);
  return screen.getByRole('dialog', { name: 'Add Rhythm' });
}

function renderEditorForRhythm(
  rhythm: RhythmPreview,
  onSave = vi.fn((_draft: RhythmDraft) => ({}))
) {
  render(<RhythmEditor rhythm={rhythm} onSave={onSave} onClose={vi.fn()} />);
  return screen.getByRole('dialog', { name: 'Edit Rhythm' });
}

function associationPicker(title: string) {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return screen.getByRole('dialog', { name: new RegExp(`^${escapedTitle}$`, 'i') });
}

async function choose(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const trigger = screen.getByRole('combobox', { name: new RegExp(`^${escapedLabel}:`) });
  await user.click(trigger);
  await user.click(screen.getByRole('option', { name: option }));
  return trigger;
}

describe('shared structured Rhythm editor', () => {
  it('renders the grouped association rows as accessible buttons with People, Categories, Foundations order', () => {
    const editor = renderEditor(vi.fn(() => ({})));
    const associationGroup = within(editor).getByRole('region', { name: 'Associations' });
    const rows = within(associationGroup).getAllByRole('button');
    expect(rows.map(row => row.getAttribute('aria-label'))).toEqual([
      'Choose people',
      'Choose categories',
      'Choose a category first'
    ]);
    expect(rows.every(row => row.querySelector('.rhythm-editor__association-row-title'))).toBe(true);
    expect(rows.every(row => row.querySelector('.rhythm-editor__association-row-chevron'))).toBe(true);
    expect(associationGroup.querySelectorAll('button button')).toHaveLength(0);
  });

  it('uses shared noninteractive badges and preserves Foundation groups in populated rows', () => {
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      title: 'Grouped editor fixture',
      personIds: ['sample-person-avery', 'sample-person-morgan'],
      categoryIds: ['faith', 'marriage'],
      primaryFoundationId: 'connection',
      secondaryFoundationIds: ['communication']
    };
    const initialDraft = rhythmDraftFrom(rhythm, rhythm.categoryIds ?? []);
    render(<RhythmEditor initialDraft={initialDraft} onSave={vi.fn(() => ({}))} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    const associations = within(editor).getByRole('region', { name: 'Associations' });
    const [people, categories, foundations] = within(associations).getAllByRole('button');

    expect(people?.getAttribute('aria-label')).toBe('Choose people, Avery Brooks and Morgan Reed');
    expect(categories?.getAttribute('aria-label')).toBe('Choose categories, Faith and Marriage');
    expect(foundations?.getAttribute('aria-label')).toBe('Choose practices and foundations, Marriage: Connection and Marriage: Communication');
    expect(within(people!).getAllByRole('img').map(badge => badge.getAttribute('aria-label')))
      .toEqual(['Avery Brooks', 'Morgan Reed']);
    expect(within(categories!).getAllByRole('img').map(badge => badge.getAttribute('aria-label')))
      .toEqual(['Faith', 'Marriage']);
    expect(within(foundations!).getByText('Marriage foundations')).toBeTruthy();
    expect(within(foundations!).getAllByRole('img').map(badge => badge.getAttribute('aria-label')))
      .toEqual(['Marriage: Connection', 'Marriage: Communication']);
    expect(associations.querySelectorAll('button button')).toHaveLength(0);
  });

  it('explains unavailable Foundations for selected Categories without duplicating the message', () => {
    const rhythm: RhythmPreview = { ...todayRhythms[0]!, categoryIds: ['health'] };
    const initialDraft = rhythmDraftFrom(rhythm, ['health']);
    render(<RhythmEditor initialDraft={initialDraft} onSave={vi.fn(() => ({}))} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    const foundationsRow = within(editor).getByRole('button', { name: 'No Foundations are defined for Health & Fitness' });

    expect(within(foundationsRow).getByText('No Foundations are defined for Health & Fitness')).toBeTruthy();
    expect(within(foundationsRow).queryByText('No Foundations are defined for Health & Fitness.')).toBeNull();
  });

  it('opens the People picker from its full row with the keyboard and restores focus on Escape', async () => {
    const user = userEvent.setup();
    const editor = renderEditor(vi.fn(() => ({})));
    const peopleRow = within(editor).getByRole('button', { name: 'Choose people' });
    peopleRow.focus();
    await user.keyboard('{Enter}');
    expect(associationPicker('Choose people')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: 'Choose people' }));
  });

  it('keeps the Add Rhythm draft mounted behind one focused picker and applies only on Done', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    const editor = renderEditor(onSave);
    const title = within(editor).getByLabelText('Title') as HTMLInputElement;
    await user.type(title, 'Unchanged parent draft');
    editor.scrollTop = 137;

    await user.click(within(editor).getByRole('button', { name: /^Choose people/ }));
    let picker = associationPicker('Choose people');
    expect(editor.isConnected).toBe(true);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(screen.getByRole('dialog', { name: 'Add Rhythm' })).toBe(editor);
    expect(document.activeElement?.closest('dialog')).toBe(picker);
    expect(editor.scrollTop).toBe(137);
    expect(title.value).toBe('Unchanged parent draft');
    expect(within(picker).queryByText(/Suggested Rhythm draft|Synthetic preview only/)).toBeNull();
    expect(within(picker).queryByRole('button', { name: 'Add Rhythm' })).toBeNull();

    await user.click(within(picker).getByRole('button', { name: 'Avery Brooks' }));
    await user.click(within(picker).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Choose people' })).toBeNull();
    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: /^Choose people/ }));
    expect(editor.scrollTop).toBe(137);
    expect(within(editor).queryByRole('img', { name: 'Avery Brooks' })).toBeNull();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(within(editor).getByRole('button', { name: /^Choose people/ }));
    picker = associationPicker('Choose people');
    await user.click(within(picker).getByRole('button', { name: 'Avery Brooks' }));
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: /^Choose people,/ }));
    expect(within(editor).getByRole('img', { name: 'Avery Brooks' })).toBeTruthy();
    expect(editor.scrollTop).toBe(137);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('switches among the three association pickers and Escape closes only the foreground modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <RhythmEditor
        onSave={vi.fn((_draft: RhythmDraft) => ({}))}
        onClose={onClose}
      />
    );
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    const peopleRow = within(editor).getByRole('button', { name: 'Choose people' });

    for (const [rowName, pickerName] of [
      ['Choose people', 'Choose people'],
      ['Choose categories', 'Choose categories'],
      ['Choose a category first', 'Choose foundations']
    ] as const) {
      await user.click(within(editor).getByRole('button', { name: rowName }));
      const picker = associationPicker(pickerName);
      expect(screen.getAllByRole('dialog')).toHaveLength(2);
      expect(document.activeElement?.closest('dialog')).toBe(picker);
      await user.click(within(picker).getByRole('button', { name: 'Cancel' }));
      expect(screen.getByRole('dialog', { name: 'Add Rhythm' })).toBe(editor);
      expect(document.activeElement).toBe(within(editor).getByRole('button', { name: rowName }));
    }

    await user.click(peopleRow);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Choose people' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Add Rhythm' })).toBe(editor);
    expect(document.activeElement).toBe(peopleRow);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent(editor, new Event('cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('opens the supported sample-backed Daily schedule instead of an empty frequency choice', () => {
    const rhythm = todayRhythms.find(item => item.id === 'sample-connect')!;
    expect(rhythm.schedule).toBeUndefined();
    const editor = renderEditorForRhythm(rhythm);
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Daily' })).toBeTruthy();
    expect((within(editor).getByRole('checkbox', { name: 'Set an end date' }) as HTMLInputElement).checked).toBe(false);
    expect(within(editor).queryByLabelText('End date')).toBeNull();
    expect(within(editor).queryByRole('button', { name: /Change frequency/ })).toBeNull();
    expect(within(editor).queryByRole('button', { name: 'Keep descriptive cadence' })).toBeNull();
    expect(editor.classList.contains('money-goal-dialog--rhythm-editor')).toBe(true);
  });

  it('explains that descriptive-only cadence needs an explicit frequency before applying an end date', async () => {
    const user = userEvent.setup();
    const { schedule: _schedule, ...withoutSchedule } = todayRhythms[0]!;
    const rhythm: RhythmPreview = { ...withoutSchedule, cadence: 'Three times a week' };
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    const editor = renderEditorForRhythm(rhythm, onSave);

    expect(within(editor).getByRole('combobox', { name: 'Frequency: Choose frequency' })).toBeTruthy();
    await user.click(within(editor).getByRole('checkbox', { name: 'Set an end date' }));
    expect(within(editor).getByRole('status').textContent).toBe('Choose a frequency before setting an end date.');
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(within(editor).getByText('Choose a frequency before setting an end date.')).toBeTruthy();
  });

  it('keeps one end-date control below Time of day and saves checked and cleared dates from the shared draft', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    let editor = renderEditor(onSave);
    const timeLabel = within(editor).getByText('Time of day');
    const endDateToggle = within(editor).getByRole('checkbox', { name: 'Set an end date' });
    expect((endDateToggle as HTMLInputElement).checked).toBe(false);
    expect(within(editor).queryByLabelText('End date')).toBeNull();
    expect(timeLabel.compareDocumentPosition(endDateToggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(endDateToggle);
    const endDate = within(editor).getByLabelText('End date') as HTMLInputElement;
    fireEvent.change(endDate, { target: { value: '2027-06-30' } });
    expect(within(editor).getAllByRole('checkbox', { name: 'Set an end date' })).toHaveLength(1);
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(onSave.mock.calls.at(-1)?.[0].schedule).toMatchObject({
      frequency: 'daily',
      endDate: '2027-06-30'
    });

    const savedSchedule = onSave.mock.calls.at(-1)?.[0].schedule;
    expect(savedSchedule).toBeDefined();
    cleanup();
    const savedRhythm: RhythmPreview = { ...todayRhythms[0]!, schedule: savedSchedule! };
    editor = renderEditorForRhythm(savedRhythm, onSave);
    expect((within(editor).getByRole('checkbox', { name: 'Set an end date' }) as HTMLInputElement).checked).toBe(true);
    expect((within(editor).getByLabelText('End date') as HTMLInputElement).value).toBe('2027-06-30');

    await user.click(within(editor).getByRole('checkbox', { name: 'Set an end date' }));
    expect(within(editor).queryByLabelText('End date')).toBeNull();
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect((onSave.mock.calls.at(-1)?.[0].schedule as RhythmSchedule).endDate).toBeUndefined();
  });

  it('discards an unsaved end date when the main editor is canceled', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    const onClose = vi.fn();
    render(<RhythmEditor onSave={onSave} onClose={onClose} />);
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    await user.click(within(editor).getByRole('checkbox', { name: 'Set an end date' }));
    fireEvent.change(within(editor).getByLabelText('End date'), { target: { value: '2027-06-30' } });
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('blocks an invalid end date and retains its draft for correction', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = { ...todayRhythms[0]!, schedule: { frequency: 'daily' } };
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    const editor = renderEditorForRhythm(rhythm, onSave);
    await user.click(within(editor).getByRole('checkbox', { name: 'Set an end date' }));
    fireEvent.change(within(editor).getByLabelText('End date'), { target: { value: '' } });
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    expect(onSave).not.toHaveBeenCalled();
    expect((within(editor).getByRole('checkbox', { name: 'Set an end date' }) as HTMLInputElement).checked).toBe(true);
    expect((within(editor).getByLabelText('End date') as HTMLInputElement).value).toBe('');
    expect(within(editor).getByText('Choose a valid end date.')).toBeTruthy();
  });

  it('retains the end-date draft when the shared save command reports an error', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = { ...todayRhythms[0]!, schedule: { frequency: 'daily' } };
    const onSave = vi.fn((_draft: RhythmDraft) => ({ schedule: 'Could not save this schedule.' }));
    const editor = renderEditorForRhythm(rhythm, onSave);
    await user.click(within(editor).getByRole('checkbox', { name: 'Set an end date' }));
    fireEvent.change(within(editor).getByLabelText('End date'), { target: { value: '2027-06-30' } });
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    expect(onSave).toHaveBeenCalledOnce();
    expect((within(editor).getByRole('checkbox', { name: 'Set an end date' }) as HTMLInputElement).checked).toBe(true);
    expect((within(editor).getByLabelText('End date') as HTMLInputElement).value).toBe('2027-06-30');
    expect(within(editor).getByText('Could not save this schedule.')).toBeTruthy();
  });

  it('routes protected end-date changes through Season review and restores the opening draft on cancel', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = { ...todayRhythms[0]!, schedule: { frequency: 'daily' } };
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    render(
      <RhythmEditor
        rhythm={rhythm}
        hasDatedCompletionHistory
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    expect((within(dialog).getByRole('checkbox', { name: 'Set an end date' }) as HTMLInputElement).checked).toBe(false);
    await user.click(within(dialog).getByRole('checkbox', { name: 'Set an end date' }));
    fireEvent.change(within(dialog).getByLabelText('End date'), { target: { value: '2027-06-30' } });
    await user.click(within(dialog).getByRole('button', { name: 'Change frequency, currently Daily' }));
    expect(within(dialog).getAllByRole('checkbox', { name: 'Set an end date' })).toHaveLength(1);
    expect((within(dialog).getByLabelText('End date') as HTMLInputElement).value).toBe('2027-06-30');
    await user.click(within(dialog).getByRole('button', { name: 'Save Rhythm' }));

    const confirmation = screen.getByRole('dialog', { name: 'Change schedule' });
    expect(onSave).not.toHaveBeenCalled();
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel schedule change' }));
    expect(screen.queryByRole('dialog', { name: 'Change schedule' })).toBeNull();
    expect((within(dialog).getByRole('checkbox', { name: 'Set an end date' }) as HTMLInputElement).checked).toBe(false);
    expect(within(dialog).queryByLabelText('End date')).toBeNull();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Change frequency, currently Daily' }));
  });

  it('retains weekly selection and quarterly recurrence details in direct schedule controls', () => {
    const weekly: RhythmPreview = {
      ...todayRhythms[0]!,
      schedule: { frequency: 'weekly', weekdays: [1, 3], weeklyMode: 'select-days', endDate: '2027-01-31' }
    };
    const weeklyEditor = renderEditorForRhythm(weekly);
    expect(within(weeklyEditor).getByRole('combobox', { name: 'Frequency: Select Days' })).toBeTruthy();
    expect((within(weeklyEditor).getByRole('checkbox', { name: 'Monday' }) as HTMLInputElement).checked).toBe(true);
    expect((within(weeklyEditor).getByRole('checkbox', { name: 'Wednesday' }) as HTMLInputElement).checked).toBe(true);
    expect((within(weeklyEditor).getByLabelText('Set an end date') as HTMLInputElement).checked).toBe(true);
    expect((within(weeklyEditor).getByLabelText('End date') as HTMLInputElement).value).toBe('2027-01-31');
    cleanup();

    const quarterly: RhythmPreview = {
      ...todayRhythms[0]!,
      schedule: {
        frequency: 'quarterly',
        monthInQuarter: 2,
        pattern: { kind: 'ordinalWeekday', ordinal: 2, weekday: 3 },
        endDate: '2027-12-31'
      }
    };
    const quarterlyEditor = renderEditorForRhythm(quarterly);
    expect(within(quarterlyEditor).getByRole('combobox', { name: 'Frequency: Quarterly' })).toBeTruthy();
    expect(within(quarterlyEditor).getByRole('combobox', { name: 'Quarter months: Feb · May · Aug · Nov' })).toBeTruthy();
    expect(within(quarterlyEditor).getByRole('combobox', { name: 'Repeat on: A day of the week' })).toBeTruthy();
    expect(within(quarterlyEditor).getByRole('combobox', { name: 'Day: Wednesday' })).toBeTruthy();
    expect((within(quarterlyEditor).getByLabelText('End date') as HTMLInputElement).value).toBe('2027-12-31');
  });

  it('confirms scoring-relevant changes after history and restores the saved cadence on cancellation', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      schedule: { frequency: 'daily' }
    };
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    render(
      <RhythmEditor
        rhythm={rhythm}
        hasDatedCompletionHistory
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    expect(within(editor).getByRole('button', { name: 'Change frequency, currently Daily' })).toBeTruthy();
    expect(within(editor).queryByRole('combobox', { name: /Frequency:/ })).toBeNull();
    await user.click(within(editor).getByRole('button', { name: 'Change frequency, currently Daily' }));
    await choose(user, 'Frequency', 'Select Days');
    await user.click(within(editor).getByRole('checkbox', { name: 'Monday' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    let confirmation = screen.getByRole('dialog', { name: 'Change schedule' });
    expect(within(confirmation).getByText('Starts today')).toBeTruthy();
    expect(within(confirmation).getByText(new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }))).toBeTruthy();
    expect(within(confirmation).getByText('Earlier logs keep their original schedule.')).toBeTruthy();
    expect((within(confirmation).getByLabelText('Season name (optional)') as HTMLInputElement).value).toBe('');
    expect(onSave).not.toHaveBeenCalled();
    fireEvent(screen.getByRole('dialog', { name: 'Change schedule' }), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Change schedule' })).toBeNull();
    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: 'Change frequency, currently Daily' }));
    expect(within(editor).getByRole('button', { name: 'Change frequency, currently Daily' })).toBeTruthy();
    expect(within(editor).queryByRole('checkbox', { name: 'Monday' })).toBeNull();

    await user.click(within(editor).getByRole('button', { name: 'Change frequency, currently Daily' }));
    await choose(user, 'Frequency', 'Select Days');
    await user.click(within(editor).getByRole('checkbox', { name: 'Monday' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    confirmation = screen.getByRole('dialog', { name: 'Change schedule' });
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel schedule change' }));
    expect(screen.queryByRole('dialog', { name: 'Change schedule' })).toBeNull();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(within(editor).getByRole('button', { name: 'Change frequency, currently Daily' }));
    await choose(user, 'Frequency', 'Select Days');
    await user.click(within(editor).getByRole('checkbox', { name: 'Monday' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    confirmation = screen.getByRole('dialog', { name: 'Change schedule' });
    await user.click(within(confirmation).getByRole('button', { name: 'Apply' }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      schedule: { frequency: 'weekly', weekdays: [1], weeklyMode: 'select-days' }
    });
    expect(onSave.mock.calls[0]?.[0].seasonName).toBeUndefined();
  });

  it('shows long schedule summaries with their full accessible meaning', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      schedule: {
        frequency: 'weekly',
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        weeklyMode: 'select-days'
      }
    };
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    render(
      <RhythmEditor
        rhythm={rhythm}
        hasDatedCompletionHistory
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    const editor = screen.getByRole('dialog', {
      name: 'Edit Rhythm'
    });
    await user.click(within(editor).getByRole('button', {
      name: 'Change frequency, currently Select days · Sun · Mon · Tue · Wed · Thu · Fri · Sat'
    }));
    await choose(user, 'Frequency', 'Daily');
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    const confirmation = screen.getByRole('dialog', { name: 'Change schedule' });
    expect(within(confirmation).getByText('Select days · Sun · Mon · Tue · Wed · Thu · Fri · Sat')).toBeTruthy();
    expect(within(confirmation).getByText('Daily')).toBeTruthy();
    expect(within(confirmation).getByRole('group', {
      name: /Current: Selected days: Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, and Saturday\. New: Every day\./
    })).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('opens the protected frequency control by keyboard and restores focus after canceling the change flow', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = { ...todayRhythms[0]!, schedule: { frequency: 'daily' } };
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    render(
      <RhythmEditor
        rhythm={rhythm}
        hasDatedCompletionHistory
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    const frequencyButton = within(editor).getByRole('button', { name: 'Change frequency, currently Daily' });
    frequencyButton.focus();
    await user.keyboard('{Enter}');
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Daily' })).toBeTruthy();
    await choose(user, 'Frequency', 'Select Days');
    await user.click(within(editor).getByRole('checkbox', { name: 'Monday' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    const confirmation = screen.getByRole('dialog', { name: 'Change schedule' });
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel schedule change' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(
      within(editor).getByRole('button', { name: 'Change frequency, currently Daily' })
    );
  });

  it('requires an explicit frequency instead of treating a long description as a structured schedule', () => {
    const cadence = 'Every second Tuesday evening at the community center for a shared discussion';
    const { schedule: _schedule, ...withoutSchedule } = todayRhythms[0]!;
    const rhythm: RhythmPreview = { ...withoutSchedule, cadence };
    render(<RhythmEditor rhythm={rhythm} onSave={vi.fn(() => ({}))} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    const frequency = within(editor).getByRole('combobox', { name: 'Frequency: Choose frequency' });

    expect(within(editor).getByText('Frequency', { selector: 'label' })).toBeTruthy();
    expect(frequency).toBeTruthy();
    expect(within(editor).getByRole('button', { name: 'Keep descriptive cadence' })).toBeTruthy();
  });

  it('saves changed schedules without a Season confirmation before any logged history', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      schedule: { frequency: 'daily' }
    };
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    render(<RhythmEditor rhythm={rhythm} onSave={onSave} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Daily' })).toBeTruthy();
    await choose(user, 'Frequency', 'Select Days');
    await user.click(within(editor).getByRole('checkbox', { name: 'Monday' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    expect(onSave).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Change schedule' })).toBeNull();
    expect(onSave.mock.calls[0]?.[0].schedule).toEqual({
      frequency: 'weekly',
      weekdays: [1],
      weeklyMode: 'select-days'
    });
  });

  it('does not request Season confirmation for an unchanged schedule and cosmetic edit', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      schedule: { frequency: 'daily' }
    };
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    render(
      <RhythmEditor
        rhythm={rhythm}
        hasDatedCompletionHistory
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    fireEvent.change(within(editor).getByLabelText('Title'), { target: { value: 'Renamed rhythm' } });
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    expect(onSave).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Change schedule' })).toBeNull();
  });

  it('keeps the confirmed schedule and label draft when the save callback reports a failure', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      schedule: { frequency: 'daily' }
    };
    const onSave = vi.fn((_draft: RhythmDraft) => ({ schedule: 'The save was rejected.' }));
    render(
      <RhythmEditor
        rhythm={rhythm}
        hasDatedCompletionHistory
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.click(within(editor).getByRole('button', { name: 'Change frequency, currently Daily' }));
    await choose(user, 'Frequency', 'Select Days');
    await user.click(within(editor).getByRole('checkbox', { name: 'Tuesday' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    const confirmation = screen.getByRole('dialog', { name: 'Change schedule' });
    await user.type(within(confirmation).getByLabelText('Season name (optional)'), 'Morning walks');
    await user.click(within(confirmation).getByRole('button', { name: 'Apply' }));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      seasonName: 'Morning walks',
      schedule: { frequency: 'weekly', weekdays: [2], weeklyMode: 'select-days' }
    });
    expect(within(editor).getByText('The save was rejected.')).toBeTruthy();
    expect((within(editor).getByRole('checkbox', { name: 'Tuesday' }) as HTMLInputElement).checked).toBe(true);
  });

  it('requires an explicit schedule for descriptive cadence and preserves unrelated edits on cancellation', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[2]!,
      cadence: '3 times a week'
    };
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    render(
      <RhythmEditor rhythm={rhythm} hasDatedCompletionHistory onSave={onSave} onClose={vi.fn()} />
    );
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Choose frequency' })).toBeTruthy();
    expect(within(editor).getByRole('button', { name: 'Keep descriptive cadence' })).toBeTruthy();

    await user.clear(within(editor).getByLabelText('Title'));
    await user.type(within(editor).getByLabelText('Title'), 'Updated title');
    await choose(user, 'Frequency', 'Weekly');
    await user.click(within(editor).getByRole('radio', { name: 'Friday' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    const confirmation = screen.getByRole('dialog', { name: 'Change schedule' });
    expect(within(confirmation).getByText('3 times a week')).toBeTruthy();
    expect(within(confirmation).getByText('Every Fri')).toBeTruthy();
    expect(within(confirmation).getByRole('group', { name: /New: Every week on Friday/ })).toBeTruthy();
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel schedule change' }));

    expect((within(editor).getByLabelText('Title') as HTMLInputElement).value).toBe('Updated title');
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Choose frequency' })).toBeTruthy();
    expect(within(editor).queryByRole('radiogroup', { name: 'Choose one weekday' })).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(
      within(editor).getByRole('combobox', { name: 'Frequency: Choose frequency' })
    );
  });

  it('keeps multi-Season schedule changes protected after the completion records are removed', async () => {
    const user = userEvent.setup();
    const rhythmId = 'user-rhythm-123e4567-e89b-42d3-a456-426614174000';
    const daily = createRhythmSeason(rhythmId, '2026-10-01', { frequency: 'daily' });
    const current = createRhythmSeason(
      rhythmId,
      '2026-10-10',
      { frequency: 'weekly', weekdays: [3] }
    );
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      id: rhythmId,
      cadence: 'Every week on Wednesday.',
      schedule: { frequency: 'weekly', weekdays: [3] },
      scoring: {
        trackingStartDate: '2026-10-01',
        timeZone: 'UTC',
        scheduleHistory: [daily, current]
      }
    };
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    render(<RhythmEditor rhythm={rhythm} onSave={onSave} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    expect(within(editor).getByRole('button', { name: 'Change frequency, currently Every Wed' })).toBeTruthy();
    expect(within(editor).queryByRole('combobox', { name: /Frequency:/ })).toBeNull();

    await user.click(within(editor).getByRole('button', { name: 'Change frequency, currently Every Wed' }));
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Weekly' })).toBeTruthy();
    expect((within(editor).getByRole('radio', { name: 'Wednesday' }) as HTMLInputElement).checked).toBe(true);
    await choose(user, 'Frequency', 'Weekly');
    await user.click(within(editor).getByRole('radio', { name: 'Friday' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    const confirmation = screen.getByRole('dialog', { name: 'Change schedule' });
    await user.type(within(confirmation).getByLabelText('Season name (optional)'), 'After logs');
    await user.click(within(confirmation).getByRole('button', { name: 'Apply' }));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      schedule: { frequency: 'weekly', weekdays: [5] },
      seasonName: 'After logs'
    });
  });

  it('opens a protected period-based effective Season with all recurrence fields and time intact', async () => {
    const user = userEvent.setup();
    const id = 'user-rhythm-123e4567-e89b-42d3-a456-426614174000';
    const schedule: RhythmSchedule = {
      frequency: 'quarterly',
      monthInQuarter: 2,
      pattern: { kind: 'ordinalWeekday', ordinal: 2, weekday: 3 },
      endDate: '2027-12-31'
    };
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      id,
      cadence: 'Quarterly on the second Wednesday',
      schedule,
      scoring: {
        trackingStartDate: '2026-01-01',
        timeZone: 'UTC',
        scheduleHistory: [createRhythmSeason(id, '2026-01-01', schedule, 'early-morning')]
      }
    };
    render(
      <RhythmEditor
        rhythm={rhythm}
        hasDatedCompletionHistory
        onSave={vi.fn(() => ({}))}
        onClose={vi.fn()}
      />
    );
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.click(within(editor).getByRole('button', { name: /Change frequency/ }));
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Quarterly' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Time of day: Early morning' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Quarter months: Feb · May · Aug · Nov' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Repeat on: A day of the week' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Which week?: Second' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Day: Wednesday' })).toBeTruthy();
    expect((within(editor).getByLabelText('End date') as HTMLInputElement).value).toBe('2027-12-31');
  });

  it('does not block Rhythm editing on a tracking-start confirmation', () => {
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      schedule: { frequency: 'daily' }
    };
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    render(
      <RhythmEditor
        rhythm={rhythm}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    expect(within(editor).queryByLabelText('Tracking start date')).toBeNull();
    expect(within(editor).queryByRole('button', { name: 'Confirm tracking start' })).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('exposes all frequency branches and maps Select Days to the weekly model', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    const editor = renderEditor(onSave);

    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(onSave.mock.calls.at(-1)?.[0].schedule).toEqual({ frequency: 'daily' });

    const frequency = within(editor).getByRole('combobox', { name: 'Frequency: Daily' });
    await user.click(frequency);
    expect(within(editor).getByRole('option', { name: 'Daily' }).getAttribute('aria-selected')).toBe('true');
    expect(within(editor).getAllByRole('option').map(option => option.textContent)).toEqual([
      'Select Days',
      'Daily',
      'Weekly',
      'Monthly',
      'Quarterly',
      'Yearly',
      'Custom'
    ]);
    await user.click(within(editor).getByRole('option', { name: 'Select Days' }));
    await user.click(within(editor).getByRole('checkbox', { name: 'Tuesday' }));
    await user.click(within(editor).getByRole('checkbox', { name: 'Saturday' }));
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));

    expect(onSave.mock.calls.at(-1)?.[0].schedule).toEqual({
      frequency: 'weekly',
      weekdays: [2, 6]
    });
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Select Days' })).toBeTruthy();
  });

  it('retains an explicit one-day Select Days choice when editing and after reloading its saved schedule', async () => {
    const user = userEvent.setup();
    const schedule = {
      frequency: 'weekly' as const,
      weekdays: [1] as (1)[],
      weeklyMode: 'select-days' as const
    };
    const rhythm: RhythmPreview = { ...todayRhythms[0]!, schedule };
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    const { unmount } = render(<RhythmEditor rhythm={rhythm} onSave={onSave} onClose={vi.fn()} />);
    let editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Select Days' })).toBeTruthy();
    expect((within(editor).getByRole('checkbox', { name: 'Monday' }) as HTMLInputElement).checked).toBe(true);
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(onSave.mock.calls[0]?.[0].schedule).toEqual(schedule);

    unmount();
    const savedSchedule = onSave.mock.calls[0]![0].schedule;
    if (!savedSchedule) throw new Error('Expected the editor to save a structured schedule.');
    render(<RhythmEditor rhythm={{ ...rhythm, schedule: savedSchedule }} onSave={onSave} onClose={vi.fn()} />);
    editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Select Days' })).toBeTruthy();
    expect((within(editor).getByRole('checkbox', { name: 'Monday' }) as HTMLInputElement).checked).toBe(true);
  });

  it('makes Weekly single-choice, preserves Select Days multi-choice, and requires an explicit choice when switching', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      schedule: { frequency: 'weekly', weekdays: [1, 3] }
    };
    const onSave = vi.fn(validateRhythmDraft);
    render(<RhythmEditor rhythm={rhythm} onSave={onSave} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });

    expect(within(editor).getByRole('combobox', { name: 'Frequency: Select Days' })).toBeTruthy();
    expect((within(editor).getByRole('checkbox', { name: 'Monday' }) as HTMLInputElement).checked).toBe(true);
    expect((within(editor).getByRole('checkbox', { name: 'Wednesday' }) as HTMLInputElement).checked).toBe(true);

    await choose(user, 'Frequency', 'Weekly');
    const weekdays = within(editor).getByRole('radiogroup', { name: 'Choose one weekday' });
    expect(weekdays.getAttribute('aria-invalid')).toBe('true');
    const weekdayError = within(weekdays).getByRole('status');
    expect(weekdayError.textContent).toBe('Choose one day.');
    expect(weekdays.getAttribute('aria-describedby')).toBe(weekdayError.id);
    expect(within(editor).getAllByRole('radio').every(radio => !(radio as HTMLInputElement).checked)).toBe(true);
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.results[0]?.value.schedule).toBe('Complete the schedule details before saving.');
    expect(within(editor).queryByText('Complete the schedule details before saving.')).toBeNull();

    await user.click(within(editor).getByRole('radio', { name: 'Friday' }));
    expect((within(editor).getByRole('radio', { name: 'Friday' }) as HTMLInputElement).checked).toBe(true);
    expect(within(weekdays).queryByRole('status')).toBeNull();
    expect(weekdays.getAttribute('aria-invalid')).toBeNull();
    await user.click(within(editor).getByRole('radio', { name: 'Friday' }));
    expect((within(editor).getByRole('radio', { name: 'Friday' }) as HTMLInputElement).checked).toBe(true);
    await user.click(within(editor).getByRole('radio', { name: 'Monday' }));
    expect((within(editor).getByRole('radio', { name: 'Friday' }) as HTMLInputElement).checked).toBe(false);
    expect((within(editor).getByRole('radio', { name: 'Monday' }) as HTMLInputElement).checked).toBe(true);
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(onSave.mock.calls.at(-1)?.[0].schedule).toEqual({ frequency: 'weekly', weekdays: [1] });

    await choose(user, 'Frequency', 'Select Days');
    await user.click(within(editor).getByRole('checkbox', { name: 'Friday' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(onSave.mock.calls.at(-1)?.[0].schedule).toEqual({ frequency: 'weekly', weekdays: [1, 5] });
  });

  it('places an empty Select Days error with its group and clears it on keyboard selection', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(validateRhythmDraft);
    const editor = renderEditor(onSave);

    await choose(user, 'Frequency', 'Select Days');
    const weekdays = within(editor).getByRole('group', { name: 'Which days?' });
    expect(weekdays.getAttribute('aria-invalid')).toBeNull();
    expect(within(weekdays).queryByRole('status')).toBeNull();
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    const weekdayError = within(weekdays).getByRole('status');
    expect(weekdayError.textContent).toBe('Choose at least one day.');
    expect(weekdays.getAttribute('aria-invalid')).toBe('true');
    expect(weekdays.getAttribute('aria-describedby')).toBe(weekdayError.id);

    const wednesday = within(weekdays).getByRole('checkbox', { name: 'Wednesday' });
    wednesday.focus();
    await user.keyboard(' ');
    expect((wednesday as HTMLInputElement).checked).toBe(true);
    expect(within(weekdays).queryByRole('status')).toBeNull();
    expect(weekdays.getAttribute('aria-invalid')).toBeNull();

    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(within(editor).queryByText('Complete the schedule details before saving.')).toBeNull();
    expect(onSave.mock.calls.at(-1)?.[0].schedule).toEqual({
      frequency: 'weekly',
      weekdays: [3],
      weeklyMode: 'select-days'
    });
  });

  it('builds monthly, quarterly and yearly pattern shapes from their conditional controls', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    const editor = renderEditor(onSave);

    await choose(user, 'Frequency', 'Monthly');
    expect(within(editor).getByText('Repeat on')).toBeTruthy();
    expect(within(editor).queryByText('Pattern type')).toBeNull();
    await choose(user, 'Repeat on', 'A day of the week');
    expect(within(editor).getByRole('combobox', { name: 'Which week?: First' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Day: Sunday' })).toBeTruthy();
    const weekChoices = within(editor).getByRole('combobox', { name: 'Which week?: First' });
    await user.click(weekChoices);
    expect(within(editor).getAllByRole('option').map(option => option.textContent)).toEqual([
      'First', 'Second', 'Third', 'Fourth', 'Last'
    ]);
    await user.keyboard('{Escape}');
    await choose(user, 'Which week?', 'Last');
    await choose(user, 'Day', 'Friday');
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(onSave.mock.calls.at(-1)?.[0].schedule).toEqual({
      frequency: 'monthly',
      pattern: { kind: 'ordinalWeekday', ordinal: 'last', weekday: 5 }
    });

    await choose(user, 'Frequency', 'Quarterly');
    await choose(user, 'Quarter months', 'Mar · Jun · Sep · Dec');
    await choose(user, 'Repeat on', 'A date');
    await choose(user, 'Date', 'Last day');
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(onSave.mock.calls.at(-1)?.[0].schedule).toEqual({
      frequency: 'quarterly',
      monthInQuarter: 3,
      pattern: { kind: 'dayOfMonth', day: 'last' }
    });

    await choose(user, 'Frequency', 'Yearly');
    await choose(user, 'Month', 'May');
    await choose(user, 'Date', '28');
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(onSave.mock.calls.at(-1)?.[0].schedule).toEqual({
      frequency: 'yearly',
      month: 5,
      pattern: { kind: 'dayOfMonth', day: 28 }
    });
  });

  it.each([
    { frequency: 'Monthly', unit: undefined },
    { frequency: 'Quarterly', unit: undefined },
    { frequency: 'Yearly', unit: undefined },
    { frequency: 'Custom', unit: 'months' },
    { frequency: 'Custom', unit: 'years' }
  ])('groups date and ordinal-weekday fields for $frequency $unit patterns', async ({ frequency, unit }) => {
    const user = userEvent.setup();
    const editor = renderEditor();

    await choose(user, 'Frequency', frequency);
    if (unit) await choose(user, 'Repeat interval unit', unit);

    const repeatOn = within(editor).getByRole('group', { name: 'Repeat on' });
    expect(within(repeatOn).getByRole('combobox', { name: 'Repeat on: A date' })).toBeTruthy();
    const onDay = within(editor).getByRole('group', { name: 'On day' });
    expect(within(onDay).getByRole('combobox', { name: 'Date: 1' })).toBeTruthy();

    await choose(user, 'Repeat on', 'A day of the week');
    const onThe = within(editor).getByRole('group', { name: 'On the' });
    const ordinalWeekday = within(onThe).getByRole('group', { name: 'Ordinal and weekday' });
    expect(within(ordinalWeekday).getByRole('combobox', { name: 'Which week?: First' })).toBeTruthy();
    expect(within(ordinalWeekday).getByRole('combobox', { name: 'Day: Sunday' })).toBeTruthy();
  });

  it('supports each Custom unit, interval, local start/end dates, and its applicable pattern controls', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    const editor = renderEditor(onSave);

    await choose(user, 'Frequency', 'Custom');
    expect(within(editor).queryByLabelText('End date')).toBeNull();
    fireEvent.change(within(editor).getByLabelText('Repeat every'), { target: { value: '3' } });
    fireEvent.change(within(editor).getByLabelText('Starting on'), { target: { value: '2026-11-04' } });
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(onSave.mock.calls.at(-1)?.[0].schedule).toMatchObject({
      frequency: 'custom',
      unit: 'days',
      interval: 3,
      startDate: '2026-11-04'
    });

    await choose(user, 'Repeat interval unit', 'weeks');
    await user.click(within(editor).getByRole('checkbox', { name: 'Monday' }));
    await user.click(within(editor).getByRole('checkbox', { name: 'Thursday' }));
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(onSave.mock.calls.at(-1)?.[0].schedule).toMatchObject({
      frequency: 'custom',
      unit: 'weeks',
      weekdays: [1, 4],
      startDate: '2026-11-04'
    });

    await choose(user, 'Repeat interval unit', 'months');
    await choose(user, 'Date', '28');
    await user.click(within(editor).getByRole('checkbox', { name: 'Set an end date' }));
    fireEvent.change(within(editor).getByLabelText('End date'), { target: { value: '2026-12-31' } });
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(onSave.mock.calls.at(-1)?.[0].schedule).toMatchObject({
      frequency: 'custom',
      unit: 'months',
      pattern: { kind: 'dayOfMonth', day: 28 },
      startDate: '2026-11-04',
      endDate: '2026-12-31'
    });

    await choose(user, 'Repeat interval unit', 'years');
    await choose(user, 'Month', 'February');
    await choose(user, 'Date', '28');
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(onSave.mock.calls.at(-1)?.[0].schedule).toMatchObject({
      frequency: 'custom',
      unit: 'years',
      month: 2,
      pattern: { kind: 'dayOfMonth', day: 28 },
      startDate: '2026-11-04',
      endDate: '2026-12-31'
    });
  });

  it('renders existing structured schedules and keeps editing controls available in edit mode', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      id: 'user-rhythm-123e4567-e89b-42d3-a456-426614174000',
      title: 'Existing schedule',
      cadence: 'The first Sunday of every month.',
      timeLabel: 'Morning',
      automation: 'manual',
      status: 'Due today',
      personIds: [],
      categoryIds: [],
      schedule: {
        frequency: 'monthly',
        pattern: { kind: 'ordinalWeekday', ordinal: 1, weekday: 0 },
        endDate: '2026-12-31'
      },
      personal: true
    };
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    render(<RhythmEditor rhythm={rhythm} onSave={onSave} onArchive={vi.fn()} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });

    expect(within(editor).queryByRole('checkbox', { name: 'Personal' })).toBeNull();
    expect(within(editor).getByRole('combobox', { name: 'Repeat on: A day of the week' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Which week?: First' })).toBeTruthy();
    const endDate = within(editor).getByLabelText('End date');
    expect(endDate).toBeTruthy();
    expect(endDate.parentElement?.classList.contains('goal-field')).toBe(true);
    expect(endDate.closest('.rhythm-schedule-fields__end-date-row')?.contains(
      within(editor).getByRole('checkbox', { name: 'Set an end date' })
    )).toBe(true);
    expect(within(editor).queryByText('Ending on')).toBeNull();
    expect(within(editor).getByRole('button', { name: 'Archive Existing schedule' })).toBeTruthy();

    await user.clear(within(editor).getByLabelText('Title'));
    await user.type(within(editor).getByLabelText('Title'), 'Updated schedule title');
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Updated schedule title',
      personal: true
    }));

    await choose(user, 'Frequency', 'Yearly');
    expect(within(editor).getByRole('combobox', { name: 'Month: January' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Repeat on: A day of the week' })).toBeTruthy();
    expect(within(editor).getByRole('button', { name: 'Save Rhythm' })).toBeTruthy();
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('covers each conditional schedule branch while editing an existing Rhythm', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      id: 'user-rhythm-123e4567-e89b-42d3-a456-426614174000',
      title: 'Branch coverage',
      cadence: 'Every month on the first Sunday.',
      timeLabel: 'Morning',
      automation: 'manual',
      status: 'Due today',
      personIds: [],
      categoryIds: [],
      schedule: { frequency: 'monthly', pattern: { kind: 'ordinalWeekday', ordinal: 1, weekday: 0 } }
    };
    render(<RhythmEditor rhythm={rhythm} onSave={vi.fn(() => ({}))} onArchive={vi.fn()} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });

    await choose(user, 'Frequency', 'Daily');
    expect(within(editor).queryByRole('group', { name: 'Which days?' })).toBeNull();
    await choose(user, 'Frequency', 'Weekly');
    expect(within(editor).getByRole('radiogroup', { name: 'Choose one weekday' })).toBeTruthy();
    await choose(user, 'Frequency', 'Select Days');
    expect(within(editor).getByRole('checkbox', { name: 'Sunday' })).toBeTruthy();
    await choose(user, 'Frequency', 'Monthly');
    expect(within(editor).getByRole('combobox', { name: 'Which week?: First' })).toBeTruthy();
    await choose(user, 'Frequency', 'Quarterly');
    expect(within(editor).getByRole('combobox', { name: 'Quarter months: Jan · Apr · Jul · Oct' })).toBeTruthy();
    await choose(user, 'Frequency', 'Yearly');
    expect(within(editor).getByRole('combobox', { name: 'Month: January' })).toBeTruthy();
    await choose(user, 'Frequency', 'Custom');
    expect(within(editor).getByLabelText('Starting on')).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Repeat interval unit: days' })).toBeTruthy();
    await choose(user, 'Repeat interval unit', 'weeks');
    expect(within(editor).getByRole('group', { name: 'Which days?' })).toBeTruthy();
    await choose(user, 'Repeat interval unit', 'months');
    expect(within(editor).getByRole('combobox', { name: 'Which week?: First' })).toBeTruthy();
    await choose(user, 'Repeat interval unit', 'years');
    expect(within(editor).getByRole('combobox', { name: 'Month: January' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Which week?: First' })).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
  });

  it.each(['Monthly', 'Quarterly', 'Yearly', 'Custom months', 'Custom years'])(
    'offers only days 1–28 and Last day for %s date patterns',
    async choice => {
      const user = userEvent.setup();
      const editor = renderEditor();
      if (choice.startsWith('Custom')) {
        await choose(user, 'Frequency', 'Custom');
        await choose(user, 'Repeat interval unit', choice === 'Custom months' ? 'months' : 'years');
      } else {
        await choose(user, 'Frequency', choice);
      }
      if (choice === 'Quarterly') await choose(user, 'Quarter months', 'Jan · Apr · Jul · Oct');

      await user.click(within(editor).getByRole('combobox', { name: 'Date: 1' }));
      const options = within(editor).getAllByRole('option');
      expect(options.filter(option => option.getAttribute('aria-disabled') !== 'true').map(option => option.textContent))
        .toEqual([...Array.from({ length: 28 }, (_, index) => String(index + 1)), 'Last day']);
    }
  );

  it('allows choosing Last day for a monthly date pattern', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    const editor = renderEditor(onSave);
    await choose(user, 'Frequency', 'Monthly');
    await choose(user, 'Date', 'Last day');
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));

    expect(onSave.mock.calls.at(-1)?.[0].schedule).toEqual({
      frequency: 'monthly',
      pattern: { kind: 'dayOfMonth', day: 'last' }
    });
  });

  it.each([
    { day: 29, schedule: { frequency: 'monthly', pattern: { kind: 'dayOfMonth', day: 29 } } },
    { day: 30, schedule: { frequency: 'quarterly', monthInQuarter: 2, pattern: { kind: 'dayOfMonth', day: 30 } } },
    { day: 31, schedule: { frequency: 'yearly', month: 1, pattern: { kind: 'dayOfMonth', day: 31 } } },
    { day: 29, schedule: { frequency: 'custom', unit: 'months', interval: 2, pattern: { kind: 'dayOfMonth', day: 29 }, startDate: '2026-10-22' } },
    { day: 31, schedule: { frequency: 'custom', unit: 'years', interval: 1, month: 1, pattern: { kind: 'dayOfMonth', day: 31 }, startDate: '2026-10-22' } }
  ] as const)('preserves saved day $day when editing an unrelated title field', async ({ day, schedule }) => {
    const user = userEvent.setup();
    const existing = {
      id: 'user-rhythm-123e4567-e89b-42d3-a456-426614174000',
      title: 'Existing rhythm',
      cadence: 'Existing cadence',
      timeLabel: 'Morning' as const,
      personIds: [],
      categoryIds: [],
      schedule
    };
    let savedSchedule: RhythmPreview['schedule'];
    const onSave = vi.fn((draft: RhythmDraft) => {
      const result = saveRhythmDraft([existing], draft, existing.id, 'edit');
      savedSchedule = result.savedRhythms?.[0]?.schedule;
      return result.errors;
    });
    const rhythm: RhythmPreview = {
      ...existing,
      automation: 'manual',
      status: 'Due today'
    };
    render(<RhythmEditor rhythm={rhythm} onSave={onSave} onArchive={vi.fn()} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    expect(within(editor).getByRole('combobox', { name: `Date: ${day} (existing value)` })).toBeTruthy();

    fireEvent.change(within(editor).getByLabelText('Title'), { target: { value: 'Updated title' } });
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    expect(savedSchedule).toEqual(schedule);
  });

  it('replaces a legacy day only after the user explicitly selects a supported day', async () => {
    const user = userEvent.setup();
    const schedule: NonNullable<RhythmPreview['schedule']> = {
      frequency: 'monthly',
      pattern: { kind: 'dayOfMonth', day: 31 }
    };
    const existing = {
      id: 'user-rhythm-123e4567-e89b-42d3-a456-426614174000',
      title: 'Existing rhythm',
      cadence: 'Existing cadence',
      timeLabel: 'Morning' as const,
      personIds: [],
      categoryIds: [],
      schedule
    };
    let savedSchedule: RhythmPreview['schedule'];
    const onSave = vi.fn((draft: RhythmDraft) => {
      const result = saveRhythmDraft([existing], draft, existing.id, 'edit');
      savedSchedule = result.savedRhythms?.[0]?.schedule;
      return result.errors;
    });
    render(
      <RhythmEditor
        rhythm={{ ...existing, automation: 'manual', status: 'Due today' }}
        onSave={onSave}
        onArchive={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });

    await choose(user, 'Date', '28');
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    expect(savedSchedule).toEqual({
      frequency: 'monthly',
      pattern: { kind: 'dayOfMonth', day: 28 }
    });
  });

  it('rejects invalid Custom intervals and end dates through the shared schedule validator', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((draft: RhythmDraft) => validateRhythmDraft(draft));
    const editor = renderEditor(onSave);
    await choose(user, 'Frequency', 'Custom');
    fireEvent.change(within(editor).getByLabelText('Repeat every'), { target: { value: '0' } });
    fireEvent.change(within(editor).getByLabelText('Starting on'), { target: { value: '2026-11-04' } });
    await user.click(within(editor).getByRole('checkbox', { name: 'Set an end date' }));
    fireEvent.change(within(editor).getByLabelText('End date'), { target: { value: '2026-10-04' } });
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));

    expect(onSave.mock.calls.at(-1)?.[0].schedule).toBeUndefined();
    expect(within(editor).getByText('Complete the schedule details before saving.')).toBeTruthy();
  });

  it('validates incomplete schedules and preserves keyboard selection, typeahead, Escape, and Tab exit', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((draft: RhythmDraft) => validateRhythmDraft(draft));
    const editor = renderEditor(onSave);
    const frequency = within(editor).getByRole('combobox', { name: 'Frequency: Daily' });
    frequency.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement?.getAttribute('role')).toBe('option');
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement?.textContent).toBe('Select Days');
    await user.keyboard('{Home}');
    expect(document.activeElement?.textContent).toBe('Select Days');
    await user.keyboard('{End}');
    expect(document.activeElement?.textContent).toBe('Custom');
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement?.textContent).toBe('Select Days');
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(frequency);
    await user.keyboard('{Enter}');
    expect(within(editor).getByRole('option', { name: 'Daily' }).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('w');
    expect(document.activeElement?.textContent).toBe('Weekly');
    await user.keyboard('{Enter}');
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Weekly' }).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(frequency);
    expect(within(editor).getByRole('radio', { name: 'Monday' })).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(within(editor).getByText('Choose one day.')).toBeTruthy();

    const time = within(editor).getByRole('combobox', { name: 'Time of day: Anytime' });
    time.focus();
    await user.keyboard('{Enter}');
    expect(within(editor).getAllByRole('option')).toHaveLength(9);
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(time);
    await user.keyboard('b');
    expect(document.activeElement?.textContent).toContain('Bedtime');
    await user.keyboard(' ');
    expect(within(editor).getByRole('combobox', { name: 'Time of day: Bedtime' })).toBeTruthy();
    expect(document.activeElement).toBe(time);

    frequency.focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{Tab}');
    expect(document.activeElement?.getAttribute('role')).not.toBe('option');
  });

  it('keeps adding cancellable without saving and omits the Personal checkbox', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    const onClose = vi.fn();
    render(<RhythmEditor onSave={onSave} onClose={onClose} />);
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });

    expect(within(editor).queryByRole('checkbox', { name: 'Personal' })).toBeNull();
    expect(within(editor).getByText('Synthetic preview only. Schedules are stored and displayed, but do not calculate due dates or control completion eligibility.')).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('uses non-navigating shared person badges for selected people in an initial draft', () => {
    const rhythm = todayRhythms[0]!;
    const initialDraft = rhythmDraftFrom(rhythm, rhythm.categoryIds ?? []);
    render(<RhythmEditor initialDraft={initialDraft} onSave={vi.fn(() => ({}))} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    const selectedPeople = within(editor).getByRole('button', { name: 'Choose people, Avery Brooks and Morgan Reed' });

    expect(within(selectedPeople).getAllByRole('img').map(badge => badge.getAttribute('aria-label')))
      .toEqual(['Avery Brooks', 'Morgan Reed']);
    expect(selectedPeople.querySelectorAll('button')).toHaveLength(0);
    expect(within(selectedPeople).getByRole('img', { name: 'Morgan Reed' })
      .querySelector('.person-badge-visual')).toBeTruthy();
  });

  it('applies category picker changes only on Done and restores focus to its opener', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    const onClose = vi.fn();
    render(<RhythmEditor onSave={onSave} onClose={onClose} />);
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    fireEvent.change(within(editor).getByLabelText('Title'), { target: { value: 'Kept title' } });

    await user.click(within(editor).getByRole('button', { name: /^Choose categories/ }));
    let picker = associationPicker('Choose categories');
    const marriage = within(picker).getByRole('button', { name: 'Marriage' });
    expect(marriage.getAttribute('aria-pressed')).toBe('false');
    await user.click(marriage);
    expect(marriage.getAttribute('aria-pressed')).toBe('true');
    await user.click(within(picker).getByRole('button', { name: 'Cancel' }));

    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: /^Choose categories/ }));
    expect(within(editor).queryByText(/^\d+ selected$/)).toBeNull();
    expect((within(editor).getByLabelText('Title') as HTMLInputElement).value).toBe('Kept title');

    await user.click(within(editor).getByRole('button', { name: /^Choose categories/ }));
    picker = associationPicker('Choose categories');
    await user.click(within(picker).getByRole('button', { name: 'Marriage' }));
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: /^Choose categories/ }));
    expect(within(editor).getByRole('button', { name: /^Choose categories/ })
      .querySelector('[aria-label="Marriage"]')).toBeTruthy();

    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('stages Foundation selection changes until Done and restores opener focus after Escape', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      title: 'Foundation editor fixture',
      categoryIds: ['marriage'],
      primaryFoundationId: 'connection',
      secondaryFoundationIds: ['communication']
    };
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    render(<RhythmEditor rhythm={rhythm} onSave={onSave} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });

    expect(within(editor).getByRole('img', { name: 'Marriage: Connection' })).toBeTruthy();
    expect(within(editor).getByRole('img', { name: 'Marriage: Communication' })).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: /^Choose foundations/ }));
    const picker = associationPicker('Choose foundations');
    const connection = within(picker).getByRole('button', { name: 'Connection' });
    const communication = within(picker).getByRole('button', { name: 'Communication' });
    expect(connection.getAttribute('aria-pressed')).toBe('true');
    expect(communication.getAttribute('aria-pressed')).toBe('true');
    const intimacy = within(picker).getByRole('button', { name: 'Intimacy' });
    intimacy.focus();
    await user.keyboard('{Enter}');
    expect(intimacy.getAttribute('aria-pressed')).toBe('true');
    await user.keyboard('{Escape}');

    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: /^Choose foundations/ }));
    expect(within(editor).queryByRole('img', { name: 'Marriage: Intimacy' })).toBeNull();
    expect(within(editor).getByRole('img', { name: 'Marriage: Communication' })).toBeTruthy();

    await user.click(within(editor).getByRole('button', { name: /^Choose foundations/ }));
    const secondPicker = associationPicker('Choose foundations');
    await user.click(within(secondPicker).getByRole('button', { name: 'Communication' }));
    await user.click(within(secondPicker).getByRole('button', { name: 'Intimacy' }));
    await user.click(within(secondPicker).getByRole('button', { name: 'Fun & Adventure' }));
    await user.click(within(secondPicker).getByRole('button', { name: 'Done' }));
    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: /^Choose foundations/ }));
    expect(within(editor).queryByRole('img', { name: 'Marriage: Communication' })).toBeNull();
    expect(within(editor).getByRole('img', { name: 'Marriage: Fun & Adventure' })).toBeTruthy();

    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      primaryFoundationId: 'connection',
      secondaryFoundationIds: ['intimacy', 'fun-adventure']
    });
  });

  it('supports keyboard selection in the Category picker and applies it to the editor draft', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    const editor = renderEditor(onSave);

    await user.click(within(editor).getByRole('button', { name: /^Choose categories/ }));
    const picker = associationPicker('Choose categories');
    const faith = within(picker).getByRole('button', { name: 'Faith' });
    faith.focus();
    await user.keyboard('{Enter}');
    expect(faith.getAttribute('aria-pressed')).toBe('true');
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: /^Choose categories/ }));
    expect(within(editor).getByRole('img', { name: 'Faith' })).toBeTruthy();

    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(onSave.mock.calls[0]?.[0].categoryIds).toEqual(['faith']);
  });

  it('confirms Category removal, stages owned Foundation unlinks, and does not restore links when re-added', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      title: 'Category removal fixture',
      categoryIds: ['marriage'],
      primaryFoundationId: 'connection',
      secondaryFoundationIds: []
    };
    const onSave = vi.fn(validateRhythmDraft);
    render(<RhythmEditor rhythm={rhythm} onSave={onSave} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });

    await user.click(within(editor).getByRole('button', { name: /^Choose categories/ }));
    let picker = associationPicker('Choose categories');
    await user.click(within(picker).getByRole('button', { name: 'Marriage' }));
    picker = associationPicker('Remove Marriage?');
    expect(within(picker).getByText(
      'This also unlinks Connection. Your rhythm and logged moments stay saved.'
    )).toBeTruthy();
    await user.click(within(picker).getByRole('button', { name: 'Cancel' }));
    picker = associationPicker('Choose categories');
    const marriageOption = within(picker).getByRole('button', { name: 'Marriage' });
    expect(document.activeElement).toBe(marriageOption);
    expect(marriageOption.getAttribute('aria-pressed')).toBe('true');

    await user.click(marriageOption);
    picker = associationPicker('Remove Marriage?');
    await user.click(within(picker).getByRole('button', { name: 'Remove' }));
    picker = associationPicker('Choose categories');
    expect(document.activeElement).toBe(within(picker).getByRole('button', { name: 'Marriage' }));
    expect(within(picker).getByRole('button', { name: 'Marriage' }).getAttribute('aria-pressed')).toBe('false');
    expect(within(editor).getByRole('img', { name: 'Marriage: Connection' })).toBeTruthy();

    await user.click(within(picker).getByRole('button', { name: 'Marriage' }));
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    expect(within(editor).getByRole('img', { name: 'Marriage' })).toBeTruthy();
    expect(within(editor).queryByRole('img', { name: 'Marriage: Connection' })).toBeNull();
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    expect(onSave.mock.calls.at(-1)?.[0]).toMatchObject({
      categoryIds: ['marriage'],
      primaryFoundationId: null,
      secondaryFoundationIds: []
    });
  });

  it('discards confirmed Category cleanup when the picker is canceled and preserves the main draft', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      title: 'Picker cancellation fixture',
      categoryIds: ['marriage'],
      primaryFoundationId: 'connection',
      secondaryFoundationIds: []
    };
    const onSave = vi.fn(validateRhythmDraft);
    const onClose = vi.fn();
    render(<RhythmEditor rhythm={rhythm} onSave={onSave} onClose={onClose} />);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });

    await user.click(within(editor).getByRole('button', { name: /^Choose categories/ }));
    let picker = associationPicker('Choose categories');
    await user.click(within(picker).getByRole('button', { name: 'Marriage' }));
    picker = associationPicker('Remove Marriage?');
    await user.click(within(picker).getByRole('button', { name: 'Remove' }));
    await user.click(within(associationPicker('Choose categories')).getByRole('button', { name: 'Cancel' }));

    expect(within(editor).getByRole('img', { name: 'Marriage' })).toBeTruthy();
    expect(within(editor).getByRole('img', { name: 'Marriage: Connection' })).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('allows explicitly unlinking a known orphan Foundation before saving', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      title: 'Orphan Foundation fixture',
      categoryIds: [],
      primaryFoundationId: 'connection',
      secondaryFoundationIds: []
    };
    const onSave = vi.fn(validateRhythmDraft);
    render(<RhythmEditor rhythm={rhythm} onSave={onSave} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });

    expect(within(editor).getByRole('status').textContent)
      .toContain('Some Foundation links need their Category selected');
    await user.click(within(editor).getByRole('button', { name: /^Choose foundations/ }));
    const picker = associationPicker('Choose foundations');
    const orphan = within(picker).getByRole('button', {
      name: 'Connection (currently linked; Marriage category not selected)'
    });
    expect(orphan.getAttribute('aria-pressed')).toBe('true');
    await user.click(orphan);
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    expect(onSave.mock.calls.at(-1)?.[0]).toMatchObject({
      categoryIds: [],
      primaryFoundationId: null,
      secondaryFoundationIds: []
    });
  });

  it('reports unresolved Foundation references and offers an explicit removal action', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      title: 'Unresolved Foundation fixture',
      categoryIds: ['marriage'],
      primaryFoundationId: 'deleted-foundation',
      secondaryFoundationIds: []
    };
    const onSave = vi.fn(validateRhythmDraft);
    render(<RhythmEditor rhythm={rhythm} onSave={onSave} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });

    expect(within(editor).getByRole('button', {
      name: 'Choose foundations, Unresolved: deleted-foundation'
    })).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(within(editor).getByText(
      'Remove or resolve unavailable Foundation links before saving: deleted-foundation.'
    )).toBeTruthy();

    await user.click(within(editor).getByRole('button', {
      name: 'Choose foundations, Unresolved: deleted-foundation'
    }));
    const picker = associationPicker('Choose foundations');
    await user.click(within(picker).getByRole('button', {
      name: 'Remove unresolved Foundation link deleted-foundation'
    }));
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(onSave.mock.calls.at(-1)?.[0]).toMatchObject({
      categoryIds: ['marriage'],
      primaryFoundationId: null,
      secondaryFoundationIds: []
    });
  });

  it('unlinks every Foundation owned by the removed Category and preserves other associations', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      title: 'Multiple Foundation cleanup fixture',
      personIds: ['sample-person-morgan'],
      categoryIds: ['marriage', 'faith'],
      primaryFoundationId: 'connection',
      secondaryFoundationIds: ['communication', 'spiritual-growth']
    };
    const onSave = vi.fn(validateRhythmDraft);
    render(<RhythmEditor rhythm={rhythm} onSave={onSave} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });

    await user.click(within(editor).getByRole('button', { name: /^Choose categories/ }));
    let picker = associationPicker('Choose categories');
    await user.click(within(picker).getByRole('button', { name: 'Marriage' }));
    picker = associationPicker('Remove Marriage?');
    expect(within(picker).getByText(
      'This also unlinks Connection, Communication and Spiritual Growth. Your rhythm and logged moments stay saved.'
    )).toBeTruthy();
    await user.click(within(picker).getByRole('button', { name: 'Remove' }));
    await user.click(within(associationPicker('Choose categories')).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));

    expect(onSave.mock.calls.at(-1)?.[0]).toMatchObject({
      categoryIds: ['faith'],
      personIds: ['sample-person-morgan'],
      primaryFoundationId: null,
      secondaryFoundationIds: []
    });
  });

  it('removes a Category without confirmation when it owns no linked Foundations', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      title: 'Category without Foundation links',
      categoryIds: ['faith'],
      primaryFoundationId: null,
      secondaryFoundationIds: []
    };
    const onSave = vi.fn(validateRhythmDraft);
    render(<RhythmEditor rhythm={rhythm} onSave={onSave} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });

    await user.click(within(editor).getByRole('button', { name: /^Choose categories/ }));
    const picker = associationPicker('Choose categories');
    await user.click(within(picker).getByRole('button', { name: 'Faith' }));
    expect(screen.queryByRole('dialog', { name: 'Remove Faith?' })).toBeNull();
    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(onSave.mock.calls.at(-1)?.[0].categoryIds).toEqual([]);
  });

  it('uses Escape to cancel the confirmation and then the Category picker with focus restoration', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      title: 'Category removal Escape fixture',
      categoryIds: ['marriage'],
      primaryFoundationId: 'connection',
      secondaryFoundationIds: []
    };
    const onSave = vi.fn(validateRhythmDraft);
    render(<RhythmEditor rhythm={rhythm} onSave={onSave} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });

    await user.click(within(editor).getByRole('button', { name: /^Choose categories/ }));
    let picker = associationPicker('Choose categories');
    await user.click(within(picker).getByRole('button', { name: 'Marriage' }));
    await user.keyboard('{Escape}');
    picker = associationPicker('Choose categories');
    const marriageOption = within(picker).getByRole('button', { name: 'Marriage' });
    expect(document.activeElement).toBe(marriageOption);
    expect(marriageOption.getAttribute('aria-pressed')).toBe('true');
    await user.keyboard('{Escape}');

    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: /^Choose categories/ }));
    expect(within(editor).getByRole('img', { name: 'Marriage: Connection' })).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('toggles person groups, preserves unrelated selections, and saves only after Done', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      id: 'user-rhythm-123e4567-e89b-42d3-a456-426614174000',
      title: 'Associated rhythm',
      cadence: 'Every day',
      timeLabel: 'Morning',
      automation: 'manual',
      status: 'Due today',
      personIds: ['sample-person-morgan'],
      categoryIds: ['faith']
    };
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    render(<RhythmEditor rhythm={rhythm} onSave={onSave} onArchive={vi.fn()} onClose={vi.fn()} />);
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    await user.click(within(editor).getByRole('button', { name: /^Choose people/ }));
    let picker = associationPicker('Choose people');
    expect(within(picker).getByRole('button', { name: 'Morgan Reed' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(picker).getByRole('button', { name: 'Select Marriage people' }));
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: /^Choose people/ }));
    await user.click(within(editor).getByRole('button', { name: /^Choose people/ }));
    picker = associationPicker('Choose people');
    expect(within(picker).getByRole('button', { name: 'Morgan Reed' }).getAttribute('aria-pressed')).toBe('true');

    const marriage = within(picker).getByRole('button', { name: 'Select Marriage people' });
    expect(marriage.getAttribute('aria-pressed')).toBe('false');
    await user.click(marriage);
    expect(marriage.getAttribute('aria-pressed')).toBe('true');
    expect(within(picker).getByRole('button', { name: 'Avery Brooks' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(picker).getByRole('button', { name: 'Jordan Bell' }).getAttribute('aria-pressed')).toBe('false');
    await user.click(within(picker).getByRole('button', { name: 'Select Parenting people' }));
    expect(within(picker).getByRole('button', { name: 'Avery Brooks' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(picker).getByRole('button', { name: 'Morgan Reed' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(picker).getByRole('button', { name: 'Jordan Bell' }).getAttribute('aria-pressed')).toBe('true');

    await user.click(within(picker).getByRole('button', { name: 'Done' }));
    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: /^Choose people/ }));
    const selectedPeople = within(editor).getByRole('button', {
      name: 'Choose people, Avery Brooks, Morgan Reed and Jordan Bell'
    });
    expect(within(selectedPeople).getAllByRole('img').map(badge => badge.getAttribute('aria-label'))).toEqual([
      'Avery Brooks',
      'Morgan Reed',
      'Jordan Bell'
    ]);
    expect(within(selectedPeople).queryByRole('button')).toBeNull();
    expect(within(selectedPeople).getByRole('img', { name: 'Morgan Reed' }).querySelector('.person-badge-avatar'))
      .toBeTruthy();

    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(onSave.mock.calls[0]?.[0].personIds).toEqual([
      'sample-person-morgan',
      'sample-person-avery',
      'sample-person-jordan'
    ]);
  });
});
