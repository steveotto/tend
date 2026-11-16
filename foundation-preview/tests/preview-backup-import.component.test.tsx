import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewBackupImportControl } from '../src/components/PreviewBackupImportControl.tsx';
import type { PreviewPersistenceStatus } from '../src/components/PreviewDataControls.tsx';
import {
  createPreviewEnvelope,
  createSamplePreviewData,
  parsePreviewBackup
} from '../src/domain/preview-state.ts';

const currentDate = '2026-11-04';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function installDownloadMocks() {
  const blobs: Blob[] = [];
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:backup-${blobs.length}`;
    }),
    revokeObjectURL: vi.fn()
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return blobs;
}

describe('Preview backup recovery controls', () => {
  it('downloads the exact saved source and current in-memory state when persistence has failed', async () => {
    const user = userEvent.setup();
    const blobs = installDownloadMocks();
    const data = createSamplePreviewData();
    const firstGoal = data.goals[0];
    if (!firstGoal) throw new Error('Synthetic preview fixture is missing a goal.');
    data.goals[0] = { ...firstGoal, title: 'Unsaved synthetic goal' };
    const savedSource = '{ "synthetic": "invalid saved source" }';
    const onImport = vi.fn(() => null);
    const status: PreviewPersistenceStatus = {
      kind: 'error',
      message: 'Synthetic durable write failure'
    };

    render(
      <PreviewBackupImportControl
        data={data}
        status={status}
        currentDate={currentDate}
        currentRaw={savedSource}
        onImport={onImport}
        showExport
        presentation="recovery"
        accountScoped
      />
    );

    await user.click(screen.getByRole('button', { name: /Download exact saved source/ }));
    await user.click(screen.getByRole('button', { name: /Download current in-memory state/ }));

    expect(blobs).toHaveLength(2);
    expect(await blobs[0]!.text()).toBe(savedSource);
    const exported = parsePreviewBackup(await blobs[1]!.text(), currentDate);
    expect(exported.valid).toBe(true);
    if (exported.valid) expect(exported.envelope.data).toEqual(data);
    expect(onImport).not.toHaveBeenCalled();
  });

  it('validates a repaired duplicate before showing confirmation and preserves the saved source before import', async () => {
    const user = userEvent.setup();
    const blobs = installDownloadMocks();
    const repairedData = createSamplePreviewData();
    const repairedRaw = JSON.stringify(createPreviewEnvelope(repairedData), null, 2);
    const savedSource = '{ "synthetic": "invalid saved source" }';
    const onImport = vi.fn(() => null);

    render(
      <PreviewBackupImportControl
        data={createSamplePreviewData()}
        status={{ kind: 'corrupt', message: 'Synthetic validation failure', raw: savedSource }}
        currentDate={currentDate}
        currentRaw={savedSource}
        onImport={onImport}
        showExport
        presentation="recovery"
        accountScoped
      />
    );

    await user.upload(
      screen.getByLabelText('Import backup'),
      new File([repairedRaw], 'synthetic-repaired-copy.json', { type: 'application/json' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Replace data on this device?' });
    expect(within(dialog).getByRole('button', { name: 'Replace with backup' })).toBeTruthy();
    expect(onImport).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Replace with backup' }));

    expect(onImport).toHaveBeenCalledWith(repairedData, repairedRaw);
    expect(await blobs[0]!.text()).toBe(savedSource);
    expect(await screen.findByText('Backup imported on this device.')).toBeTruthy();
  });

  it('rejects an invalid duplicate before confirmation or invoking the import callback', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn(() => null);

    render(
      <PreviewBackupImportControl
        data={createSamplePreviewData()}
        status={{ kind: 'error', message: 'Synthetic durable write failure' }}
        currentDate={currentDate}
        currentRaw={'{"synthetic":'}
        onImport={onImport}
        showExport
        presentation="recovery"
        accountScoped
      />
    );

    await user.upload(
      screen.getByLabelText('Import backup'),
      new File(['{"synthetic":'], 'synthetic-invalid-copy.json', { type: 'application/json' })
    );

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onImport).not.toHaveBeenCalled();
  });
});
