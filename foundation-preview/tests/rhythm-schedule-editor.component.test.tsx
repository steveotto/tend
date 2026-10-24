import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RhythmEditor } from '../src/components/RhythmEditor.tsx';
import { todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmDraft } from '../src/domain/rhythm-editor.ts';
import { saveRhythmDraft, validateRhythmDraft } from '../src/domain/rhythm-editor.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';

afterEach(cleanup);

function renderEditor(onSave = vi.fn((_draft: RhythmDraft) => ({}))) {
  render(<RhythmEditor onSave={onSave} onClose={vi.fn()} />);
  return screen.getByRole('dialog', { name: 'Add Rhythm' });
}

async function choose(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const trigger = screen.getByRole('combobox', { name: new RegExp(`^${escapedLabel}:`) });
  await user.click(trigger);
  await user.click(screen.getByRole('option', { name: option }));
  return trigger;
}

describe('shared structured Rhythm editor', () => {
  it('requires confirmation for a suggested tracking start date', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      schedule: { frequency: 'daily' }
    };
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    render(
      <RhythmEditor
        rhythm={rhythm}
        suggestedTrackingStartDate="2026-10-20"
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    const editor = screen.getByRole('dialog', { name: 'Edit Rhythm' });
    expect(within(editor).getByText(/First recorded completion: 2026-10-20/)).toBeTruthy();
    expect((within(editor).getByLabelText('Tracking start date') as HTMLInputElement).value).toBe('2026-10-20');
    expect(onSave).not.toHaveBeenCalled();

    await user.click(within(editor).getByRole('button', { name: 'Confirm tracking start' }));
    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      trackingStartConfirmed: true,
      trackingStartDate: '2026-10-20',
      scoringTimeZone: expect.any(String)
    }));
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
      'Daily',
      'Weekly',
      'Select Days',
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

  it('supports each Custom unit, interval, local start/end dates, and its applicable pattern controls', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    const editor = renderEditor(onSave);

    await choose(user, 'Frequency', 'Custom');
    expect(within(editor).queryByLabelText('Ending on')).toBeNull();
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
    fireEvent.change(within(editor).getByLabelText('Ending on'), { target: { value: '2026-12-31' } });
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

    expect(within(editor).getByRole('combobox', { name: 'Repeat on: A day of the week' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Which week?: First' })).toBeTruthy();
    expect((within(editor).getByRole('checkbox', { name: 'Personal' }) as HTMLInputElement).checked).toBe(true);
    expect(within(editor).getByLabelText('Ending on')).toBeTruthy();
    expect(within(editor).getByRole('button', { name: 'Archive Existing schedule' })).toBeTruthy();

    await choose(user, 'Frequency', 'Yearly');
    expect(within(editor).getByRole('combobox', { name: 'Month: January' })).toBeTruthy();
    expect(within(editor).getByRole('combobox', { name: 'Repeat on: A day of the week' })).toBeTruthy();
    expect(within(editor).getByRole('button', { name: 'Save Rhythm' })).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
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
    expect(within(editor).getByRole('group', { name: 'Which days?' })).toBeTruthy();
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
    fireEvent.change(within(editor).getByLabelText('Ending on'), { target: { value: '2026-10-04' } });
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
    expect(document.activeElement?.textContent).toBe('Custom');
    await user.keyboard('{Home}');
    expect(document.activeElement?.textContent).toBe('Daily');
    await user.keyboard('{End}');
    expect(document.activeElement?.textContent).toBe('Custom');
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement?.textContent).toBe('Daily');
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(frequency);
    await user.keyboard('{Enter}');
    expect(within(editor).getByRole('option', { name: 'Daily' }).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('w');
    expect(document.activeElement?.textContent).toBe('Weekly');
    await user.keyboard('{Enter}');
    expect(within(editor).getByRole('combobox', { name: 'Frequency: Weekly' }).getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(frequency);
    expect(within(editor).getByRole('checkbox', { name: 'Monday' })).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Add Rhythm' }));
    expect(within(editor).getByText('Complete the schedule details before saving.')).toBeTruthy();

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

  it('keeps editing cancellable without saving and exposes the independent Personal flag', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    const onClose = vi.fn();
    render(<RhythmEditor onSave={onSave} onClose={onClose} />);
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });

    expect((within(editor).getByRole('checkbox', { name: 'Personal' }) as HTMLInputElement).checked).toBe(false);
    await user.click(within(editor).getByRole('checkbox', { name: 'Personal' }));
    expect(within(editor).getByText('Synthetic preview only. Schedules are stored and displayed, but do not calculate due dates or control completion eligibility.')).toBeTruthy();
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('applies category picker changes only on Done and restores focus to its opener', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_draft: RhythmDraft) => ({}));
    const onClose = vi.fn();
    render(<RhythmEditor onSave={onSave} onClose={onClose} />);
    const editor = screen.getByRole('dialog', { name: 'Add Rhythm' });
    fireEvent.change(within(editor).getByLabelText('Title'), { target: { value: 'Kept title' } });

    await user.click(within(editor).getByRole('button', { name: 'Add categories' }));
    const marriage = within(editor).getByRole('button', { name: 'Marriage' });
    expect(marriage.getAttribute('aria-pressed')).toBe('false');
    await user.click(marriage);
    expect(marriage.getAttribute('aria-pressed')).toBe('true');
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));

    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: 'Add categories' }));
    expect(within(editor).queryByText(/^\d+ selected$/)).toBeNull();
    expect((within(editor).getByLabelText('Title') as HTMLInputElement).value).toBe('Kept title');

    await user.click(within(editor).getByRole('button', { name: 'Add categories' }));
    await user.click(within(editor).getByRole('button', { name: 'Marriage' }));
    await user.click(within(editor).getByRole('button', { name: 'Done' }));
    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: 'Add categories' }));
    expect(within(editor).getByRole('group', { name: 'Category associations' }).textContent).toContain('Marriage');

    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
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
    await user.click(within(editor).getByRole('button', { name: 'Add people' }));
    expect(within(editor).getByRole('button', { name: 'Morgan Reed' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(editor).getByRole('button', { name: 'Select Marriage people' }));
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: 'Add people' }));
    await user.click(within(editor).getByRole('button', { name: 'Add people' }));
    expect(within(editor).getByRole('button', { name: 'Morgan Reed' }).getAttribute('aria-pressed')).toBe('true');

    const marriage = within(editor).getByRole('button', { name: 'Select Marriage people' });
    expect(marriage.getAttribute('aria-pressed')).toBe('false');
    await user.click(marriage);
    expect(marriage.getAttribute('aria-pressed')).toBe('true');
    expect(within(editor).getByRole('button', { name: 'Avery Brooks' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(editor).getByRole('button', { name: 'Jordan Bell' }).getAttribute('aria-pressed')).toBe('false');
    await user.click(within(editor).getByRole('button', { name: 'Select Parenting people' }));
    expect(within(editor).getByRole('button', { name: 'Avery Brooks' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(editor).getByRole('button', { name: 'Morgan Reed' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(editor).getByRole('button', { name: 'Jordan Bell' }).getAttribute('aria-pressed')).toBe('true');

    await user.click(within(editor).getByRole('button', { name: 'Done' }));
    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: 'Add people' }));
    expect(within(editor).getByRole('group', { name: 'People associations' }).textContent).toContain('Morgan');
    expect(within(editor).getByRole('group', { name: 'People associations' }).textContent).toContain('Jordan');
    expect(within(editor).getByRole('group', { name: 'People associations' }).textContent).not.toContain('Reed');

    await user.click(within(editor).getByRole('button', { name: 'Save Rhythm' }));
    expect(onSave.mock.calls[0]?.[0].personIds).toEqual([
      'sample-person-morgan',
      'sample-person-avery',
      'sample-person-jordan'
    ]);
  });
});
