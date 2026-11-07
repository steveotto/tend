import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RhythmCategoryBadges } from '../src/components/RhythmCategoryBadges.tsx';
import { RhythmDetailsDialog } from '../src/components/RhythmDetailsDialog.tsx';
import { foundationCatalogue, todayRhythms } from '../src/domain/preview-data.ts';
import type { RhythmPreview } from '../src/domain/preview-data.ts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function linkedMultiCategoryRhythm(): RhythmPreview {
  return {
    ...todayRhythms[0]!,
    categoryIds: ['faith', 'health'],
    primaryFoundationId: 'faith-prayer',
    secondaryFoundationIds: ['faith-sabbath', 'health-cardio']
  };
}

function createRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({})
  };
}

describe('Rhythm category badges', () => {
  it('shows linked names on hover and focus, clamps the tooltip, dismisses with Escape, and activates directly', async () => {
    const user = userEvent.setup();
    const onOpenCategory = vi.fn();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('rhythm-area-tooltip')) return createRect(0, 0, 180, 40);
      if (this.classList.contains('rhythm-area-badge')) return createRect(280, 4, 44, 44);
      return createRect(0, 0, 0, 0);
    });

    render(
      <RhythmCategoryBadges
        rhythm={linkedMultiCategoryRhythm()}
        foundations={foundationCatalogue}
        onOpenCategory={onOpenCategory}
      />
    );

    const faith = screen.getByRole('button', { name: /Faith category and linked Practices/ });
    await user.hover(faith);
    expect(screen.getByRole('tooltip').textContent).toMatch(/^Faith · Practices: .*Prayer.*Sabbath|^Faith · Practices: .*Sabbath.*Prayer/);
    expect(screen.getByRole('tooltip').style.left).toBe('132px');
    expect(screen.getByRole('tooltip').style.top).toBe('56px');

    await user.unhover(faith);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await user.tab();
    expect(document.activeElement).toBe(faith);
    expect(screen.getByRole('tooltip').textContent).toMatch(/^Faith · Practices: .*Prayer.*Sabbath|^Faith · Practices: .*Sabbath.*Prayer/);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(document.activeElement).toBe(faith);

    const health = screen.getByRole('button', { name: /Health & Fitness category and linked Foundations/ });
    await user.click(health);
    expect(onOpenCategory).toHaveBeenCalledWith(
      'health',
      `rhythm-category-badge-${todayRhythms[0]!.id}-health`
    );
  });

  it('shows only the category name when no matching Foundation is linked', async () => {
    const user = userEvent.setup();
    const rhythm: RhythmPreview = {
      ...todayRhythms[0]!,
      categoryIds: ['faith'],
      primaryFoundationId: null,
      secondaryFoundationIds: []
    };
    const onOpenCategory = vi.fn();

    render(
      <RhythmCategoryBadges
        rhythm={rhythm}
        foundations={foundationCatalogue}
        onOpenCategory={onOpenCategory}
      />
    );
    const faith = screen.getByRole('button', { name: 'Faith' });
    expect(faith.getAttribute('data-tooltip')).toBe('Faith');
    await user.hover(faith);
    expect(screen.getByRole('tooltip').textContent).toBe('Faith');
  });

  it('groups visible linked Practice and Foundation names by category in Rhythm details', async () => {
    const user = userEvent.setup();
    const rhythm = linkedMultiCategoryRhythm();
    const onOpenCategory = vi.fn();

    render(
      <RhythmDetailsDialog
        rhythm={rhythm}
        foundations={foundationCatalogue}
        embedded
        onOpenCategory={onOpenCategory}
        onClose={() => undefined}
      />
    );

    const details = screen.getByRole('region', { name: rhythm.title });
    const faithGroup = within(details).getByRole('group', {
      name: 'Faith category and linked Practices'
    });
    const healthGroup = within(details).getByRole('group', {
      name: 'Health & Fitness category and linked Foundations'
    });
    expect(within(faithGroup).getByRole('list', { name: 'Faith linked Practices' }).textContent)
      .toContain('Prayer');
    expect(within(faithGroup).getByRole('list', { name: 'Faith linked Practices' }).textContent)
      .toContain('Sabbath');
    expect(within(healthGroup).getByRole('list', {
      name: 'Health & Fitness linked Foundations'
    }).textContent).toContain('Cardio');

    await user.click(within(details).getByRole('button', {
      name: /Faith category and linked Practices/
    }));
    expect(onOpenCategory).toHaveBeenCalledWith(
      'faith',
      `rhythm-category-badge-${rhythm.id}-faith`
    );
  });
});
