import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogApp } from '../src/CatalogApp.tsx';
import { CategoryHealthBadge, FoundationCard, FoundationProgress, GoalCard, RhythmCard, ScoreMeter } from '../src/components/Cards.tsx';
import { MarriageIcon } from '../src/components/MarriageIcon.tsx';
import { PersonBadgeList } from '../src/components/PersonBadge.tsx';
import { RhythmDetailsDialog } from '../src/components/RhythmDetailsDialog.tsx';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';
import {
  financeFoundation,
  goals,
  marriageExampleFixtures,
  marriageFoundation,
  marriageFoundations,
  marriageRhythms,
  rhythms,
  syntheticPeople,
  todayRhythms
} from '../src/domain/preview-data.ts';

afterEach(cleanup);

describe('shared preview components', () => {
  it('renders accessible multi-person badges with initials fallback and stable identity', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const people = [
      ...syntheticPeople.slice(0, 2),
      { ...syntheticPeople[2]!, displayName: 'JordanWithAnExceptionallyLongFirstName Bell' }
    ];
    render(<PersonBadgeList people={people} rhythmTitle="A shared Rhythm" onSelect={onSelect} />);

    const group = screen.getByRole('group', { name: 'People associated with A shared Rhythm' });
    const badges = within(group).getAllByRole('button');
    expect(badges).toHaveLength(3);
    expect(badges.map(badge => badge.querySelector('.person-badge-name')?.textContent)).toEqual([
      'Avery',
      'Morgan',
      'JordanWithAnExceptionallyLongFirstName'
    ]);
    expect(badges[0]?.getAttribute('data-person-id')).toBe('sample-person-avery');
    expect(badges[0]?.getAttribute('aria-label')).toBe('Open synthetic profile for Avery Brooks');
    expect(badges[0]?.querySelector('.person-badge-avatar')?.textContent).toBe('AB');
    expect(badges[2]?.textContent).toContain('JordanWithAnExceptionallyLongFirstName');
    expect(badges[2]?.textContent).not.toContain('Bell');

    badges[1]!.focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('sample-person-morgan');
  });

  it('keeps person navigation independent from Info and Tend actions', async () => {
    const user = userEvent.setup();
    const onPersonSelect = vi.fn();
    const onDetails = vi.fn();
    const onTend = vi.fn();
    render(
      <RhythmCard
        rhythm={todayRhythms[0]!}
        variant="simple"
        people={syntheticPeople.slice(0, 2)}
        onPersonSelect={onPersonSelect}
        onDetails={onDetails}
        onTend={onTend}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open synthetic profile for Avery Brooks' }));
    expect(onPersonSelect).toHaveBeenCalledExactlyOnceWith('sample-person-avery');
    expect(onDetails).not.toHaveBeenCalled();
    expect(onTend).not.toHaveBeenCalled();

    const info = screen.getByRole('button', { name: 'Details for Pray together' });
    info.focus();
    await user.keyboard('{Enter}');
    expect(onDetails).toHaveBeenCalledOnce();
    expect(onTend).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Tend Pray together' }));
    expect(onTend).toHaveBeenCalledOnce();
    expect(onPersonSelect).toHaveBeenCalledOnce();
  });

  it('prevents duplicate direct completion and shows the completed action state', async () => {
    const user = userEvent.setup();
    const onTend = vi.fn();
    const onUndo = vi.fn();
    const props = {
      rhythm: todayRhythms[0]!,
      variant: 'simple' as const,
      onDetails: () => undefined,
      onTend,
      onUndo
    };
    const { rerender } = render(<RhythmCard {...props} />);
    const tend = screen.getByRole('button', { name: 'Tend Pray together' });
    expect(screen.queryByRole('button', { name: 'Undo completion for Pray together' })).toBeNull();
    expect(document.querySelector('.rhythm-metadata-undo-slot')).toBeNull();
    expect(screen.getByText('Due today').previousElementSibling?.tagName.toLowerCase()).toBe('svg');
    expect(tend.getAttribute('type')).toBe('button');
    await user.click(tend);
    expect(onTend).toHaveBeenCalledOnce();

    rerender(<RhythmCard {...props} completed />);
    const completed = screen.getByRole('button', { name: 'Tended Pray together' });
    expect(completed.matches(':disabled')).toBe(true);
    expect(screen.getByText('Pray together marked tended.').getAttribute('aria-live')).toBe('polite');
    expect(completed.querySelector('svg')).toBeNull();
    await user.click(completed);
    expect(onTend).toHaveBeenCalledOnce();

    const undo = screen.getByRole('button', { name: 'Undo completion for Pray together' });
    expect(undo.title).toBe('Undo completion for Pray together');
    expect(undo.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(undo.textContent).toBe('');
    const statusGroup = document.querySelector('.rhythm-card--simple > .rhythm-metadata-status-group');
    expect(statusGroup?.children[0]).toBe(undo);
    expect(statusGroup?.children[1]?.tagName.toLowerCase()).toBe('svg');
    expect(statusGroup?.children[2]?.textContent).toBe('Tended today');
    expect(screen.getByText('Tended today').previousElementSibling?.tagName.toLowerCase()).toBe('svg');
    undo.focus();
    await user.keyboard('{Enter}');
    expect(onUndo).toHaveBeenCalledOnce();
    rerender(<RhythmCard {...props} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tend Pray together' }));
  });

  it('routes catalogue person badges to the synthetic profile placeholder and back', async () => {
    const user = userEvent.setup();
    render(<CatalogApp />);
    const rhythm = screen.getByRole('article', { name: 'Monthly savings transfer' });
    const badge = within(rhythm).getByRole('button', { name: 'Open synthetic profile for Avery Brooks' });
    expect(badge.querySelector('.person-badge-name')?.textContent).toBe('Avery');
    await user.click(badge);
    expect(screen.getByRole('heading', { name: 'Avery Brooks' })).toBeTruthy();
    expect(screen.getByText(/does not connect to an account/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Back to Component catalogue' }));
    expect(screen.getByRole('heading', { name: 'Goals' })).toBeTruthy();
  });

  it('shows an ongoing Marriage foundation without a completion action', () => {
    render(<FoundationCard foundation={marriageFoundation} />);

    expect(screen.getByRole('heading', { name: 'Connection' })).toBeTruthy();
    expect(screen.getByText('Ongoing', { selector: '.lifecycle-badge' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /mark milestone complete/i })).toBeNull();
  });

  it('supports an explicit local lifecycle change for a completable Finance milestone', () => {
    const { rerender } = render(
      <FoundationCard foundation={financeFoundation} onComplete={() => undefined} />
    );

    expect(screen.getByText('In progress')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark milestone complete' })).toBeTruthy();
    rerender(
      <FoundationCard
        foundation={financeFoundation}
        lifecycle="completed"
        onReopen={() => undefined}
      />
    );
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reopen milestone' })).toBeTruthy();
  });

  it('uses the same goal-card structure for increasing savings and decreasing debt', () => {
    const { container } = render(
      <>
        {goals.map(goal => <GoalCard goal={goal} key={goal.id} />)}
      </>
    );

    expect(container.querySelectorAll('.goal-card')).toHaveLength(2);
    expect(screen.getByText(/Savings goal · USD/)).toBeTruthy();
    expect(screen.getByText(/Debt goal · USD/)).toBeTruthy();
    expect(screen.getByText('$1,250.00')).toBeTruthy();
    expect(screen.getByText('$6,800.00')).toBeTruthy();
    expect(screen.getByText(/Target balance · Dec 31, 2027/)).toBeTruthy();
  });

  it('keeps catalogue cards descriptive and simple cards composed from Info and optional Tend actions', () => {
    const rhythm = rhythms[0]!;
    const onDetails = vi.fn();
    const { rerender } = render(<RhythmCard rhythm={rhythm} />);
    const catalogueCard = screen.getByRole('article', { name: rhythm.title });
    expect(within(catalogueCard).getByRole('heading', { name: rhythm.title, level: 3 })).toBeTruthy();
    expect(within(catalogueCard).getByText(rhythm.description!)).toBeTruthy();
    expect(within(catalogueCard).getByText('Automated at bank')).toBeTruthy();
    expect(within(catalogueCard).getByText(/Not confirmed/, { selector: '.rhythm-cadence' })).toBeTruthy();
    expect(within(catalogueCard).queryByRole('button')).toBeNull();

    rerender(
      <RhythmCard
        rhythm={rhythm}
        variant="simple"
        onDetails={onDetails}
      />
    );
    const simpleCard = screen.getByRole('article', { name: rhythm.title });
    expect(within(simpleCard).getByRole('heading', { name: rhythm.title, level: 3 })).toBeTruthy();
    expect(within(simpleCard).queryByText(rhythm.description!)).toBeNull();
    expect(within(simpleCard).getByText('Not yet tended')).toBeTruthy();
    const detailsButton = within(simpleCard).getByRole('button', { name: 'Details for Monthly savings transfer' });
    expect(detailsButton).toBeTruthy();
    expect(detailsButton.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(detailsButton.querySelector('svg circle')).toBeNull();
    expect(detailsButton.querySelectorAll('svg path')).toHaveLength(2);
    expect(within(simpleCard).queryByRole('button', { name: /^Tend/ })).toBeNull();

    rerender(
      <RhythmCard
        rhythm={todayRhythms[0]!}
        variant="simple"
        completed
        onDetails={onDetails}
        onTend={() => undefined}
      />
    );
    expect(screen.getByText('Tended today')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tended Pray together' }).matches(':disabled')).toBe(true);
  });

  it('keeps optional details content absent without empty wrappers or no-op actions', () => {
    const rhythm = {
      id: 'optional-fields-rhythm',
      title: 'Optional fields example',
      cadence: 'Daily',
      timeLabel: 'Morning',
      automation: 'manual' as const,
      status: 'Due today' as const
    };
    render(<RhythmDetailsDialog rhythm={rhythm} onClose={() => undefined} />);

    const dialog = screen.getByRole('dialog', { name: rhythm.title });
    expect(within(dialog).queryByText(rhythm.title)).toBeTruthy();
    expect(within(dialog).queryByText(/quiet moment/)).toBeNull();
    expect(within(dialog).queryByRole('group', { name: /People associated/ })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /^Tend/ })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /^Undo/ })).toBeNull();
    expect(within(dialog).queryByRole('region', { name: /completion history/ })).toBeNull();
    expect(within(dialog).queryByText('Due today')).toBeTruthy();
    expect(within(dialog).getByText('Due today').previousElementSibling?.tagName.toLowerCase()).toBe('svg');
    const footer = dialog.querySelector('.rhythm-metadata-footer')!;
    const scheduleGroup = footer.querySelector('.rhythm-metadata-schedule-group')!;
    const statusGroup = footer.querySelector('.rhythm-metadata-last-tended')!;
    expect(footer.children).toHaveLength(2);
    expect(footer.firstElementChild).toBe(scheduleGroup);
    expect(footer.lastElementChild).toBe(statusGroup);
    expect(scheduleGroup.querySelectorAll(':scope > span')).toHaveLength(2);
    expect(scheduleGroup.textContent).toContain('Daily');
    expect(scheduleGroup.textContent).toContain('Morning');
    expect(statusGroup.textContent).toContain('Due today');
    expect(statusGroup.querySelector('.rhythm-metadata-status-group')?.children[0]?.tagName.toLowerCase())
      .toBe('svg');
  });

  it('shows structured next-due and due-today labels from the effective schedule', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T12:00:00.000Z'));
    try {
      const quarterly = {
        id: 'quarterly-next-due',
        title: 'Quarterly verify',
        cadence: 'Quarterly',
        automation: 'manual' as const,
        status: 'Due today' as const,
        schedule: {
          frequency: 'quarterly' as const,
          monthInQuarter: 1 as const,
          pattern: { kind: 'dayOfMonth' as const, day: 1 }
        },
        createdLocalDate: '2026-10-25',
        createdTimeZone: 'UTC',
        scoring: {
          trackingStartDate: '2026-10-25',
          timeZone: 'UTC',
          scheduleHistory: [createRhythmSeason('quarterly-next-due', '2026-10-25', {
              frequency: 'quarterly' as const,
              monthInQuarter: 1 as const,
              pattern: { kind: 'dayOfMonth' as const, day: 1 }
            })]
        }
      };
      const { rerender } = render(<RhythmDetailsDialog rhythm={quarterly} onClose={() => undefined} />);
      const footer = document.querySelector('.rhythm-metadata-footer') as HTMLElement;
      expect(within(footer).getByText('Next due Jan 1')).toBeTruthy();
      expect(within(footer).queryByText('Due today')).toBeNull();

      const dailySchedule = { frequency: 'daily' as const };
      rerender(
        <RhythmDetailsDialog
          rhythm={{
            ...quarterly,
            schedule: dailySchedule,
            scoring: {
              ...quarterly.scoring,
              scheduleHistory: [createRhythmSeason('quarterly-next-due', '2026-10-25', dailySchedule)]
            }
          }}
          onClose={() => undefined}
        />
      );
      expect(within(document.querySelector('.rhythm-metadata-footer') as HTMLElement).getByText('Due today')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps Undo directly before the right-aligned footer status group', () => {
    const rhythm = todayRhythms[0]!;
    render(
      <RhythmDetailsDialog
        rhythm={rhythm}
        completed
        onUndo={() => undefined}
        onClose={() => undefined}
      />
    );

    const footer = document.querySelector('.rhythm-metadata-footer')!;
    const statusCluster = footer.querySelector('.rhythm-metadata-status-cluster') as HTMLElement;
    const undo = within(statusCluster).getByRole('button', { name: `Undo completion for ${rhythm.title}` });
    const statusGroup = statusCluster.querySelector('.rhythm-metadata-status-group')!;
    expect(statusCluster.children[0]).toBe(undo);
    expect(statusCluster.children[1]).toBe(statusGroup);
    expect(statusGroup.querySelector('.rhythm-metadata-status')?.textContent).toBe('Tended today');
  });

  it('uses a compact structured footer label with accessible full details and the shared refresh icon', async () => {
    const user = userEvent.setup();
    const rhythm = {
      ...todayRhythms[0]!,
      cadence: 'Older descriptive cadence',
      schedule: {
        frequency: 'quarterly' as const,
        monthInQuarter: 2 as const,
        pattern: { kind: 'dayOfMonth' as const, day: 15 }
      },
      timeLabel: 'Afternoon'
    };
    render(<RhythmDetailsDialog rhythm={rhythm} onClose={() => undefined} />);

    const footer = document.querySelector('.rhythm-metadata-footer')!;
    const scheduleGroup = footer.querySelector('.rhythm-metadata-schedule-group')!;
    const scheduleLabel = scheduleGroup.querySelector('span > span')!;
    expect(scheduleLabel.textContent).toBe('Quarterly');
    const fullScheduleId = scheduleLabel.getAttribute('aria-describedby')!;
    expect(document.getElementById(fullScheduleId)?.textContent)
      .toBe('Full schedule: The 15th day of the second month of every quarter.');
    expect(scheduleGroup.textContent).toContain('Afternoon');
    const icon = scheduleGroup.querySelector('svg')!;
    expect(icon.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(icon.getAttribute('stroke-width')).toBe('1.8');
    expect(icon.querySelector('path')?.getAttribute('d')).toBe('M3 12a9 9 0 0 1 15.36-6.36L21 8');

    await user.click(screen.getByRole('button', { name: `View scores and history for ${rhythm.title}` }));
    const history = screen.getByRole('region', { name: `History for ${rhythm.title}` });
    expect(within(history).getByText('The 15th day of the second month of every quarter.')).toBeTruthy();
    expect(within(history).getByText('Afternoon')).toBeTruthy();
  });

  it('renders shared full details inline with complete action targets and no modal controls', async () => {
    const user = userEvent.setup();
    const onTend = vi.fn();
    const onHistory = vi.fn();
    const onEdit = vi.fn();
    const onUndo = vi.fn();
    render(
      <RhythmDetailsDialog
        rhythm={todayRhythms[0]!}
        inline
        headingId="today-sample-title"
        people={syntheticPeople.slice(0, 1)}
        onPersonSelect={() => undefined}
        onTend={onTend}
        onHistory={onHistory}
        onEdit={onEdit}
        onUndo={onUndo}
        onClose={() => undefined}
      />
    );

    const card = screen.getByRole('article', { name: todayRhythms[0]!.title });
    const header = card.querySelector('.today-rhythm-details__header');
    const actions = card.querySelector('.today-rhythm-details__actions');
    expect(within(card).getByRole('heading', { name: todayRhythms[0]!.title, level: 3 })).toBeTruthy();
    expect(actions?.parentElement).toBe(header);
    expect(card.querySelector('.today-rhythm-details__content')?.contains(actions)).toBe(false);
    expect(within(card).getByText(todayRhythms[0]!.description!)).toBeTruthy();
    expect(within(card).getByRole('group', { name: `Associations for ${todayRhythms[0]!.title}` })).toBeTruthy();
    expect(within(card).getByRole('button', { name: `Tend ${todayRhythms[0]!.title}` })).toBeTruthy();
    expect(within(card).getByRole('button', { name: `View scores and history for ${todayRhythms[0]!.title}` })).toBeTruthy();
    expect(within(card).getByRole('button', { name: `Edit ${todayRhythms[0]!.title}` })).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'Close details' })).toBeNull();
    expect(within(card).queryByRole('button', { name: /^Back/ })).toBeNull();

    await user.click(within(card).getByRole('button', { name: `Tend ${todayRhythms[0]!.title}` }));
    await user.click(within(card).getByRole('button', { name: `View scores and history for ${todayRhythms[0]!.title}` }));
    await user.click(within(card).getByRole('button', { name: `Edit ${todayRhythms[0]!.title}` }));
    expect(onTend).toHaveBeenCalledOnce();
    expect(onHistory).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('keeps the action column in the title row when description and associations are absent', () => {
    const rhythm = {
      id: 'sparse-layout-test',
      title: 'Simple Rhythm Test',
      cadence: 'Quarterly',
      automation: 'manual' as const,
      status: 'Due today' as const,
      schedule: {
        frequency: 'quarterly' as const,
        monthInQuarter: 1 as const,
        pattern: { kind: 'dayOfMonth' as const, day: 1 }
      }
    };
    render(
      <RhythmDetailsDialog
        rhythm={rhythm}
        inline
        onTend={() => undefined}
        onClose={() => undefined}
      />
    );

    const card = screen.getByRole('article', { name: rhythm.title });
    const header = card.querySelector('.today-rhythm-details__header');
    const actions = card.querySelector('.today-rhythm-details__actions');
    const body = card.querySelector('.today-rhythm-details__content');
    expect(actions?.parentElement).toBe(header);
    expect(within(card).getByRole('button', { name: `Tend ${rhythm.title}` })).toBeTruthy();
    expect(within(card).getByRole('button', { name: `View scores and history for ${rhythm.title}` })).toBeTruthy();
    expect(body?.querySelector('.today-rhythm-details__summary')).toBeNull();
    expect(body?.querySelector('.today-rhythm-details__association-row')).toBeNull();
  });

  it('wraps long inline copy, omits empty associations, and gives repeated cards unique heading IDs', () => {
    const rhythm = {
      id: 'inline-empty-example',
      title: 'An intentionally long Rhythm title that needs to wrap naturally without colliding with Edit',
      description: 'A deliberately long description that should wrap naturally in the shared inline presentation without horizontal overflow or a reserved association row.',
      automation: 'manual' as const,
      status: 'Due today' as const
    };
    render(
      <>
        <RhythmDetailsDialog rhythm={rhythm} inline onTend={() => undefined} onClose={() => undefined} />
        <RhythmDetailsDialog
          rhythm={{ ...rhythm, id: 'inline-empty-example-2', description: '' }}
          inline
          onTend={() => undefined}
          onClose={() => undefined}
        />
        <RhythmDetailsDialog
          rhythm={{ ...rhythm, id: 'inline-associated-example', description: '' }}
          inline
          people={syntheticPeople.slice(0, 1)}
          onPersonSelect={() => undefined}
          onTend={() => undefined}
          onClose={() => undefined}
        />
      </>
    );
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(3);
    expect(within(cards[0]!).getByRole('heading', { name: rhythm.title })).toBeTruthy();
    expect(within(cards[0]!).getByText(rhythm.description)).toBeTruthy();
    expect(within(cards[0]!).queryByRole('group', { name: /People associated/ })).toBeNull();
    expect(within(cards[0]!).queryByRole('group', { name: 'Associated categories' })).toBeNull();
    expect(cards[1]?.querySelector('.today-rhythm-details__summary')).toBeNull();
    expect(within(cards[2]!).queryByText(rhythm.description)).toBeNull();
    expect(within(cards[2]!).getByRole('group', {
      name: `Associations for ${rhythm.title}`
    })).toBeTruthy();
    expect(cards.map(card => card.querySelector('h3')?.id)).toEqual([
      'today-rhythm-inline-empty-example-title',
      'today-rhythm-inline-empty-example-2-title',
      'today-rhythm-inline-associated-example-title'
    ]);
  });

  it('shows selected category badges without substituting Foundation associations', () => {
    const rhythm = {
      ...todayRhythms[0]!,
      description: '',
      categoryIds: ['marriage', 'faith'] as const,
      primaryFoundationId: 'connection'
    };
    render(
      <>
        <RhythmDetailsDialog
          rhythm={rhythm}
          inline
          people={syntheticPeople.slice(0, 1)}
          onPersonSelect={() => undefined}
          onTend={() => undefined}
          onClose={() => undefined}
        />
        <RhythmDetailsDialog
          rhythm={{
            ...rhythm,
            id: 'inline-foundation-only',
            categoryIds: [],
            primaryFoundationId: 'connection'
          }}
          inline
          onTend={() => undefined}
          onClose={() => undefined}
        />
        <RhythmDetailsDialog
          rhythm={{
            ...rhythm,
            id: 'inline-categories-only',
            title: 'Categories only'
          }}
          inline
          onTend={() => undefined}
          onClose={() => undefined}
        />
      </>
    );

    const [card, foundationOnlyCard, categoriesOnlyCard] = screen.getAllByRole('article');
    expect(card).toBeTruthy();
    expect(foundationOnlyCard).toBeTruthy();
    expect(categoriesOnlyCard).toBeTruthy();
    const associationRow = within(card!).getByRole('group', { name: `Associations for ${rhythm.title}` });
    expect(within(associationRow).getAllByRole('img').map(icon => icon.getAttribute('aria-label'))).toEqual([
      'Faith',
      'Marriage'
    ]);
    const people = within(associationRow).getAllByRole('button');
    const categoryIcons = within(associationRow).getAllByRole('img');
    expect(associationRow.classList.contains('today-rhythm-details__association-row')).toBe(true);
    expect(people[0]!.getAttribute('aria-label')).toBe('Open synthetic profile for Avery Brooks');
    expect(people[0]!.compareDocumentPosition(categoryIcons[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(card!).queryByText('Connection')).toBeNull();
    expect(within(foundationOnlyCard!).queryByRole('group', { name: 'Associated categories' })).toBeNull();
    expect(foundationOnlyCard!.querySelector('.today-rhythm-details__summary')).toBeNull();
    const categoriesOnlyAssociations = within(categoriesOnlyCard!).getByRole('group', {
      name: 'Associations for Categories only'
    });
    expect(within(categoriesOnlyAssociations).getAllByRole('img').map(icon => icon.getAttribute('aria-label'))).toEqual([
      'Faith',
      'Marriage'
    ]);
    expect(within(categoriesOnlyAssociations).queryByRole('button')).toBeNull();
  });

  it('keeps the quiet edit control beside short and long titles while Close stays separate', () => {
    const onEdit = vi.fn();
    const rhythm = {
      id: 'details-header-rhythm',
      title: 'Short title',
      automation: 'manual' as const,
      status: 'Due today' as const
    };
    const { rerender } = render(
      <RhythmDetailsDialog rhythm={rhythm} onEdit={onEdit} onClose={() => undefined} />
    );

    for (const title of [
      'Pray together',
      'A deliberately long title to see how wrapping does and make sure it still looks'
    ]) {
      const titledRhythm = { ...rhythm, title };
      rerender(
        <RhythmDetailsDialog rhythm={titledRhythm} onEdit={onEdit} onClose={() => undefined} />
      );

      const dialog = screen.getByRole('dialog', { name: title });
      const heading = within(dialog).getByRole('heading', { name: title });
      const editButton = within(dialog).getByRole('button', { name: `Edit ${title}` });
      const closeButton = within(dialog).getByRole('button', { name: 'Close details' });
      const header = heading.closest('header');

      expect(editButton.previousElementSibling).toBe(heading);
      expect(editButton.parentElement).toBe(heading.parentElement);
      expect(editButton.querySelector('.today-rhythm-details__edit-visual')?.getAttribute('aria-hidden')).toBe('true');
      expect(editButton.querySelector('.today-rhythm-details__edit-visual svg')).toBeTruthy();
      expect(closeButton.parentElement).toBe(header);
      expect(closeButton).not.toBe(editButton.parentElement);
    }
  });

  it('keeps the shared edit control keyboard-focusable', async () => {
    const user = userEvent.setup();
    const rhythm = {
      id: 'keyboard-details-header-rhythm',
      title: 'Pray together',
      automation: 'manual' as const,
      status: 'Due today' as const
    };
    render(<RhythmDetailsDialog rhythm={rhythm} onEdit={() => undefined} onClose={() => undefined} />);

    const editButton = screen.getByRole('button', { name: 'Edit Pray together' });
    await user.tab();

    expect(document.activeElement).toBe(editButton);
    expect(editButton.matches(':focus-visible')).toBe(true);
  });

  it('keeps the named chart/history control available in both Tend states', async () => {
    const user = userEvent.setup();
    const rhythm = todayRhythms[0]!;

    for (const completed of [false, true]) {
      const onClose = vi.fn();
      render(<RhythmDetailsDialog rhythm={rhythm} completed={completed} onClose={onClose} />);
      const dialog = screen.getByRole('dialog', { name: rhythm.title });
      const historyButton = within(dialog).getByRole('button', {
        name: `View scores and history for ${rhythm.title}`
      });
      expect(historyButton.querySelector('svg')).toBeTruthy();
      historyButton.focus();
      expect(document.activeElement).toBe(historyButton);
      await user.keyboard('{Enter}');
      expect(within(dialog).getByRole('region', { name: `History for ${rhythm.title}` })).toBeTruthy();
      expect(within(dialog).queryByRole('button', { name: 'Back to rhythm details' })).toBeNull();
      await user.click(within(dialog).getByRole('button', { name: 'Close details' }));
      expect(onClose).toHaveBeenCalledOnce();
      cleanup();
    }
  });

  it('keeps sample Marriage details read-only and exposes associated categories through the history view', async () => {
    const user = userEvent.setup();
    const rhythm = marriageRhythms.find(item => item.id === 'sample-marriage-prayer')!;
    const onClose = vi.fn();
    render(
      <RhythmDetailsDialog
        rhythm={{ ...rhythm, categoryIds: ['faith', 'marriage'] }}
        people={syntheticPeople.slice(0, 2)}
        onPersonSelect={() => undefined}
        onClose={onClose}
      />
    );
    const dialog = screen.getByRole('dialog', { name: rhythm.title });
    expect(within(dialog).getByRole('button', { name: 'Open synthetic profile for Avery Brooks' })).toBeTruthy();
    const categoryGroup = within(dialog).getByRole('group', { name: 'Associated categories' });
    expect(within(categoryGroup).getAllByRole('img').map(icon => icon.getAttribute('aria-label'))).toEqual([
      'Faith',
      'Marriage'
    ]);
    const historyButton = within(dialog).getByRole('button', {
      name: 'View scores and history for Pray Together'
    });
    expect(historyButton.querySelector('svg')).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: /^Tend/ })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /^Undo/ })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /Edit/ })).toBeNull();

    await user.click(historyButton);
    expect(within(dialog).getByRole('region', { name: 'History for Pray Together' })).toBeTruthy();
    expect(within(dialog).getByText('Your story starts with the first Tend.')).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'Back to rhythm details' })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Close details' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps the history control independent of legacy score values', () => {
    const rhythm = marriageRhythms.find(item => item.id === 'sample-marriage-connection')!;
    const { rerender } = render(<RhythmDetailsDialog rhythm={rhythm} onClose={() => undefined} />);

    for (const score of [82, 0, null] as const) {
      rerender(
        <RhythmDetailsDialog
          rhythm={{ ...rhythm, illustrativeScore: score }}
          onClose={() => undefined}
        />
      );
      expect(screen.getByRole('button', {
        name: 'View scores and history for Daily Connection'
      })).toBeTruthy();
    }
  });

  it('changes only the local fixture through a keyboard-operable milestone action', async () => {
    const user = userEvent.setup();
    render(<CatalogApp />);

    await user.tab();
    await user.tab();
    const completeButton = screen.getByRole('button', { name: 'Mark milestone complete' });
    expect(document.activeElement).toBe(completeButton);
    await user.keyboard('{Enter}');

    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText(/Not confirmed/, { selector: '.rhythm-cadence' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reopen milestone' }));
    expect(screen.getByText('In progress')).toBeTruthy();
  });

  it('clamps shared score-meter markers to endpoints and omits the marker when unavailable', () => {
    const { rerender, container } = render(<ScoreMeter label="Synthetic score" score={0} markerPlacement="below" />);
    let meter = screen.getByRole('meter', { name: 'Synthetic score' });
    let marker = container.querySelector<HTMLElement>('.preview-score-marker');
    expect(meter.getAttribute('aria-valuenow')).toBe('0');
    expect(marker?.style.getPropertyValue('--score')).toBe('0%');
    expect(meter.classList.contains('preview-score-meter--marker-below')).toBe(true);

    rerender(<ScoreMeter label="Synthetic score" score={50} markerPlacement="below" />);
    meter = screen.getByRole('meter', { name: 'Synthetic score' });
    marker = container.querySelector<HTMLElement>('.preview-score-marker');
    expect(meter.getAttribute('aria-valuenow')).toBe('50');
    expect(marker?.style.getPropertyValue('--score')).toBe('50%');

    rerender(<ScoreMeter label="Synthetic score" score={100} markerPlacement="below" />);
    meter = screen.getByRole('meter', { name: 'Synthetic score' });
    marker = container.querySelector<HTMLElement>('.preview-score-marker');
    expect(meter.getAttribute('aria-valuenow')).toBe('100');
    expect(marker?.style.getPropertyValue('--score')).toBe('100%');

    rerender(<ScoreMeter label="Synthetic score" score={150} />);
    meter = screen.getByRole('meter', { name: 'Synthetic score' });
    marker = container.querySelector<HTMLElement>('.preview-score-marker');
    expect(meter.getAttribute('aria-valuenow')).toBe('100');
    expect(marker?.style.getPropertyValue('--score')).toBe('100%');

    rerender(<ScoreMeter label="Marriage score unavailable" score={null} markerPlacement="below" />);
    meter = screen.getByRole('meter', { name: 'Marriage score unavailable' });
    expect(meter.getAttribute('aria-valuenow')).toBeNull();
    expect(meter.getAttribute('aria-valuetext')).toBe('Score unavailable');
    expect(container.querySelector('.preview-score-marker')).toBeNull();
  });

  it('renders Foundation fills proportionally, distinguishes zero from unavailable, and has no triangle', () => {
    const { rerender, container } = render(
      <FoundationProgress label="Foundation example score" score={0} />
    );
    let meter = screen.getByRole('meter', { name: 'Foundation example score' });
    let fill = container.querySelector<HTMLElement>('.foundation-progress__fill');
    expect(meter.getAttribute('aria-valuenow')).toBe('0');
    expect(fill?.style.width).toBe('0%');
    expect(container.querySelector('.preview-score-marker')).toBeNull();

    rerender(<FoundationProgress label="Foundation example score" score={46} />);
    meter = screen.getByRole('meter', { name: 'Foundation example score' });
    fill = container.querySelector<HTMLElement>('.foundation-progress__fill');
    expect(meter.getAttribute('aria-valuenow')).toBe('46');
    expect(fill?.style.width).toBe('46%');

    rerender(<FoundationProgress label="Foundation example score" score={null} />);
    meter = screen.getByRole('meter', { name: 'Foundation example score' });
    fill = container.querySelector<HTMLElement>('.foundation-progress__fill');
    expect(meter.getAttribute('aria-valuenow')).toBeNull();
    expect(meter.getAttribute('aria-valuetext')).toBe('Score unavailable');
    expect(fill?.style.width).toBe('0%');
    expect(container.querySelector('.preview-score-marker')).toBeNull();
  });

  it('keeps zero and unavailable Foundation row values distinguishable and keyboard-actionable', async () => {
    const user = userEvent.setup();
    const foundation = { ...marriageFoundation, id: 'foundation-score-example', name: 'Sample Foundation' };
    const onSelect = vi.fn();
    const { rerender, container } = render(
      <FoundationCard
        foundation={foundation}
        variant="compact"
        illustrativeScore={0}
        rhythmCoverage={{ scored: 0, total: 2 }}
        onSelect={onSelect}
      />
    );
    let row = screen.getByRole('button', { name: /Open Sample Foundation foundation details, illustrative score 0 out of 100/ });
    const zeroScore = row.querySelector('.foundation-card__score');
    const zeroChevron = row.querySelector('.foundation-card__chevron');
    expect(zeroScore?.textContent).toBe('0');
    expect(row.querySelector('.foundation-progress__fill')?.getAttribute('style')).toContain('width: 0%');
    expect(zeroChevron?.textContent).toBe('›');
    expect(Boolean(zeroScore && zeroChevron && (zeroScore.compareDocumentPosition(zeroChevron) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    expect(row.querySelector('.preview-score-marker')).toBeNull();
    expect(row.querySelector('button')).toBeNull();

    row.focus();
    expect(document.activeElement).toBe(row);
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledOnce();

    rerender(
      <FoundationCard
        foundation={foundation}
        variant="compact"
        illustrativeScore={null}
        rhythmCoverage={{ scored: 0, total: 2 }}
        onSelect={onSelect}
      />
    );
    row = screen.getByRole('button', { name: /Open Sample Foundation foundation details, score unavailable/ });
    expect(row.querySelector('.foundation-card__score')?.textContent).toBe('—');
    expect(row.querySelector('.foundation-progress__fill')?.getAttribute('style')).toContain('width: 0%');
    expect(row.querySelector('.foundation-card__chevron')?.textContent).toBe('›');
    expect(container.querySelector('.preview-score-marker')).toBeNull();
  });

  it('uses a color-coded rounded health badge for available scores and a neutral dash when unavailable', () => {
    const { rerender, container } = render(<CategoryHealthBadge score={30} />);
    let badge = container.querySelector('.ma-score');
    expect(badge?.textContent).toBe('30');
    expect(badge?.classList.contains('red')).toBe(true);

    rerender(<CategoryHealthBadge score={null} />);
    badge = container.querySelector('.ma-score');
    expect(badge?.textContent).toBe('—');
    expect(badge?.classList.contains('neutral')).toBe(true);
  });

  it('shows only explicitly synthetic zero, midpoint, and full-scale catalogue meters', () => {
    render(<CatalogApp />);
    expect(screen.getByRole('heading', { name: 'Score meter examples · synthetic UI only' })).toBeTruthy();
    for (const score of [0, 50, 100]) {
      const meter = screen.getByRole('meter', { name: `Synthetic score meter example: ${score} out of 100` });
      expect(meter.getAttribute('aria-valuenow')).toBe(String(score));
      expect(meter.classList.contains('preview-score-meter--marker-below')).toBe(true);
    }
    expect(screen.getByText(/no Marriage score is calculated or implied/i)).toBeTruthy();
  });

  it('maps approved Marriage SVGs by stable identity and uses an inert fallback for unknown icons', () => {
    const { container, rerender } = render(
      <MarriageIcon group="foundations" id="connection" className="mapped-icon" />
    );
    let icon = container.querySelector<HTMLElement>('.marriage-svg-icon');
    expect(decodeURIComponent(icon?.style.getPropertyValue('--marriage-icon') ?? '')).toContain("aria-label='Connection'");
    expect(icon?.getAttribute('aria-hidden')).toBe('true');

    rerender(<MarriageIcon group="rhythms" id="date-night" />);
    icon = container.querySelector<HTMLElement>('.marriage-svg-icon');
    expect(decodeURIComponent(icon?.style.getPropertyValue('--marriage-icon') ?? '')).toContain("aria-label='Date Night'");
    expect(icon?.getAttribute('aria-hidden')).toBe('true');

    rerender(<MarriageIcon group="foundations" id="not-a-known-foundation" />);
    expect(container.querySelector('.marriage-svg-icon')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('♡');
  });

  it('provides approved icon mappings for each retained Marriage Foundation and populated Rhythm', () => {
    const expectedFoundationLabels = [
      'Connection', 'Communication', 'Fun & Adventure', 'Spiritual Growth', 'Partnership', 'Intimacy'
    ];
    expect(marriageFoundations.map(item => item.name)).toEqual(expectedFoundationLabels);
    for (const foundation of marriageFoundations) {
      expect(foundation.iconId).toBe(foundation.id);
    }
    const supportedRhythmIcons = marriageRhythms.map(rhythm => rhythm.iconId);
    expect(supportedRhythmIcons).toEqual(['daily-connection', 'date-night', 'pray-together', 'dream-together']);
    expect(marriageExampleFixtures.empty.foundations.map(item => item.id)).toEqual(marriageFoundations.map(item => item.id));

    const { container } = render(
      <>
        {marriageFoundations.map(foundation => (
          <MarriageIcon key={foundation.id} group="foundations" id={foundation.iconId ?? foundation.id} />
        ))}
        {marriageRhythms.map(rhythm => (
          <MarriageIcon key={rhythm.id} group="rhythms" id={rhythm.iconId ?? ''} />
        ))}
      </>
    );
    const mappedIcons = [...container.querySelectorAll<HTMLElement>('.marriage-svg-icon')];
    expect(mappedIcons).toHaveLength(10);
    const sources = mappedIcons.map(icon => decodeURIComponent(icon.style.getPropertyValue('--marriage-icon')));
    for (const label of ['Connection', 'Communication', 'Fun Adventure', 'Spiritual Growth', 'Partnership', 'Intimacy', 'Daily Connection', 'Date Night', 'Pray Together', 'Dream Together']) {
      expect(sources.some(source => source.includes(`aria-label='${label}'`))).toBe(true);
    }
    expect(mappedIcons.every(icon => icon.getAttribute('aria-hidden') === 'true')).toBe(true);
  });
});
