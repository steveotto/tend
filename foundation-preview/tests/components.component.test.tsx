import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogApp } from '../src/CatalogApp.tsx';
import { AreaIcon } from '../src/components/AreaIcon.tsx';
import { CategoryHealthBadge, FoundationCard, FoundationProgress, GoalCard, RhythmCard, ScoreMeter } from '../src/components/Cards.tsx';
import { MarriageIcon } from '../src/components/MarriageIcon.tsx';
import { RhythmCategoryBadges } from '../src/components/RhythmCategoryBadges.tsx';
import { historyButtonName } from './history-button-name.ts';
import { PersonBadge, PersonBadgeList } from '../src/components/PersonBadge.tsx';
import { RhythmDetailsDialog } from '../src/components/RhythmDetailsDialog.tsx';
import { RhythmSuggestionPicker } from '../src/components/RhythmSuggestionPicker.tsx';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';
import {
  financeFoundation,
  areas,
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
  it('uses the same suggestion reuse view for another Category catalogue', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn((_event, returnToPicker) => returnToPicker(false));
    const onEdit = vi.fn((_event, returnToPicker) => returnToPicker(false));
    const onRestore = vi.fn();
    render(
      <RhythmSuggestionPicker
        title="Faith practice suggestions"
        open
        groups={[{
          id: 'practices',
          title: 'Practices',
          subtitle: 'A synthetic fixture proving shared picker composition.',
          items: [{
            id: 'faith.prayer',
            title: 'Prayer',
            scheduleHint: 'Daily · Flexible',
            icon: <span aria-hidden="true">✦</span>,
            instances: [
              {
                id: 'user-rhythm-one',
                title: 'Pray together',
                peopleLabel: 'Avery Brooks',
                scheduleSummary: 'Every Mon · Evening',
                archived: false,
                onEdit
              },
              {
                id: 'user-rhythm-two',
                title: 'Quiet prayer',
                scheduleSummary: 'Daily',
                archived: false,
                onEdit
              },
              {
                id: 'user-rhythm-old',
                title: 'Morning prayer',
                scheduleSummary: 'Every Tue',
                archived: true,
                onRestore
              }
            ],
            onAdd
          }]
        }]}
        onClose={vi.fn()}
        onReopen={vi.fn()}
      />
    );

    const picker = screen.getByRole('dialog', { name: 'Faith practice suggestions' });
    const row = within(picker).getByRole('heading', { name: 'Prayer', level: 4 }).closest('li')!;
    expect(within(row).getByText('2 added')).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Add' })).toBeTruthy();
    await user.click(within(row).getByRole('button', { name: 'Add' }));
    expect(within(picker).getByRole('heading', { name: 'You’ve added Prayer' })).toBeTruthy();
    expect(within(picker).getByText('Pray together')).toBeTruthy();
    expect(within(picker).getByText('Avery Brooks')).toBeTruthy();
    expect(within(picker).getByText('Every Mon · Evening')).toBeTruthy();
    expect(within(picker).getByRole('heading', { name: 'Archived' })).toBeTruthy();
    expect(within(picker).getByText('Morning prayer')).toBeTruthy();
    await user.click(within(picker).getByRole('button', { name: '＋ Add another' }));
    expect(onAdd).toHaveBeenCalledOnce();
    expect(onEdit).not.toHaveBeenCalled();
    await user.click(within(picker).getByRole('button', { name: 'Restore' }));
    expect(onRestore).toHaveBeenCalledOnce();
  });

  it('renders every associated Category as a navigable badge with accessible names', async () => {
    const rhythm = { ...todayRhythms[0]!, categoryIds: areas.map(area => area.id) };
    const onOpenCategory = vi.fn();
    const { container } = render(
      <RhythmCategoryBadges rhythm={rhythm} onOpenCategory={onOpenCategory} />
    );
    const group = screen.getByRole('group', { name: 'Associated categories' });
    const badges = within(group).getAllByRole('button');

    expect(badges.map(badge => badge.getAttribute('aria-label'))).toEqual(
      areas.map(area => area.label)
    );
    expect(badges.every(badge => badge.getAttribute('title') === badge.getAttribute('aria-label'))).toBe(true);
    expect(badges.every(badge => badge.getAttribute('data-tooltip') === badge.getAttribute('aria-label'))).toBe(true);
    expect(badges.every(badge => badge.querySelector('.rhythm-area-badge__visual .area-svg-icon'))).toBe(true);
    expect(container.querySelectorAll('.rhythm-area-badge')).toHaveLength(6);

    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(badges[0]);
    await user.keyboard('{Enter}');
    expect(onOpenCategory).toHaveBeenCalledWith(
      areas[0]!.id,
      `rhythm-category-badge-${rhythm.id}-${areas[0]!.id}`
    );
    await user.click(badges[0]!);
    expect(onOpenCategory).toHaveBeenCalledTimes(2);
  });

  it('maps every stable Category ID to its approved production symbol', () => {
    const expectedSymbols = [
      'M12 3v18M6 9h12',
      'M19 14c1.49-1.46',
      'M15 21v-8a1 1 0 0 0-1-1',
      'M22 12h-2.48',
      'M12 2v20M17 5H9.5',
      'M18 21a8 8 0 0 0-16 0'
    ];
    const { container } = render(<>{areas.map(area => <AreaIcon key={area.id} id={area.id} />)}</>);
    const icons = [...container.querySelectorAll<HTMLElement>('.area-svg-icon')];

    expect(icons).toHaveLength(6);
    expect(icons.every(icon => icon.getAttribute('aria-hidden') === 'true')).toBe(true);
    icons.forEach((icon, index) => {
      expect(decodeURIComponent(icon.style.getPropertyValue('--area-icon')))
        .toContain(expectedSymbols[index]);
    });
  });

  it('uses crisp summary-only Category symbols without changing shared badge assets', () => {
    const { container } = render(
      <>
        {areas.map(area => <AreaIcon key={area.id} id={area.id} variant="today-summary" />)}
      </>
    );
    const icons = [...container.querySelectorAll<HTMLElement>('.area-svg-icon--today-summary')];
    const decodeAsset = (icon: HTMLElement) => {
      const url = icon.style.getPropertyValue('--area-icon').slice(5, -2);
      return decodeURIComponent(url.startsWith('data:') ? url.slice(url.indexOf(',') + 1) : url);
    };
    const summaryAssets = icons.map(decodeAsset);
    const defaultFaith = render(<AreaIcon id="faith" />);
    const defaultFaithAsset = decodeURIComponent(
      defaultFaith.container.querySelector<HTMLElement>('.area-svg-icon')!
        .style.getPropertyValue('--area-icon').slice(5, -2)
    );

    expect(icons).toHaveLength(6);
    expect(summaryAssets[0]).toContain('stroke-width="2.75"');
    expect(summaryAssets[0]).toContain('M12 3v18M6 9h12');
    expect(summaryAssets[1]).toMatch(/fill-opacity=['"]1['"]/);
    expect(summaryAssets[2]).not.toContain('fill-opacity="0.12"');
    expect(summaryAssets[3]).not.toContain('fill-opacity="0.12"');
    expect(summaryAssets[4]).toContain('M12 2v20M17 5H9.5');
    expect(summaryAssets[5]).not.toContain('fill-opacity="0.12"');
    expect(defaultFaithAsset).toMatch(/stroke-width=['"]2\.5['"]/);
  });

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

  it('renders a static shared person badge without a navigation control', () => {
    const { container } = render(
      <PersonBadge person={syntheticPeople[1]!} presentation="static" />
    );
    const badge = screen.getByRole('img', { name: 'Morgan Reed' });

    expect(badge.className).toContain('rhythm-person-badge--static');
    expect(badge.querySelector('.person-badge-visual')).toBeTruthy();
    expect(badge.querySelector('.person-badge-avatar')?.textContent).toBe('MR');
    expect(badge.querySelector('.person-badge-name')?.textContent).toBe('Morgan');
    expect(container.querySelector('button')).toBeNull();
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

  it('routes catalogue person badges to the shared synthetic profile and back', async () => {
    const user = userEvent.setup();
    render(<CatalogApp />);
    const rhythm = screen.getByRole('article', { name: 'Monthly savings transfer' });
    const badge = within(rhythm).getByRole('button', { name: 'Open synthetic profile for Avery Brooks' });
    expect(badge.querySelector('.person-badge-name')?.textContent).toBe('Avery');
    await user.click(badge);
    expect(screen.getByRole('heading', { name: 'Avery Brooks' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Rhythms' })).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Connections' }));
    expect(screen.getByText('No connections yet.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Close profile for Avery Brooks' }));
    expect(screen.getByRole('heading', { name: 'Goals' })).toBeTruthy();
  });

  it('shows an ongoing Marriage foundation without a completion action', () => {
    render(<FoundationCard foundation={marriageFoundation} />);

    expect(screen.getByRole('heading', { name: 'Connection' })).toBeTruthy();
    expect(screen.getByText('Ongoing', { selector: '.lifecycle-badge' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /mark milestone complete/i })).toBeNull();
  });

  it('reserves two description lines on overview and selected detail summaries only', () => {
    const oneLineFoundation = {
      ...marriageFoundation,
      id: 'foundation-one-line-description',
      name: 'One-line Foundation',
      description: 'A short description.'
    };
    const twoLineFoundation = {
      ...marriageFoundation,
      id: 'foundation-two-line-description',
      name: 'Two-line Foundation',
      description: 'A description that remains fully visible when it wraps to another line.'
    };
    const onSelect = vi.fn();
    const { container } = render(
      <>
        <FoundationCard
          foundation={oneLineFoundation}
          variant="compact"
          score={50}
          onSelect={onSelect}
        />
        <FoundationCard
          foundation={twoLineFoundation}
          variant="compact"
          score={50}
          onSelect={onSelect}
        />
        <FoundationCard
          foundation={oneLineFoundation}
          variant="compact"
          score={50}
          scoreEvidence="1 of 2 linked Rhythms scored"
          reserveDescriptionSpace
        >
          <div className="foundation-detail-linked-rhythms">Linked Rhythms</div>
        </FoundationCard>
        <FoundationCard foundation={marriageFoundation} variant="compact" score={50} />
      </>
    );

    const overviewCards = container.querySelectorAll('.foundation-card--interactive');
    expect(overviewCards).toHaveLength(2);
    for (const card of overviewCards) {
      expect(card.querySelector('.foundation-card__description')?.classList.contains(
        'foundation-card__description--reserved'
      )).toBe(true);
    }
    expect(overviewCards[0]?.querySelector('.foundation-card__description')?.textContent)
      .toBe(oneLineFoundation.description);
    expect(overviewCards[1]?.querySelector('.foundation-card__description')?.textContent)
      .toBe(twoLineFoundation.description);
    const catalogueDescription = container.querySelectorAll(
      '.foundation-card--compact:not(.foundation-card--interactive) .foundation-card__description'
    ).item(1);
    expect(catalogueDescription?.classList.contains('foundation-card__description--reserved')).toBe(false);
    const detailCard = container.querySelector('.foundation-detail-linked-rhythms')?.parentElement;
    expect(detailCard?.querySelector('.foundation-card__description')?.classList.contains(
      'foundation-card__description--reserved'
    )).toBe(true);
    expect(detailCard?.querySelector('.foundation-card__coverage')?.textContent)
      .toBe('1 of 2 linked Rhythms scored');
    expect(detailCard?.querySelector('.foundation-progress')).toBeTruthy();
    expect(detailCard?.querySelector('.foundation-card__content')?.contains(
      detailCard.querySelector('.foundation-detail-linked-rhythms')
    )).toBe(false);
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
    expect(within(dialog).getByText('Never')).toBeTruthy();
    expect(within(dialog).getByText('Never').getAttribute('aria-label')).toBe('Last tended: Never');
    expect(within(dialog).getByText('Never').previousElementSibling?.tagName.toLowerCase()).toBe('svg');
    const footer = dialog.querySelector('.rhythm-metadata-footer')!;
    const scheduleGroup = footer.querySelector('.rhythm-metadata-schedule-group')!;
    const statusGroup = footer.querySelector('.rhythm-metadata-last-tended')!;
    expect(footer.children).toHaveLength(2);
    expect(footer.firstElementChild).toBe(scheduleGroup);
    expect(footer.lastElementChild).toBe(statusGroup);
    expect(scheduleGroup.querySelectorAll(':scope > span')).toHaveLength(2);
    expect(scheduleGroup.textContent).toContain('Daily');
    expect(scheduleGroup.textContent).toContain('Morning');
    expect(statusGroup.textContent).toContain('Never');
    expect(statusGroup.querySelector('.rhythm-metadata-status-group')?.children[0]?.tagName.toLowerCase())
      .toBe('svg');
  });

  it('keeps schedule changes out of the last-activity footer', () => {
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
      expect(within(footer).getByText('Never')).toBeTruthy();
      expect(within(footer).queryByText('Next due Jan 1')).toBeNull();

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
      expect(within(document.querySelector('.rhythm-metadata-footer') as HTMLElement).getByText('Never')).toBeTruthy();
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
    expect(statusGroup.querySelector('.rhythm-metadata-status')?.textContent).toBe('Never');
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

    await user.click(screen.getByRole('button', { name: historyButtonName(`View scores and history for ${rhythm.title}`) }));
    const history = screen.getByRole('region', { name: `History for ${rhythm.title}` });
    expect(within(history).getAllByText(
      'Full schedule: The 15th day of the second month of every quarter.'
    ).length).toBeGreaterThan(0);
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
    expect(within(card).getByRole('button', { name: historyButtonName(`View scores and history for ${todayRhythms[0]!.title}`) })).toBeTruthy();
    expect(within(card).getByRole('button', { name: `Edit ${todayRhythms[0]!.title}` })).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'Close details' })).toBeNull();
    expect(within(card).queryByRole('button', { name: /^Back/ })).toBeNull();

    await user.click(within(card).getByRole('button', { name: `Tend ${todayRhythms[0]!.title}` }));
    await user.click(within(card).getByRole('button', { name: historyButtonName(`View scores and history for ${todayRhythms[0]!.title}`) }));
    await user.click(within(card).getByRole('button', { name: `Edit ${todayRhythms[0]!.title}` }));
    expect(onTend).toHaveBeenCalledOnce();
    expect(onHistory).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('shows the rounded Health score as part of the shared history action name', () => {
    const rhythm = todayRhythms[0]!;
    render(
      <>
        <RhythmDetailsDialog
          rhythm={{ ...rhythm, id: 'scored-inline' }}
          inline
          healthScore={42.6}
          onClose={() => undefined}
        />
        <RhythmDetailsDialog
          rhythm={{ ...rhythm, id: 'zero-inline' }}
          inline
          healthScore={0}
          onClose={() => undefined}
        />
        <RhythmDetailsDialog
          rhythm={{ ...rhythm, id: 'unavailable-inline' }}
          inline
          healthScore={null}
          onClose={() => undefined}
        />
      </>
    );

    const scored = screen.getByRole('button', {
      name: historyButtonName(`View scores and history for ${rhythm.title}, Health 43 out of 100`)
    });
    const zero = screen.getByRole('button', {
      name: historyButtonName(`View scores and history for ${rhythm.title}, Health 0 out of 100`)
    });
    const unavailable = screen.getByRole('button', {
      name: historyButtonName(`View scores and history for ${rhythm.title}, Health unavailable`)
    });
    expect(scored.querySelector('.today-rhythm-details__history-score')?.textContent).toBe('43');
    expect(zero.querySelector('.today-rhythm-details__history-score')?.textContent).toBe('0');
    expect(unavailable.querySelector('.today-rhythm-details__history-score')?.textContent).toBe('—');
    for (const button of [scored, zero, unavailable]) {
      expect(button.tagName).toBe('BUTTON');
      expect(button.querySelectorAll('svg')).toHaveLength(1);
    }
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
    expect(within(card).getByRole('button', { name: historyButtonName(`View scores and history for ${rhythm.title}`) })).toBeTruthy();
    expect(body).toBeNull();
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
    expect(within(cards[2]!).queryByRole('group', { name: /category and linked Foundations/ })).toBeNull();
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

  it('keeps people in their own row and groups Category badges with owned Foundations', async () => {
    const user = userEvent.setup();
    const financeFoundations = Array.from({ length: 4 }, (_, index) => ({
      ...marriageFoundations[0]!,
      id: `finance-foundation-${index + 1}`,
      category: 'Finances' as const,
      categoryId: 'finances' as const,
      name: `Finance Foundation ${index + 1}`
    }));
    const catalogue = [...financeFoundations, ...marriageFoundations];
    const rhythm = {
      ...todayRhythms[0]!,
      id: 'grouped-associations',
      title: 'Grouped associations',
      categoryIds: ['finances', 'faith', 'marriage'] as const,
      primaryFoundationId: 'finance-foundation-4',
      secondaryFoundationIds: [...marriageFoundations.map(foundation => foundation.id), ...financeFoundations.slice(0, 3).map(foundation => foundation.id)]
    };
    render(
      <RhythmDetailsDialog
        rhythm={rhythm}
        inline
        people={syntheticPeople}
        foundations={catalogue}
        onPersonSelect={() => undefined}
        onOpenCategory={() => undefined}
        onOpenFoundation={() => undefined}
        onTend={() => undefined}
        onClose={() => undefined}
      />
    );

    const associations = screen.getByRole('group', { name: `Associations for ${rhythm.title}` });
    const peopleRow = within(associations).getByRole('group', { name: `People associated with ${rhythm.title}` });
    const categoryGroups = within(associations).getAllByRole('group', {
      name: /category and linked (?:Practices|Foundations)/
    });
    expect(peopleRow.nextElementSibling).toBe(associations.querySelector('.today-rhythm-details__association-category-row'));
    expect(categoryGroups.map(group => group.getAttribute('aria-label'))).toEqual([
      'Faith category and linked Practices',
      'Marriage category and linked Foundations',
      'Finances category and linked Foundations'
    ]);

    const faithGroup = categoryGroups[0]!;
    const marriageGroup = categoryGroups[1]!;
    const financeGroup = categoryGroups[2]!;
    expect(within(faithGroup).getAllByRole('button').map(button => button.getAttribute('aria-label')))
      .toEqual(['Faith']);
    expect(within(marriageGroup).getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual([
      'Marriage',
      'Marriage: Connection',
      'Marriage: Communication',
      'Open 4 more linked Foundations'
    ]);
    expect(within(financeGroup).getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual([
      'Finances',
      'Finances: Finance Foundation 1',
      'Finances: Finance Foundation 2',
      'Open 2 more linked Foundations'
    ]);
    expect([...associations.querySelectorAll('.rhythm-foundation-badges')]).toHaveLength(2);
    expect([...associations.querySelectorAll('.rhythm-foundation-badge--overflow')].map(button => button.textContent))
      .toEqual(['+4', '+2']);

    await user.click(within(marriageGroup).getByRole('button', { name: 'Open 4 more linked Foundations' }));
    let popover = screen.getByRole('dialog', { name: '4 more linked Foundations' });
    expect(within(popover).getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual([
      'Marriage: Fun & Adventure',
      'Marriage: Spiritual Growth',
      'Marriage: Partnership',
      'Marriage: Intimacy'
    ]);
    await user.keyboard('{Escape}');

    await user.click(within(financeGroup).getByRole('button', { name: 'Open 2 more linked Foundations' }));
    popover = screen.getByRole('dialog', { name: '2 more linked Foundations' });
    expect(within(popover).getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual([
      'Finances: Finance Foundation 3',
      'Finances: Finance Foundation 4'
    ]);
  });

  it('does not present a linked Foundation under a Category it does not belong to', () => {
    const financeFoundation = {
      ...marriageFoundations[0]!,
      id: 'finance-foundation',
      category: 'Finances' as const,
      categoryId: 'finances' as const,
      name: 'Finance Foundation'
    };
    const rhythm = {
      ...todayRhythms[0]!,
      id: 'unassigned-finance-foundation',
      title: 'Unassigned Foundation',
      categoryIds: ['marriage'] as const,
      primaryFoundationId: financeFoundation.id
    };
    render(
      <RhythmDetailsDialog
        rhythm={rhythm}
        inline
        foundations={[financeFoundation]}
        onOpenFoundation={() => undefined}
        onOpenCategory={() => undefined}
        onTend={() => undefined}
        onClose={() => undefined}
      />
    );

    const associations = screen.getByRole('group', { name: `Associations for ${rhythm.title}` });
    expect(within(associations).getByRole('button', { name: 'Marriage' })).toBeTruthy();
    expect(within(associations).queryByRole('button', { name: 'Finances: Finance Foundation' })).toBeNull();
    expect(within(associations).getByText(/1 linked Foundation could not be associated with an assigned Category/))
      .toBeTruthy();
  });

  it('places inline descriptions beside actions and associations across the full card body', () => {
    const rhythm = {
      ...todayRhythms[0]!,
      id: 'full-width-associations',
      title: 'A deliberately long title that wraps naturally beside the action stack',
      description: 'A long description wraps within the upper content area without narrowing the associations below.',
      categoryIds: ['marriage'] as const,
      primaryFoundationId: 'connection'
    };
    const props = {
      rhythm,
      inline: true,
      people: syntheticPeople.slice(0, 2),
      onPersonSelect: () => undefined,
      onOpenCategory: () => undefined,
      foundations: marriageFoundations,
      onOpenFoundation: () => undefined,
      onTend: () => undefined,
      onClose: () => undefined
    };
    const { rerender } = render(<RhythmDetailsDialog {...props} />);
    const card = screen.getByRole('article', { name: rhythm.title });
    const header = card.querySelector('.today-rhythm-details__header');
    const titleGroup = card.querySelector('.today-rhythm-details__title-group');
    const actions = card.querySelector('.today-rhythm-details__actions');
    const content = card.querySelector('.today-rhythm-details__content');
    const associations = within(card).getByRole('group', { name: `Associations for ${rhythm.title}` });
    const footer = card.querySelector('.today-rhythm-details__footer');

    expect(within(titleGroup as HTMLElement).getByText(rhythm.description)).toBeTruthy();
    expect(actions?.parentElement).toBe(header);
    expect(content?.previousElementSibling).toBe(header);
    expect(associations.parentElement).toBe(content);
    expect(content?.querySelector('.today-rhythm-details__summary')).toBeNull();
    expect(content?.nextElementSibling).toBe(footer);
    expect(actions!.compareDocumentPosition(associations) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(associations).getAllByRole('button').length).toBeGreaterThan(2);
    expect(within(card).getByRole('button', { name: `Tend ${rhythm.title}` })).toBeTruthy();

    rerender(<RhythmDetailsDialog {...props} archived />);
    expect(screen.queryByRole('button', { name: `Tend ${rhythm.title}` })).toBeNull();
    expect(within(screen.getByRole('article', { name: rhythm.title }))
      .getByRole('group', { name: `Associations for ${rhythm.title}` })).toBeTruthy();
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
  });

  it('keeps the named chart/history control available in both Tend states', async () => {
    const user = userEvent.setup();
    const rhythm = todayRhythms[0]!;

    for (const completed of [false, true]) {
      const onClose = vi.fn();
      render(<RhythmDetailsDialog rhythm={rhythm} completed={completed} onClose={onClose} />);
      const dialog = screen.getByRole('dialog', { name: rhythm.title });
      const historyButton = within(dialog).getByRole('button', {
        name: historyButtonName(`View scores and history for ${rhythm.title}`)
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
      name: historyButtonName('View scores and history for Pray Together')
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
        name: historyButtonName('View scores and history for Daily Connection')
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

  it('rounds calculated Foundation Health for display while preserving the exact meter value', () => {
    const { container } = render(
      <FoundationCard
        foundation={{ ...marriageFoundation, name: 'Calculated Foundation' }}
        variant="compact"
        score={65.2875}
        scoreLabel="Calculated Foundation Health score"
      />
    );

    expect(container.querySelector('.foundation-card__score')?.textContent).toBe('65');
    expect(screen.getByRole('meter', { name: 'Calculated Foundation Health score' }).getAttribute('aria-valuenow'))
      .toBe('65.2875');
    expect(container.querySelector('.foundation-progress__fill')?.getAttribute('style'))
      .toContain('width: 65.2875%');
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
    expect(decodeURIComponent(icon?.style.getPropertyValue('--marriage-icon') ?? '')).toContain('M10 13a5 5 0 0 0 7.54.54');
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
    const expectedFoundationSymbols = [
      'M10 13a5 5 0 0 0 7.54.54',
      'M14 9a2 2 0 0 1-2 2H6',
      'm16.24 7.76-1.804 5.411',
      'M7 20h10',
      'm11 17 2 2',
      'M19 14c1.49-1.46'
    ];
    expectedFoundationSymbols.forEach((symbol, index) => {
      expect(sources[index]).toContain(symbol);
    });
    for (const rhythmLabel of ['Daily Connection', 'Date Night', 'Pray Together', 'Dream Together']) {
      expect(sources.some(source => source.includes(`aria-label='${rhythmLabel}'`))).toBe(true);
    }
    expect(mappedIcons.every(icon => icon.getAttribute('aria-hidden') === 'true')).toBe(true);
  });
});
