import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { faithPractices, marriageFoundations, marriageRhythms } from '../src/domain/preview-data.ts';
import { FoundationRhythmAssociationDialog } from '../src/components/FoundationRhythmAssociationDialog.tsx';

afterEach(cleanup);

describe('Foundation Rhythm association editor', () => {
  it('manages Faith Practice links through the shared binary association dialog', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    const rhythm = {
      ...marriageRhythms[0]!,
      id: 'user-rhythm-faith-association',
      title: 'Quiet prayer',
      categoryIds: ['faith'] as const,
      primaryFoundationId: null,
      secondaryFoundationIds: []
    };
    render(
      <FoundationRhythmAssociationDialog
        foundation={faithPractices[1]!}
        rhythms={[{ rhythm, archived: false }]}
        onSave={onSave}
        onClose={() => undefined}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Linked Rhythms' });
    expect(within(dialog).getByRole('group', { name: 'Faith Rhythms' })).toBeTruthy();
    const checkbox = within(dialog).getByRole('checkbox', { name: /Quiet prayer/ });
    await user.click(checkbox);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith([
      { rhythmId: 'user-rhythm-faith-association', linked: true }
    ]);
  });

  it('uses Practice terminology for Faith link management without a separate dialog', () => {
    render(
      <FoundationRhythmAssociationDialog
        foundation={faithPractices[1]!}
        rhythms={[]}
        onSave={() => null}
        onClose={() => undefined}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Linked Rhythms' });
    expect(within(dialog).getByText('Choose the Rhythms that support this Practice.')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Close Practice associations' })).toBeTruthy();
    expect(within(dialog).getByText('Add a Faith Rhythm from the Rhythms tab. Then choose it here.')).toBeTruthy();
    expect(dialog.textContent).not.toContain('Foundation');
  });

  it('shows the shared header and one eligible-Rhythm list, preserving explicit binary saves', async () => {
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

    const dialog = screen.getByRole('dialog', { name: 'Linked Rhythms' });
    expect(within(dialog).getByText('Connection', { selector: '.money-goal-dialog__eyebrow' })).toBeTruthy();
    expect(within(dialog).getByText('Choose the rhythms that support Connection.')).toBeTruthy();
    expect(within(dialog).queryByText('Current selections')).toBeNull();
    expect(within(dialog).getAllByText('Daily Connection')).toHaveLength(1);
    expect(within(dialog).getAllByText('Date Night')).toHaveLength(1);
    expect(within(dialog).getByRole('group', { name: 'Marriage Rhythms' })).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close Foundation associations' }));
    const dailyConnection = within(dialog).getByRole('checkbox', { name: /Daily Connection/ });
    const dateNight = within(dialog).getByRole('checkbox', { name: /Date Night/ });
    expect((dailyConnection as HTMLInputElement).checked).toBe(true);
    expect((dateNight as HTMLInputElement).checked).toBe(true);
    expect((within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).queryByText(/Primary|Supporting/)).toBeNull();
    expect(dialog.textContent).not.toContain('sample-marriage-connection');

    await user.click(dailyConnection);
    expect((dailyConnection as HTMLInputElement).checked).toBe(false);
    expect((within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
    await user.click(dailyConnection);
    expect((dailyConnection as HTMLInputElement).checked).toBe(true);
    expect((within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);

    const dreamTogether = within(dialog).getByRole('checkbox', { name: /Dream Together/ });
    expect((dreamTogether as HTMLInputElement).checked).toBe(false);
    await user.click(dreamTogether);
    expect((within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(expect.arrayContaining([
      { rhythmId: 'sample-marriage-dream', linked: true }
    ]));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows one centered icon empty state and disables Save when there are no eligible Rhythms', () => {
    render(
      <FoundationRhythmAssociationDialog
        foundation={marriageFoundations.find(item => item.id === 'connection')!}
        rhythms={[]}
        onSave={() => null}
        onClose={() => undefined}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Linked Rhythms' });
    expect(within(dialog).getByText('Connection', { selector: '.money-goal-dialog__eyebrow' })).toBeTruthy();
    expect(within(dialog).getByText('Choose the rhythms that support Connection.')).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: 'No rhythms to link yet' })).toBeTruthy();
    expect(within(dialog).getByText('Add a Marriage rhythm from the Rhythms tab. Then choose it here.')).toBeTruthy();
    expect(dialog.querySelector('.foundation-association-empty-state__icon .marriage-svg-icon')).toBeTruthy();
    expect(within(dialog).queryByRole('group')).toBeNull();
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    expect((within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeTruthy();
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

    const dialog = screen.getByRole('dialog', { name: 'Linked Rhythms' });
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

    let dialog = screen.getByRole('dialog', { name: 'Linked Rhythms' });
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
    dialog = screen.getByRole('dialog', { name: 'Linked Rhythms' });
    expect(within(dialog).getByRole('heading', { name: 'No rhythms to link yet' })).toBeTruthy();
    expect(within(dialog).getByText('Add a Marriage rhythm from the Rhythms tab. Then choose it here.')).toBeTruthy();
    expect(within(dialog).queryByText('Dream Together')).toBeNull();
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
    fireEvent(screen.getByRole('dialog', { name: 'Linked Rhythms' }), new Event('cancel'));
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

    const dialog = screen.getByRole('dialog', { name: 'Linked Rhythms' });
    expect(within(dialog).getAllByRole('checkbox', { name: /Daily Connection/ })).toHaveLength(2);
    expect(dialog.textContent).toContain('5 times a week · Anytime');
    expect(dialog.textContent).toContain('Daily · Evening');
    expect(within(dialog).getAllByText('Daily Connection')).toHaveLength(2);
    expect((within(dialog).getAllByRole('checkbox', { name: /5 times a week/ })[0] as HTMLInputElement).checked).toBe(true);
    expect(dialog.textContent).not.toContain('sample-marriage-connection');
    expect(dialog.textContent).not.toContain('sample-marriage-prayer');
  });
});
