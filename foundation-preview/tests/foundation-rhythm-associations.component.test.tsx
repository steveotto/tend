import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FoundationRhythmAssociationDialog } from '../src/components/FoundationRhythmAssociationDialog.tsx';
import { marriageFoundations, marriageRhythms } from '../src/domain/preview-data.ts';

afterEach(cleanup);

describe('Foundation Rhythm association editor', () => {
  it('saves an explicit role choice for a synthetic Rhythm', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    const onClose = vi.fn();
    const foundation = marriageFoundations.find(item => item.id === 'connection')!;
    render(
      <FoundationRhythmAssociationDialog
        foundation={foundation}
        rhythms={marriageRhythms.map(rhythm => ({ rhythm, archived: false }))}
        onSave={onSave}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole('dialog', { name: `Manage Rhythms for ${foundation.name}` });
    const rhythm = marriageRhythms.find(item => item.id === 'sample-marriage-prayer')!;
    await user.selectOptions(
      within(dialog).getByRole('combobox', {
        name: `Association role for ${rhythm.title}, ${rhythm.id}`
      }),
      'supporting'
    );
    expect(onSave).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(expect.arrayContaining([
      { rhythmId: rhythm.id, role: 'supporting' }
    ]));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps the draft and reports save errors; archived choices stay read-only', async () => {
    const user = userEvent.setup();
    const rhythm = marriageRhythms[0]!;
    const onSave = vi.fn(() => 'Preview storage is unavailable.');
    const onClose = vi.fn();
    render(
      <FoundationRhythmAssociationDialog
        foundation={marriageFoundations.find(item => item.id === 'connection')!}
        rhythms={[{ rhythm, archived: true }]}
        onSave={onSave}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Manage Rhythms for Connection' });
    const select = within(dialog).getByRole('combobox', {
      name: `Association role for ${rhythm.title}, ${rhythm.id}`
    });
    expect(select.hasAttribute('disabled')).toBe(true);
    expect(within(dialog).getByText(/Archived · restore before changing/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('Preview storage is unavailable.');
    expect(onClose).not.toHaveBeenCalled();
  });
});
