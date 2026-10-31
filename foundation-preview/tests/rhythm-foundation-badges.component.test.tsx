import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RhythmFoundationBadges } from '../src/components/RhythmFoundationBadges.tsx';
import { resolveRhythmFoundationLinks } from '../src/domain/foundation-rhythm-associations.ts';
import { faithPractices, marriageFoundations, marriageRhythms } from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';

afterEach(cleanup);

function rhythmWithFoundationIds(ids: readonly string[]): RhythmPreview {
  return {
    ...marriageRhythms[0]!,
    primaryFoundationId: ids[0] ?? null,
    secondaryFoundationIds: ids.slice(1)
  };
}

describe('shared Rhythm Foundation badges', () => {
  it.each([
    { count: 0, visible: 0, overflow: 0 },
    { count: 1, visible: 1, overflow: 0 },
    { count: 2, visible: 2, overflow: 0 },
    { count: 3, visible: 3, overflow: 0 },
    { count: 4, visible: 2, overflow: 2 },
    { count: 6, visible: 2, overflow: 4 }
  ])('shows $visible Foundation icons and $overflow overflow items for $count links', ({ count, visible, overflow }) => {
    const { container } = render(
      <RhythmFoundationBadges
        rhythm={rhythmWithFoundationIds(marriageFoundations.slice(0, count).map(foundation => foundation.id))}
        foundations={marriageFoundations}
        onOpenFoundation={vi.fn()}
      />
    );

    expect(container.querySelectorAll('.rhythm-foundation-badge:not(.rhythm-foundation-badge--overflow)'))
      .toHaveLength(visible);
    if (overflow === 0) {
      expect(container.querySelector('.rhythm-foundation-badge--overflow')).toBeNull();
    } else {
      expect(container.querySelector('.rhythm-foundation-badge--overflow')?.textContent).toBe(`+${overflow}`);
      expect(container.querySelector('.rhythm-foundation-badge--overflow')?.getAttribute('aria-label'))
        .toBe(`Open ${overflow} more linked Foundations`);
    }
    expect(container.querySelectorAll('.rhythm-foundation-badge--overflow')).toHaveLength(overflow > 0 ? 1 : 0);
  });

  it('uses Practice terminology for Faith badges and groups overflow by Category', async () => {
    const user = userEvent.setup();
    const practices = faithPractices.slice(0, 5);
    const rhythm = {
      ...rhythmWithFoundationIds(practices.map(practice => practice.id)),
      categoryIds: ['faith'] as const
    };
    const { container } = render(
      <RhythmFoundationBadges
        rhythm={rhythm}
        foundations={practices}
        onOpenFoundation={vi.fn()}
      />
    );

    const badges = [...container.querySelectorAll<HTMLButtonElement>('.rhythm-foundation-badge')];
    expect(badges.slice(0, 2).map(button => button.getAttribute('aria-label'))).toEqual([
      `Faith Practice: ${practices[0]!.name}`,
      `Faith Practice: ${practices[1]!.name}`
    ]);
    expect(badges.slice(0, 2).map(button => button.getAttribute('data-tooltip'))).toEqual([
      `Faith Practice · ${practices[0]!.name}`,
      `Faith Practice · ${practices[1]!.name}`
    ]);
    await user.click(screen.getByRole('button', { name: 'Open 3 more linked Practices' }));
    const popover = screen.getByRole('dialog', { name: '3 more linked Practices' });
    expect(within(popover).getAllByRole('heading', { name: 'Faith Practices' })).toHaveLength(1);
    expect(within(popover).getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual(
      practices.slice(2).map(practice => `Faith Practice: ${practice.name}`)
    );
  });

  it('renders nothing for a Rhythm without Foundation links', () => {
    const { container } = render(
      <RhythmFoundationBadges
        rhythm={rhythmWithFoundationIds([])}
        foundations={marriageFoundations}
        onOpenFoundation={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('uses the catalogue order and distinct accessible names for linked Foundations', () => {
    const { container } = render(
      <RhythmFoundationBadges
        rhythm={rhythmWithFoundationIds(['intimacy', 'connection', 'fun-adventure'])}
        foundations={marriageFoundations}
        onOpenFoundation={vi.fn()}
      />
    );

    const badges = [...container.querySelectorAll<HTMLButtonElement>('.rhythm-foundation-badge')];
    expect(badges.map(button => button.getAttribute('aria-label'))).toEqual([
      'Marriage: Connection',
      'Marriage: Fun & Adventure',
      'Marriage: Intimacy'
    ]);
    expect(badges.map(button => button.getAttribute('data-tooltip'))).toEqual([
      'Marriage · Connection',
      'Marriage · Fun & Adventure',
      'Marriage · Intimacy'
    ]);
    expect(badges.every(button => button.getAttribute('aria-haspopup') === null)).toBe(true);
    expect(container.querySelector('.rhythm-foundation-badge__visual .marriage-svg-icon')).toBeTruthy();
  });

  it('opens individual Foundations directly and supports keyboard overflow navigation and dismissal', async () => {
    const user = userEvent.setup();
    const onOpenFoundation = vi.fn();
    const overflowFoundations = [
      ...marriageFoundations,
      {
        ...marriageFoundations[0]!,
        id: 'synthetic-long-name',
        name: 'An exceptionally long Foundation name that wraps naturally at narrow widths'
      }
    ];
    render(
      <>
        <RhythmFoundationBadges
          rhythm={rhythmWithFoundationIds(overflowFoundations.map(foundation => foundation.id))}
          foundations={overflowFoundations}
          onOpenFoundation={onOpenFoundation}
        />
        <button type="button">Outside</button>
      </>
    );

    const firstBadge = screen.getByRole('button', { name: 'Marriage: Connection' });
    await user.tab();
    expect(document.activeElement).toBe(firstBadge);
    await user.keyboard('{Enter}');
    expect(onOpenFoundation).toHaveBeenCalledWith(
      'connection',
      'rhythm-foundation-badge-sample-marriage-connection-connection'
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    const overflow = screen.getByRole('button', { name: 'Open 5 more linked Foundations' });
    await user.click(overflow);
    let popover = screen.getByRole('dialog', { name: '5 more linked Foundations' });
    const items = within(popover).getAllByRole('button');
    expect(items.map(button => button.getAttribute('aria-label'))).toEqual([
      'Marriage: Fun & Adventure',
      'Marriage: Spiritual Growth',
      'Marriage: Partnership',
      'Marriage: Intimacy',
      'Marriage: An exceptionally long Foundation name that wraps naturally at narrow widths'
    ]);
    expect(within(popover).getByRole('heading', { name: 'Marriage Foundations' })).toBeTruthy();
    expect(within(popover).getAllByRole('heading')).toHaveLength(1);
    expect(items.map(button => button.querySelector('.rhythm-foundation-popover__name')?.textContent)).toEqual([
      'Fun & Adventure',
      'Spiritual Growth',
      'Partnership',
      'Intimacy',
      'An exceptionally long Foundation name that wraps naturally at narrow widths'
    ]);
    expect(items.every(button => button.querySelector('.rhythm-foundation-popover__chevron')?.textContent === '›')).toBe(true);
    expect(items.every(button => button.querySelector('.rhythm-foundation-popover__icon'))).toBe(true);
    expect(items.every(button => button.textContent?.includes('Open Foundation') === false)).toBe(true);
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[1]);
    expect(items[4]?.textContent).toContain('An exceptionally long Foundation name');
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(items[0]);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '5 more linked Foundations' })).toBeNull();
    expect(document.activeElement).toBe(overflow);

    await user.click(overflow);
    popover = screen.getByRole('dialog', { name: '5 more linked Foundations' });
    await user.click(within(popover).getByRole('button', { name: 'Marriage: Fun & Adventure' }));
    expect(onOpenFoundation).toHaveBeenCalledWith(
      'fun-adventure',
      'rhythm-foundation-badge-sample-marriage-connection-overflow'
    );
    expect(screen.queryByRole('dialog', { name: '5 more linked Foundations' })).toBeNull();

    await user.click(overflow);
    expect(screen.getByRole('dialog', { name: '5 more linked Foundations' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('dialog', { name: '5 more linked Foundations' })).toBeNull();
  });

  it('reports unresolved references without rendering a fabricated Foundation badge', () => {
    const { container } = render(
      <RhythmFoundationBadges
        rhythm={rhythmWithFoundationIds(['unknown-foundation'])}
        foundations={marriageFoundations}
        onOpenFoundation={vi.fn()}
      />
    );

    expect(container.querySelector('.rhythm-foundation-badge')).toBeNull();
    expect(container.querySelector('[data-unresolved-foundation-count="1"]')).toBeTruthy();
    expect(container.querySelector('.visually-hidden')?.textContent).toContain('could not be resolved');
  });

  it('resolves cross-category records in catalogue order without repeating a stable Foundation ID', async () => {
    const financeFoundation = { ...marriageFoundations[0]!, id: 'finance-foundation', category: 'Finances' as const };
    const catalogue = [financeFoundation, ...marriageFoundations];
    const result = resolveRhythmFoundationLinks(
      rhythmWithFoundationIds(['intimacy', 'finance-foundation', 'connection', 'connection']),
      catalogue
    );

    expect(result.foundations.map(foundation => foundation.id)).toEqual([
      'finance-foundation',
      'connection',
      'intimacy'
    ]);
    expect(result.unresolvedIds).toEqual([]);

    const accessibleFinance = {
      ...financeFoundation,
      iconId: 'communication',
      name: 'Illustrative Finance Area'
    };
    const { container } = render(
      <RhythmFoundationBadges
        rhythm={rhythmWithFoundationIds(['intimacy', 'finance-foundation', 'connection'])}
        foundations={[accessibleFinance, ...marriageFoundations]}
        onOpenFoundation={vi.fn()}
      />
    );
    expect([...container.querySelectorAll('.rhythm-foundation-badge')].map(button => button.getAttribute('aria-label')))
      .toEqual([
        'Finances: Illustrative Finance Area',
        'Marriage: Connection',
        'Marriage: Intimacy'
      ]);
    expect(container.querySelector('.rhythm-foundation-badge--overflow')).toBeNull();
  });

  it('groups mixed-category overflow items under one heading per Category', async () => {
    const financeFoundations = [
      {
        ...marriageFoundations[0]!,
        id: 'finance-first',
        category: 'Finances' as const,
        categoryId: 'finances' as const,
        name: 'Budgeting'
      },
      {
        ...marriageFoundations[1]!,
        id: 'finance-second',
        category: 'Finances' as const,
        categoryId: 'finances' as const,
        name: 'Planning'
      }
    ];
    const catalogue = [
      financeFoundations[0]!,
      marriageFoundations[0]!,
      marriageFoundations[1]!,
      financeFoundations[1]!
    ];
    render(
      <RhythmFoundationBadges
        rhythm={rhythmWithFoundationIds(['finance-first', 'connection', 'communication', 'finance-second'])}
        foundations={catalogue}
        onOpenFoundation={vi.fn()}
      />
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Open 2 more linked Foundations' }));
    const popover = screen.getByRole('dialog', { name: '2 more linked Foundations' });
    expect(within(popover).getAllByRole('heading').map(heading => heading.textContent)).toEqual([
      'Marriage Foundations',
      'Finances Foundations'
    ]);
    expect(within(popover).getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual([
      'Marriage: Communication',
      'Finances: Planning'
    ]);
  });
});
