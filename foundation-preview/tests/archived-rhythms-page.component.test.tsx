import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArchivedRhythmsPage } from '../src/components/ArchivedRhythmsPage.tsx';
import { syntheticPeople, todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';

afterEach(cleanup);

const alex = {
  ...syntheticPeople[0]!,
  id: 'archived-alex',
  displayName: 'Alex Example'
};

const alexRhythm: RhythmPreview = {
  ...todayRhythms[0]!,
  id: 'archived-alex-rhythm',
  title: 'Archived Alex check-in',
  description: 'A linked archived practice',
  personIds: [alex.id],
  categoryIds: ['faith'],
  schedule: { frequency: 'daily' },
  timeOfDay: 'morning'
};

const quietRhythm: RhythmPreview = {
  ...todayRhythms[0]!,
  id: 'archived-quiet-rhythm',
  title: 'Archived Quiet reflection',
  description: 'Intentionally unassociated',
  personIds: [],
  categoryIds: ['faith'],
  schedule: { frequency: 'weekly', weekdays: [1] },
  timeOfDay: 'anytime'
};

function renderPage(overrides: Partial<Parameters<typeof ArchivedRhythmsPage>[0]> = {}) {
  return render(
    <ArchivedRhythmsPage
      rhythms={[alexRhythm, quietRhythm]}
      archivedRhythmIds={[alexRhythm.id, quietRhythm.id]}
      completedRhythmIds={new Set()}
      rhythmScores={new Map()}
      people={[alex]}
      peopleGroups={[]}
      foundations={[]}
      onRhythmHistory={vi.fn()}
      onPersonSelect={vi.fn()}
      onOpenCategory={vi.fn()}
      onOpenFoundation={vi.fn()}
      onEditRhythm={vi.fn()}
      onRestoreRhythm={vi.fn()}
      {...overrides}
    />
  );
}

describe('Archived Rhythms settings page', () => {
  it('shows only archived account Rhythms, with fixed Type, realtime search, filters, and restore', async () => {
    const user = userEvent.setup();
    const onRestoreRhythm = vi.fn();
    const onEditRhythm = vi.fn();
    renderPage({ onRestoreRhythm, onEditRhythm });

    expect((screen.getByRole('button', { name: 'Type: Rhythms' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    const quietCard = screen.getByRole('article', { name: quietRhythm.title });
    const alexCard = screen.getByRole('article', { name: alexRhythm.title });
    expect(within(quietCard).queryByRole('group', {
      name: `People associated with ${quietRhythm.title}`
    })).toBeNull();
    expect(within(alexCard).queryByRole('button', { name: /^Tend/ })).toBeNull();
    expect(within(alexCard).getByRole('group', {
      name: `People associated with ${alexRhythm.title}`
    })).toBeTruthy();

    const search = screen.getByRole('searchbox', { name: 'Search titles and details' });
    await user.type(search, 'Quiet');
    expect(screen.queryByRole('article', { name: alexRhythm.title })).toBeNull();
    expect(screen.getByRole('article', { name: quietRhythm.title })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    await user.click(screen.getByRole('button', { name: 'Person: All people' }));
    await user.click(screen.getByRole('checkbox', { name: 'Alex Example' }));
    expect(screen.queryByRole('article', { name: quietRhythm.title })).toBeNull();
    expect(screen.getByRole('article', { name: alexRhythm.title })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.click(screen.getByRole('button', { name: `Edit ${alexRhythm.title}` }));
    expect(onEditRhythm).toHaveBeenCalledWith(alexRhythm, expect.anything());
    await user.click(screen.getByRole('button', { name: `Restore rhythm ${alexRhythm.title}` }));
    expect(onRestoreRhythm).toHaveBeenCalledWith(alexRhythm.id);
  });

  it('removes restored items and preserves the remaining search/filter state', () => {
    const view = renderPage();
    const search = screen.getByRole('searchbox', { name: 'Search titles and details' });
    fireEvent.change(search, { target: { value: 'Quiet' } });
    expect(screen.getByRole('article', { name: quietRhythm.title })).toBeTruthy();

    view.rerender(
      <ArchivedRhythmsPage
        rhythms={[alexRhythm, quietRhythm]}
        archivedRhythmIds={[quietRhythm.id]}
        completedRhythmIds={new Set()}
        rhythmScores={new Map()}
        people={[alex]}
        peopleGroups={[]}
        foundations={[]}
        onRhythmHistory={vi.fn()}
        onPersonSelect={vi.fn()}
        onOpenCategory={vi.fn()}
        onOpenFoundation={vi.fn()}
        onEditRhythm={vi.fn()}
        onRestoreRhythm={vi.fn()}
      />
    );
    expect((screen.getByRole('searchbox', { name: 'Search titles and details' }) as HTMLInputElement).value)
      .toBe('Quiet');
    expect(screen.getByRole('article', { name: quietRhythm.title })).toBeTruthy();
  });
});
