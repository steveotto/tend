import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { marriageFoundations, marriageRhythms } from '../src/domain/preview-data.ts';
import { FoundationRhythmAssociationDialog } from '../src/components/FoundationRhythmAssociationDialog.tsx';

afterEach(cleanup);

describe('Foundation Rhythm association editor', () => {
  it('shows existing links checked without roles and explicitly saves a draft change', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    const onClose = vi.fn();
    render(
      <FoundationRhythmAssociationDialog
        foundation={marriageFoundations.find(item => item.id === 'connection')!}
        rhythms={marriageRhythms.map(rhythm => ({ rhythm, archived: false }))}
        onSave={onSave}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Manage Rhythms for Connection' });
    expect(within(dialog).getByText('Choose the rhythms that support this Foundation.')).toBeTruthy();
    expect(within(dialog).getByText('Current selections')).toBeTruthy();
    expect(within(dialog).getAllByText('Daily Connection')).toHaveLength(2);
    expect(within(dialog).getAllByText('Date Night')).toHaveLength(2);
    const dailyConnection = within(dialog).getByRole('checkbox', { name: /Daily Connection/ });
    const dateNight = within(dialog).getByRole('checkbox', { name: /Date Night/ });
    expect((dailyConnection as HTMLInputElement).checked).toBe(true);
    expect((dateNight as HTMLInputElement).checked).toBe(true);
    expect(within(dialog).queryByText(/Primary|Supporting/)).toBeNull();
    expect(dialog.textContent).not.toContain('sample-marriage-connection');

    const dreamTogether = within(dialog).getByRole('checkbox', { name: /Dream Together/ });
    expect((dreamTogether as HTMLInputElement).checked).toBe(false);
    await user.click(dreamTogether);
    expect(
      within(dialog.querySelector('.foundation-association-current')!).getByText('Dream Together')
    ).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(expect.arrayContaining([
      { rhythmId: 'sample-marriage-dream', linked: true }
    ]));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('retains the draft when saving fails and supports cancel and Escape', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => 'Preview storage is unavailable.');
    const onClose = vi.fn();
    render(
      <FoundationRhythmAssociationDialog
        foundation={marriageFoundations.find(item => item.id === 'connection')!}
        rhythms={marriageRhythms.map(rhythm => ({ rhythm, archived: false }))}
        onSave={onSave}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Manage Rhythms for Connection' });
    const checkbox = within(dialog).getByRole('checkbox', { name: /Dream Together/ });
    await user.click(checkbox);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('Preview storage is unavailable.');
    expect((checkbox as HTMLInputElement).checked).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps archived selections visible but read-only and explains an empty eligible list', () => {
    const onSave = vi.fn(() => null);
    const onClose = vi.fn();
    const rhythm = marriageRhythms[0]!;
    const { rerender } = render(
      <FoundationRhythmAssociationDialog
        foundation={marriageFoundations.find(item => item.id === 'connection')!}
        rhythms={[{ rhythm, archived: true }]}
        onSave={onSave}
        onClose={onClose}
      />
    );

    let dialog = screen.getByRole('dialog', { name: 'Manage Rhythms for Connection' });
    expect(within(dialog).getByText(/Archived · restore before changing/)).toBeTruthy();
    expect(within(dialog).getByRole('checkbox', {
      name: new RegExp(rhythm.title)
    }).hasAttribute('disabled')).toBe(true);

    rerender(
      <FoundationRhythmAssociationDialog
        foundation={marriageFoundations.find(item => item.id === 'connection')!}
        rhythms={[]}
        onSave={onSave}
        onClose={onClose}
      />
    );
    dialog = screen.getByRole('dialog', { name: 'Manage Rhythms for Connection' });
    expect(within(dialog).getByText('No synthetic Marriage Rhythms are available in this example.')).toBeTruthy();
    expect(within(dialog).getByText('No Rhythms currently support this Foundation.')).toBeTruthy();
  });

  it('closes on the dialog cancel event', () => {
    const onSave = vi.fn(() => null);
    const onClose = vi.fn();
    render(
      <FoundationRhythmAssociationDialog
        foundation={marriageFoundations.find(item => item.id === 'connection')!}
        rhythms={[]}
        onSave={onSave}
        onClose={onClose}
      />
    );
    fireEvent(screen.getByRole('dialog', { name: 'Manage Rhythms for Connection' }), new Event('cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows meaningful schedule metadata without exposing duplicate-title IDs', () => {
    const duplicateTitle = {
      ...marriageRhythms.find(rhythm => rhythm.id === 'sample-marriage-prayer')!,
      title: 'Daily Connection',
      primaryFoundationId: null,
      secondaryFoundationIds: []
    };
    const duplicatedReferences = {
      ...marriageRhythms[0]!,
      secondaryFoundationIds: ['communication', 'connection', 'connection']
    };
    render(
      <FoundationRhythmAssociationDialog
        foundation={marriageFoundations.find(item => item.id === 'connection')!}
        rhythms={[
          { rhythm: duplicatedReferences, archived: false },
          { rhythm: duplicateTitle, archived: false }
        ]}
        onSave={() => null}
        onClose={() => undefined}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Manage Rhythms for Connection' });
    expect(within(dialog).getAllByRole('checkbox', { name: /Daily Connection/ })).toHaveLength(2);
    expect(dialog.textContent).toContain('5 times a week · Anytime');
    expect(dialog.textContent).toContain('Daily · Evening');
    const currentSelections = within(dialog.querySelector('.foundation-association-current')!);
    expect(currentSelections.getAllByText('Daily Connection')).toHaveLength(1);
    expect((within(dialog).getAllByRole('checkbox', { name: /5 times a week/ })[0] as HTMLInputElement).checked).toBe(true);
    expect(dialog.textContent).not.toContain('sample-marriage-connection');
    expect(dialog.textContent).not.toContain('sample-marriage-prayer');
  });
});
