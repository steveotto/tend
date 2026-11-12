import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RhythmCard } from '../src/components/Cards.tsx';
import { RhythmDetailsDialog } from '../src/components/RhythmDetailsDialog.tsx';
import { marriageFoundations, marriageRhythms } from '../src/domain/preview-data.ts';

afterEach(cleanup);

describe('shared Rhythm Foundation associations', () => {
  const foundation = marriageFoundations.find(item => item.id === 'connection')!;
  const linkedRhythm = {
    ...marriageRhythms.find(item => item.id === 'sample-marriage-prayer')!,
    primaryFoundationId: 'spiritual-growth',
    secondaryFoundationIds: ['connection']
  };

  it('shows named primary and supporting associations in the catalogue card', () => {
    render(
      <RhythmCard
        rhythm={linkedRhythm}
        foundations={marriageFoundations}
        variant="catalogue"
      />
    );

    expect(screen.getByRole('group', {
      name: `Foundations linked to ${linkedRhythm.title}`
    })).toBeTruthy();
    expect(screen.getByText('Primary · Spiritual Growth')).toBeTruthy();
    expect(screen.getByText(`Supporting · ${foundation.name}`)).toBeTruthy();
  });

  it('shows the same accessible association content on Today’s inline Rhythm card', () => {
    render(
      <RhythmDetailsDialog
        rhythm={linkedRhythm}
        foundations={marriageFoundations}
        inline
        onClose={() => undefined}
      />
    );

    const associations = screen.getByRole('group', {
      name: `Foundations linked to ${linkedRhythm.title}`
    });
    expect(associations.textContent).toContain('Primary · Spiritual Growth');
    expect(associations.textContent).toContain(`Supporting · ${foundation.name}`);
  });

  it('keeps duplicate and unresolved references visible to assistive technology', () => {
    const rhythm = {
      ...linkedRhythm,
      primaryFoundationId: '',
      secondaryFoundationIds: ['connection', 'deleted-foundation', 'connection']
    };
    render(
      <RhythmCard
        rhythm={rhythm}
        foundations={marriageFoundations}
        variant="catalogue"
      />
    );

    expect(screen.getAllByText(`Supporting · ${foundation.name}`)).toHaveLength(2);
    const statuses = screen.getAllByRole('status').map(status => status.textContent);
    expect(statuses).toContain('2 linked Foundation references could not be resolved.');
    expect(statuses).toContain('1 duplicate Foundation association reference was found.');
  });
});
