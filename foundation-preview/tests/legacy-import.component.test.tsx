import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewDataControls } from '../src/components/PreviewDataControls.tsx';
import { createSamplePreviewData } from '../src/domain/preview-state.ts';
import type { PreviewData } from '../src/domain/preview-state.ts';
import { loadPreview, writePreview } from '../src/storage/preview-storage.ts';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderControls(onImport: (data: ReturnType<typeof createSamplePreviewData>) => string | null) {
  return render(
    <PreviewDataControls
      data={createSamplePreviewData()}
      status={{ kind: 'saved' }}
      currentDate="2026-10-31"
      onImport={onImport}
      onReset={() => null}
      onRetrySave={() => {}}
      onReloadExternal={() => null}
      onReplaceExternal={() => null}
    />
  );
}

describe('Classic Tend import controls', () => {
  it('does not save during dry run and imports the validated candidate once after explicit confirmation', async () => {
    const user = userEvent.setup();
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
      removeItem: (key: string) => { values.delete(key); }
    };
    const onImport = vi.fn((data: PreviewData) => {
      const saved = writePreview(storage, data, null, { currentDate: '2026-10-31' });
      return saved.kind === 'saved' ? null
        : saved.kind === 'error' ? saved.message
          : 'Preview storage changed before the import completed.';
    });
    const createObjectURL = vi.fn(() => 'blob:recovery-package');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderControls(onImport);

    const source = JSON.stringify({
      people: [
        { id: 'legacy-one', name: 'Taylor Example', area: 'marriage' },
        { id: 'legacy-two', name: 'Taylor Example', relation: 'Mentor' }
      ],
      prayers: [{ id: 'prayer-one', personId: 'legacy-one' }]
    });
    fireEvent.change(screen.getByLabelText('Dry-run Classic Tend import'), {
      target: { files: [new File([source], 'classic-export.json', { type: 'application/json' })] }
    });

    const dialog = await screen.findByRole('dialog', { name: 'Review Classic Tend import' });
    expect(within(dialog).getByText('Source People').parentElement?.querySelector('dd')?.textContent).toBe('2');
    expect(within(dialog).getByText('Converted People').parentElement?.querySelector('dd')?.textContent).toBe('2');
    expect(onImport).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Download migration recovery package' }));
    await user.click(within(dialog).getByRole('checkbox', {
      name: 'I understand unsupported records will not be imported.'
    }));
    await user.click(within(dialog).getByRole('button', { name: 'Import supported data' }));

    expect(onImport).toHaveBeenCalledOnce();
    expect(storage.setItem).toHaveBeenCalledOnce();
    const imported = onImport.mock.calls[0]![0];
    expect(imported.people.map(person => person.displayName)).toEqual(['Taylor Example', 'Taylor Example']);
    expect(imported.peopleGroups.find(group => group.id === 'marriage')?.memberIds).toEqual(['legacy-one']);
    expect(imported.people.map(person => person.id)).not.toContain('sample-person-avery');
    const reloaded = loadPreview(storage, '2026-10-31');
    expect(reloaded.kind).toBe('loaded');
    if (reloaded.kind === 'loaded') expect(reloaded.data.people).toEqual(imported.people);
    expect(screen.queryByRole('dialog', { name: 'Review Classic Tend import' })).toBeNull();
  });

  it('leaves the preview untouched when the dry run is cancelled', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn((_data: PreviewData) => null);
    renderControls(onImport);
    fireEvent.change(screen.getByLabelText('Dry-run Classic Tend import'), {
      target: {
        files: [new File([JSON.stringify({ people: [{ id: 'person-one', name: 'Person One' }] })],
          'classic-export.json', { type: 'application/json' })]
      }
    });
    const dialog = await screen.findByRole('dialog', { name: 'Review Classic Tend import' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Review Classic Tend import' })).toBeNull();
  });

  it('requires explicit acknowledgment and recovery download before importing a partial candidate', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn((_data: PreviewData) => null);
    const createObjectURL = vi.fn(() => 'blob:recovery-package');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderControls(onImport);

    const source = JSON.stringify({
      people: [{ id: 'person-one', name: 'Taylor' }],
      rhythms: [{ id: 'rhythm-one', text: 'Check in', freq: 'weekly', tod: 'anytime' }],
      events: [{
        id: 'orphan-prayer', type: 'prayer', kind: 'prayer',
        rhythmId: 'missing-rhythm', ts: Date.parse('2026-10-10T12:00:00Z')
      }]
    });
    fireEvent.change(screen.getByLabelText('Dry-run Classic Tend import'), {
      target: { files: [new File([source], 'classic-export.json', { type: 'application/json' })] }
    });

    const dialog = await screen.findByRole('dialog', { name: 'Review Classic Tend import' });
    expect(within(dialog).getByText('Excluded and preserved records').parentElement
      ?.querySelector('dd')?.textContent).toBe('1');
    expect(onImport).not.toHaveBeenCalled();
    const importButton = within(dialog).getByRole('button', { name: 'Import supported data' });
    expect(importButton.matches(':disabled')).toBe(true);

    await user.click(within(dialog).getByRole('button', { name: 'Download migration recovery package' }));
    await user.click(within(dialog).getByRole('checkbox', {
      name: 'I understand unsupported records will not be imported.'
    }));
    expect(importButton.matches(':disabled')).toBe(true);
    await user.click(within(dialog).getByRole('checkbox', {
      name: 'I understand these unresolved historical events will be excluded from this partial import.'
    }));
    expect(importButton.matches(':disabled')).toBe(false);
    await user.click(importButton);

    expect(onImport).toHaveBeenCalledOnce();
    expect(onImport.mock.calls[0]![0].people).toEqual([{ id: 'person-one', displayName: 'Taylor' }]);
    expect(onImport.mock.calls[0]![0].datedRhythmCompletions).toEqual([]);
    expect(screen.queryByRole('dialog', { name: 'Review Classic Tend import' })).toBeNull();
  });
});
