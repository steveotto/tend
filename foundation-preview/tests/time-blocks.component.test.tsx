import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeBlocksSettings } from '../src/components/TimeBlocksSettings.tsx';
import {
  currentTimeBlock,
  createDefaultTimeBlockSettings,
  rhythmTimeOptionsForBlocks,
  sleepTimeBlockRange,
  timeBlockRange,
  type TimeBlockSettings
} from '../src/domain/time-blocks.ts';

afterEach(cleanup);

describe('TimeBlocksSettings', () => {
  it('adds, renames, orders, shows automatic ends, and retains a failed-save draft until Cancel', async () => {
    const user = userEvent.setup();
    const settings = createDefaultTimeBlockSettings();
    const onSave = vi.fn((_settings: TimeBlockSettings) => 'Preview storage is unavailable.');
    render(
      <TimeBlocksSettings
        settings={settings}
        assignedBlockIds={new Set()}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Add time block' }));
    const added = screen.getByRole('region', { name: 'New time block time block' });
    expect((within(added).getByLabelText('Starts') as HTMLInputElement).value).toBe('06:00');
    expect(screen.getAllByRole('region', { name: /time block$/i })[1]?.getAttribute('aria-label'))
      .toBe('New time block time block');

    const early = screen.getByRole('region', { name: 'Early morning time block' });
    await user.clear(within(early).getByLabelText('Block name'));
    await user.type(within(early).getByLabelText('Block name'), 'Dawn');
    fireEvent.change(within(early).getByLabelText('Starts'), { target: { value: '06:30' } });
    expect(within(early).getByText('Ends').parentElement?.querySelector('output')?.textContent).toBe('9:00am');
    await user.click(screen.getByRole('button', { name: 'Save time blocks' }));

    expect(onSave).toHaveBeenCalledOnce();
    const saved = onSave.mock.calls[0]![0] as TimeBlockSettings;
    expect(saved.blocks.slice(0, 3).map(block => [block.name, block.start])).toEqual([
      ['New time block', '06:00'],
      ['Dawn', '06:30'],
      ['Morning', '09:00']
    ]);
    expect(screen.getByRole('alert').textContent).toContain('Preview storage is unavailable.');
    expect((within(screen.getByRole('region', { name: 'Dawn time block' }))
      .getByLabelText('Block name') as HTMLInputElement).value).toBe('Dawn');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('region', { name: 'Early morning time block' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Dawn time block' })).toBeNull();
  });

  it('prevents deleting assigned blocks and rejects duplicate starts without saving', async () => {
    const user = userEvent.setup();
    const settings = createDefaultTimeBlockSettings();
    const onSave = vi.fn((_settings: TimeBlockSettings) => null);
    render(
      <TimeBlocksSettings
        settings={settings}
        assignedBlockIds={new Set(['early-morning'])}
        onSave={onSave}
      />
    );

    const assigned = within(screen.getByLabelText('Visible time blocks'))
      .getByRole('region', { name: 'Early morning time block' });
    const deleteButton = within(assigned).getByRole('button', { name: 'Delete Early morning' });
    expect((deleteButton as HTMLButtonElement).disabled).toBe(true);
    expect(within(assigned).getByText(/current or historical Rhythm schedule/)).toBeTruthy();

    const lunch = screen.getByRole('region', { name: 'Lunch time block' });
    fireEvent.change(within(lunch).getByLabelText('Starts'), { target: { value: '09:00' } });
    await user.click(screen.getByRole('button', { name: 'Save time blocks' }));
    expect(screen.getByRole('alert').textContent).toContain('chronologically with distinct start times');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('deletes an unassigned block while retaining all assigned block identities', async () => {
    const user = userEvent.setup();
    const settings = createDefaultTimeBlockSettings();
    const onSave = vi.fn((_settings: TimeBlockSettings) => null);
    render(
      <TimeBlocksSettings
        settings={settings}
        assignedBlockIds={new Set(['early-morning'])}
        onSave={onSave}
      />
    );

    await user.click(within(screen.getByRole('region', { name: 'Lunch time block' }))
      .getByRole('button', { name: 'Delete Lunch' }));
    expect(screen.queryByRole('region', { name: 'Lunch time block' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save time blocks' }));
    expect(onSave.mock.calls[0]?.[0].blocks.map(block => block.id)).toEqual([
      'early-morning',
      'morning',
      'afternoon',
      'way-home',
      'evening',
      'bedtime'
    ]);
  });
});

describe('time-block domain contracts', () => {
  it('keeps visible options separate from the hidden overnight Sleep boundary', () => {
    const settings = createDefaultTimeBlockSettings();
    expect(timeBlockRange(settings, 'bedtime')).toBe('9:30pm – 10:00pm');
    expect(sleepTimeBlockRange(settings)).toBe('10:00pm – 5:30am (next day)');
    expect(rhythmTimeOptionsForBlocks(settings).map(option => option.label)).not.toContain('Sleep');
    expect(currentTimeBlock(new Date(2026, 9, 21, 5, 29), settings)).toBeNull();
    expect(currentTimeBlock(new Date(2026, 9, 21, 5, 30), settings)?.id).toBe('early-morning');
    expect(currentTimeBlock(new Date(2026, 9, 21, 22, 0), settings)).toBeNull();
  });
});
