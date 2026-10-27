import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { marriageFoundations, marriageRhythms } from '../src/domain/preview-data.ts';
import { FoundationRhythmAssociationDialog } from '../src/components/FoundationRhythmAssociationDialog.tsx';

afterEach(cleanup);

describe('Foundation Rhythm association editor', () => {
  it('shows current selections and explicitly saves a draft role change', async () => {
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
    expect(within(dialog).getByText('Current selections')).toBeTruthy();
    expect(within(dialog).getAllByText('Daily Connection')).toHaveLength(2);
    expect(within(dialog).getAllByText('Date Night')).toHaveLength(2);

    await user.selectOptions(
      within(dialog).getByRole('combobox', {
        name: 'Association role for Dream Together, sample-marriage-dream'
      }),
      'supporting'
    );
    expect(onSave).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(expect.arrayContaining([
      { rhythmId: 'sample-marriage-dream', role: 'supporting' }
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
    const role = within(dialog).getByRole('combobox', {
      name: 'Association role for Dream Together, sample-marriage-dream'
    });
    await user.selectOptions(role, 'supporting');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('Preview storage is unavailable.');
    expect((role as HTMLSelectElement).value).toBe('supporting');
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
    expect(within(dialog).getByRole('combobox', {
      name: `Association role for ${rhythm.title}, ${rhythm.id}`
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
});
