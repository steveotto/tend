import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { RhythmCompletionDialog } from '../src/components/RhythmCompletionDialog.tsx';
import { RhythmCompletionForm } from '../src/components/RhythmCompletionForm.tsx';
import { RhythmDetailsDialog } from '../src/components/RhythmDetailsDialog.tsx';
import { RhythmHistoryView } from '../src/components/RhythmHistoryView.tsx';
import type { PersonPreview, RhythmPreview } from '../src/domain/preview-data.ts';
import type { DatedRhythmCompletion } from '../src/domain/rhythm-completion.ts';
import { todayRhythms } from '../src/domain/preview-data.ts';

afterEach(cleanup);

const people = [
  { id: 'account-person-north', displayName: 'Casey Example' },
  { id: 'account-person-south', displayName: 'Jamie Example' }
] satisfies readonly PersonPreview[];

const rhythm: RhythmPreview = {
  ...todayRhythms.find(item => item.id === 'sample-pray-together')!,
  personIds: people.map(person => person.id),
  alsoLogConnection: true
};

const existingRecord: DatedRhythmCompletion = {
  id: 'account-completion-existing',
  rhythmId: rhythm.id,
  effectiveDate: '2026-11-20',
  localTime: '10:10',
  timeZone: 'UTC',
  recordedAt: '2026-11-20T10:10:00.000Z',
  completedAt: '2026-11-20T10:10:00.000Z',
  memory: 'Existing note'
};

function keepOnlyJamie() {
  expect((screen.getByLabelText('Casey Example') as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText('Jamie Example') as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByLabelText('Casey Example'));
}

describe('Rhythm completion People wiring', () => {
  it('does not show fixture People when the People prop is omitted and reports unresolved associations', () => {
    const onSave = vi.fn(() => null);
    const onSaved = vi.fn();
    render(
      <RhythmCompletionForm
        rhythm={rhythm}
        onSave={onSave}
        onCancel={() => undefined}
        onSaved={onSaved}
      />
    );

    expect(screen.queryByLabelText('Avery Brooks')).toBeNull();
    expect(screen.queryByLabelText('Morgan Reed')).toBeNull();
    expect(screen.getByText('No People are available for this Rhythm.')).toBeTruthy();
    expect(screen.getByText('Some associated People are unavailable. Refresh People or skip this Connection.'))
      .toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent)
      .toBe('Some associated People are unavailable. Refresh People or skip this Connection.');

    fireEvent.click(screen.getByLabelText('Also log a connection'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ rhythmId: rhythm.id }), undefined);
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('passes stable selected account Person IDs from the standalone completion dialog', () => {
    const onSave = vi.fn(() => null);
    const onClose = vi.fn();
    render(
      <RhythmCompletionDialog
        rhythm={rhythm}
        people={people}
        onSave={onSave}
        onClose={onClose}
      />
    );

    keepOnlyJamie();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ rhythmId: rhythm.id }),
      ['account-person-south']
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('passes account People and actual participant IDs through the details completion entry point', () => {
    const onSave = vi.fn(() => null);
    const onClose = vi.fn();
    render(
      <RhythmDetailsDialog
        rhythm={rhythm}
        people={people}
        onSaveCompletion={onSave}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: `Tend ${rhythm.title}` }));
    const formDialog = screen.getByRole('dialog', { name: 'When did you tend it?' });
    keepOnlyJamie();
    fireEvent.click(within(formDialog).getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ rhythmId: rhythm.id }),
      ['account-person-south']
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('uses the persistent Log a moment dialog and forwards account participant IDs', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => null);
    render(
      <RhythmHistoryView
        rhythm={{ ...rhythm, completionHistory: [] }}
        people={people}
        completionHistoryAvailable
        onSaveCompletion={onSave}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Logged moments (0)' }));
    const opener = screen.getByRole('button', { name: '+ Log a moment' });
    await user.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Log a moment' });
    expect(within(dialog).getByRole('heading', { name: 'Log a moment' })).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: 'When did you tend it?' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Close Log a moment' })).toBeTruthy();
    keepOnlyJamie();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ rhythmId: rhythm.id }),
      ['account-person-south']
    );
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('opens the shared edit form for existing logged moments without fixture People', () => {
    const onUpdate = vi.fn(() => null);
    render(
      <RhythmHistoryView
        rhythm={rhythm}
        people={people}
        datedCompletions={[existingRecord]}
        completionHistoryAvailable
        onUpdateCompletion={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Logged moments (1)' }));
    fireEvent.click(screen.getByRole('button', { name: /^Edit logged moment/ }));

    expect(screen.getByRole('heading', { name: 'Edit logged moment' })).toBeTruthy();
    expect(screen.queryByLabelText('Avery Brooks')).toBeNull();
    expect(screen.queryByLabelText('Morgan Reed')).toBeNull();
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'Updated note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: existingRecord.id,
      rhythmId: rhythm.id,
      memory: 'Updated note'
    }));
  });
});
