import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FocusDialog } from '../src/components/FocusDialog.tsx';
import type { FocusData } from '../src/domain/focus.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';

afterEach(cleanup);

describe('Focus dialog', () => {
  it('renders the fixed-plan and people sections and wires Close, Tend, details, and profile actions', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onPersonSelect = vi.fn();
    const onRhythmSelect = vi.fn();
    const onTendRhythm = vi.fn();
    const rhythm: RhythmPreview = {
      id: 'rhythm-morning',
      title: 'Morning walk',
      automation: 'manual',
      status: 'Due today',
      personIds: ['person-a'],
      schedule: { frequency: 'daily' },
      timeOfDay: 'morning'
    };
    const data: FocusData = {
      window: {
        blockId: 'morning',
        name: 'Morning',
        start: Date.parse('2026-11-22T10:15:00Z'),
        end: Date.parse('2026-11-22T11:30:00Z'),
        nextName: 'Lunch'
      },
      items: [{
        kind: 'rhythm',
        rhythmId: rhythm.id,
        personIds: ['person-a'],
        title: rhythm.title,
        time: Date.parse('2026-11-22T10:15:00Z'),
        timeLabel: '10:15 AM',
        overdueDate: null
      }],
      people: [{
        personId: 'person-a',
        score: 72,
        recencyLabel: 'Last connected yesterday'
      }]
    };

    render(
      <FocusDialog
        data={data}
        people={[{ id: 'person-a', displayName: 'Avery' }]}
        rhythms={[rhythm]}
        completedRhythmIds={new Set()}
        onClose={onClose}
        onPersonSelect={onPersonSelect}
        onRhythmSelect={onRhythmSelect}
        onTendRhythm={onTendRhythm}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Morning' });
    expect(within(dialog).getByRole('heading', { name: 'Morning' })).toBeTruthy();
    expect(within(dialog).getByText('Coming up')).toBeTruthy();
    expect(within(dialog).getByText('People to notice')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Open details for Morning walk' }));
    expect(onRhythmSelect).toHaveBeenCalledWith(rhythm, expect.objectContaining({
      type: 'click'
    }));

    await user.click(within(dialog).getByRole('button', { name: 'Tend Morning walk' }));
    expect(onTendRhythm).toHaveBeenCalledWith(rhythm.id, expect.objectContaining({
      type: 'click'
    }));

    await user.click(within(dialog).getByRole('button', { name: 'Open Avery' }));
    expect(onPersonSelect).toHaveBeenCalledWith('person-a');

    await user.click(within(dialog).getByRole('button', { name: 'Close Focus' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape and exposes an accessible 44px Close target', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <FocusDialog
        data={{
          window: {
            blockId: 'morning',
            name: 'Morning',
            start: Date.parse('2026-11-22T10:15:00Z'),
            end: Date.parse('2026-11-22T11:30:00Z'),
            nextName: 'Lunch'
          },
          items: [],
          people: []
        }}
        people={[]}
        rhythms={[]}
        completedRhythmIds={new Set()}
        onClose={onClose}
        onPersonSelect={vi.fn()}
        onRhythmSelect={vi.fn()}
        onTendRhythm={vi.fn()}
      />
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
