import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MouseEvent } from 'react';
import { FocusDialog } from '../src/components/FocusDialog.tsx';
import { RhythmDetailsDialog } from '../src/components/RhythmDetailsDialog.tsx';
import type { FocusBlock, FocusData } from '../src/domain/focus.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';
import type { Destination } from '../src/components/AppNavigation.tsx';

afterEach(cleanup);

function block(overrides: Partial<FocusBlock> = {}): FocusBlock {
  return {
    id: 'morning',
    name: 'Custom morning block with a long label',
    localDate: '2026-11-22',
    startsAt: Date.parse('2026-11-22T09:00:00Z'),
    endsAt: Date.parse('2026-11-22T11:30:00Z'),
    rangeLabel: '9:00am–11:30am',
    dateLabel: null,
    rhythms: [],
    calendarEvents: [],
    ...overrides
  };
}

function focusData(overrides: Partial<FocusData> = {}): FocusData {
  return {
    blocks: [
      block(),
      block({
        id: 'lunch',
        name: 'Lunch',
        startsAt: Date.parse('2026-11-22T11:30:00Z'),
        endsAt: Date.parse('2026-11-22T13:30:00Z'),
        rangeLabel: '11:30am–1:30pm',
        rhythms: []
      }),
      block({
        id: 'afternoon',
        name: 'Afternoon',
        startsAt: Date.parse('2026-11-22T13:30:00Z'),
        endsAt: Date.parse('2026-11-22T16:30:00Z'),
        rangeLabel: '1:30pm–4:30pm',
        rhythms: []
      })
    ],
    people: [],
    ...overrides
  };
}

const rhythm: RhythmPreview = {
  id: 'rhythm-morning',
  title: 'Morning walk',
  automation: 'manual',
  status: 'Due today',
  personIds: ['person-a'],
  schedule: { frequency: 'daily' },
  timeOfDay: 'morning'
};

function renderFocus(
  data: FocusData,
  handlers: Partial<{
    onClose: () => void;
    onPersonSelect: (id: string) => void;
    onOpenFoundation: (id: string, openerId: string) => void;
    onOpenCategory: (id: Destination, openerId: string) => void;
    onRhythmHistory: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
    onEditRhythm: (value: RhythmPreview, event: MouseEvent<HTMLButtonElement>) => void;
    onTendRhythm: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
    onUndoRhythm: (id: string) => void;
  }> = {},
  extra: Partial<{
    rhythms: readonly RhythmPreview[];
    undoableRhythmIds: ReadonlySet<string>;
  }> = {}
) {
  return render(
    <FocusDialog
      data={data}
      people={[
        { id: 'person-a', displayName: 'Avery' },
        { id: 'person-b', displayName: 'Morgan' }
      ]}
      rhythms={extra.rhythms ?? [rhythm]}
      foundations={[]}
      rhythmScores={new Map()}
      categoryHealthScores={new Map()}
      undoableRhythmIds={extra.undoableRhythmIds ?? new Set()}
      todayDate="2026-11-22"
      timeZone="UTC"
      onClose={handlers.onClose ?? (() => undefined)}
      onPersonSelect={handlers.onPersonSelect ?? (() => undefined)}
      onOpenFoundation={handlers.onOpenFoundation ?? (() => undefined)}
      onOpenCategory={handlers.onOpenCategory ?? (() => undefined)}
      onRhythmHistory={handlers.onRhythmHistory ?? (() => undefined)}
      onEditRhythm={handlers.onEditRhythm ?? (() => undefined)}
      onTendRhythm={handlers.onTendRhythm ?? (() => undefined)}
      onUndoRhythm={handlers.onUndoRhythm ?? (() => undefined)}
    />
  );
}

describe('Focus dialog', () => {
  it('renders the three-block horizon and compact people cards with profile navigation', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onPersonSelect = vi.fn();
    const onTendRhythm = vi.fn();
    const data = focusData({
      blocks: [
        block({
          rhythms: [{
            rhythmId: rhythm.id,
            personIds: ['person-a'],
            time: Date.parse('2026-11-22T10:15:00Z'),
            healthScore: 44,
            completed: false
          }]
        }),
        block({
          id: 'lunch',
          name: 'Lunch',
          startsAt: Date.parse('2026-11-22T11:30:00Z'),
          endsAt: Date.parse('2026-11-22T13:30:00Z'),
          rangeLabel: '11:30am–1:30pm'
        }),
        block({
          id: 'afternoon',
          name: 'Afternoon',
          startsAt: Date.parse('2026-11-22T13:30:00Z'),
          endsAt: Date.parse('2026-11-22T16:30:00Z'),
          rangeLabel: '1:30pm–4:30pm'
        })
      ],
      people: [{
        personId: 'person-a',
        score: 19.375,
        recencyLabel: 'No connection logged'
      }]
    });

    renderFocus(data, { onClose, onPersonSelect, onTendRhythm });

    const dialog = screen.getByRole('dialog', { name: 'Focus' });
    expect(within(dialog).getByRole('heading', { name: 'Now' })).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: 'Coming up' })).toBeTruthy();
    expect(within(dialog).getByText('Now and the next two blocks. Anytime Rhythms stay on Today.')).toBeTruthy();
    expect(within(dialog.querySelector('.focus-head')!).queryByText(
      'Now and the next two blocks. Anytime Rhythms stay on Today.'
    )).toBeNull();
    expect(within(dialog).getByText('Custom morning block with a long label')).toBeTruthy();
    expect(within(dialog).getByText('11:30am–1:30pm')).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: 'People who need attention' })).toBeTruthy();
    expect(within(dialog).getByText('No connection logged')).toBeTruthy();
    expect(within(dialog).getByRole('img', { name: 'Person Health 19 out of 100' })).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Tend Morning walk' }));
    expect(onTendRhythm).toHaveBeenCalledWith(rhythm.id, expect.objectContaining({ type: 'click' }));

    await user.click(within(dialog).getByRole('button', {
      name: /Open Avery profile, Person Health 19, No connection logged/
    }));
    expect(onPersonSelect).toHaveBeenCalledWith('person-a');

    await user.click(within(dialog).getByRole('button', { name: 'Close Focus' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps completed rows expandable and routes Undo through the shared Rhythm action', async () => {
    const user = userEvent.setup();
    const onUndoRhythm = vi.fn();
    renderFocus(
      focusData({
        blocks: [
          block({
            rhythms: [{
              rhythmId: rhythm.id,
              personIds: ['person-a'],
              time: Date.parse('2026-11-22T10:15:00Z'),
              healthScore: null,
              completed: true
            }]
          }),
          block({ id: 'lunch', name: 'Lunch' }),
          block({ id: 'afternoon', name: 'Afternoon' })
        ]
      }),
      { onUndoRhythm },
      { undoableRhythmIds: new Set([rhythm.id]) }
    );

    const row = screen.getByRole('button', { name: /Morning walk, Tended today/ });
    await user.click(row);
    await user.click(screen.getByRole('button', { name: 'Undo completion for Morning walk' }));
    expect(onUndoRhythm).toHaveBeenCalledWith(rhythm.id);
  });

  it('preserves shared schedule and last-tended metadata without an Overdue section', () => {
    const eveningRhythm: RhythmPreview = {
      id: 'daily-connection',
      title: 'Daily connection',
      automation: 'manual',
      status: 'Due today',
      timeLabel: 'Evening',
      schedule: { frequency: 'daily' },
      completionHistory: [{ id: 'dated-completion', effectiveDate: '2020-10-20' }]
    };
    const neverTendedRhythm: RhythmPreview = {
      ...eveningRhythm,
      id: 'never-tended-evening',
      title: 'Evening question',
      completionHistory: []
    };
    const rhythms = [eveningRhythm, neverTendedRhythm];
    renderFocus(
      focusData({
        blocks: [
          block({
            id: 'early-morning',
            name: 'Early morning',
            rhythms: rhythms.map(rhythmItem => ({
              rhythmId: rhythmItem.id,
              personIds: [],
              time: Date.parse('2026-11-22T06:55:00Z'),
              healthScore: null,
              completed: false
            }))
          }),
          block({ id: 'morning', name: 'Morning' }),
          block({ id: 'lunch', name: 'Lunch' })
        ]
      }),
      {},
      { rhythms }
    );

    const readMetadata = (root: ParentNode) => {
      const footer = root.querySelector('.today-rhythm-details__footer');
      if (!footer) throw new Error('Expected the shared Rhythm metadata footer.');
      return {
        schedule: footer.querySelector('.rhythm-metadata-schedule-group')?.textContent?.trim(),
        lastTended: footer.querySelector('.rhythm-metadata-status')?.textContent?.trim(),
        calendarIcon: footer.querySelector('.rhythm-metadata-status-group svg')?.outerHTML
      };
    };

    for (const [item, expectedLastTended] of [
      [eveningRhythm, 'Oct 20, 2020'],
      [neverTendedRhythm, 'Not yet']
    ] as const) {
      const focusCard = screen.getByRole('article', { name: item.title });
      expect(focusCard.closest('.focus-horizon')).toBeTruthy();

      const normalCard = render(
        <RhythmDetailsDialog rhythm={item} inline onClose={() => undefined} />
      );
      expect(readMetadata(focusCard)).toEqual(readMetadata(normalCard.container));
      expect(readMetadata(focusCard).schedule).toContain('Evening');
      expect(readMetadata(focusCard).lastTended).toBe(expectedLastTended);
      normalCard.unmount();
    }

    expect(screen.queryByRole('heading', { name: 'Overdue' })).toBeNull();
    expect(eveningRhythm.timeOfDay).toBeUndefined();
    expect(eveningRhythm.timeLabel).toBe('Evening');
  });

  it('keeps guided activity actions available through the shared Focus Rhythm card', async () => {
    const user = userEvent.setup();
    const onTendRhythm = vi.fn();
    const stretchRhythm: RhythmPreview = {
      ...rhythm,
      id: 'guided-stretch',
      title: 'Daily stretches',
      healthLogCapability: 'flexibility',
      categoryIds: ['health'],
      timeOfDay: 'evening'
    };
    renderFocus(
      focusData({
        blocks: [
          block({
            rhythms: [{
              rhythmId: stretchRhythm.id,
              personIds: [],
              time: Date.parse('2026-11-22T10:15:00Z'),
              healthScore: 40,
              completed: false
            }]
          }),
          block({ id: 'lunch', name: 'Lunch' }),
          block({ id: 'afternoon', name: 'Afternoon' })
        ]
      }),
      { onTendRhythm },
      { rhythms: [stretchRhythm] }
    );

    await user.click(screen.getByRole('button', { name: 'Start stretch routine Daily stretches' }));
    expect(onTendRhythm).toHaveBeenCalledWith(
      stretchRhythm.id,
      expect.objectContaining({ type: 'click' })
    );
  });

  it('closes on Escape from Focus but leaves a nested dialog to handle its own Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderFocus(focusData(), { onClose });
    const dialog = screen.getByRole('dialog', { name: 'Focus' });

    const nestedDialog = document.createElement('dialog');
    nestedDialog.open = true;
    const nestedButton = document.createElement('button');
    nestedButton.textContent = 'Nested dialog action';
    nestedDialog.append(nestedButton);
    dialog.append(nestedDialog);
    nestedButton.focus();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();

    screen.getByRole('heading', { name: 'Focus' }).focus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
