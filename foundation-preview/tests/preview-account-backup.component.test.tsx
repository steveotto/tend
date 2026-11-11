import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviewAccountBackupControls } from '../src/components/PreviewAccountBackupControls.tsx';
import {
  createPreviewEnvelope,
  createSamplePreviewData,
  PREVIEW_SCHEMA_VERSION
} from '../src/domain/preview-state.ts';
import type { PreviewData, PreviewEnvelope } from '../src/domain/preview-state.ts';
import type { SavedRhythm } from '../src/domain/rhythm-editor.ts';
import {
  createPreviewAccountBackupApi,
  createValidatedPreviewAccountDocument,
  PreviewAccountBackupError,
  previewEnvelopesEqual
} from '../src/storage/preview-account-backup.ts';
import type {
  PreviewAccountBackupApi,
  PreviewAccountBackupRecord
} from '../src/storage/preview-account-backup.ts';
import {
  loadPreview,
  PREVIEW_CLOUD_RESTORE_RECOVERY_KEY,
  PREVIEW_STORAGE_KEY,
  preservePreviewBeforeCloudRestore,
  writePreview
} from '../src/storage/preview-storage.ts';
import type { PreviewStorage } from '../src/storage/preview-storage.ts';
import { installMemoryStorage } from './memory-storage.ts';

const currentDate = '2026-11-04';
const accountA = 'a0000000-0000-4000-8000-000000000001';
const accountB = 'b0000000-0000-4000-8000-000000000002';

beforeEach(installMemoryStorage);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

function fitnessData(label: string): PreviewData {
  const data = createSamplePreviewData();
  const firstPerson = data.people[0];
  if (!firstPerson) throw new Error('Synthetic preview fixture is missing its first person.');
  data.people[0] = { ...firstPerson, displayName: label };
  const slug = label.toLowerCase().replaceAll(' ', '-');
  const rhythmId = 'user-rhythm-84000000-0000-4000-8000-000000000022';
  const completionId = `workout-completion-${slug}`;
  const rhythm: SavedRhythm = {
    id: rhythmId,
    title: `${label} strength benchmark`,
    cadence: 'Daily',
    timeLabel: 'Anytime',
    timeOfDay: 'anytime',
    personIds: [],
    categoryIds: ['health'],
    schedule: { frequency: 'daily' },
    primaryFoundationId: null,
    secondaryFoundationIds: [],
    healthLogCapability: 'workout'
  };
  data.savedRhythms = [rhythm];
  data.rhythmHistoryIds = [rhythmId];
  data.completedRhythmIds = [rhythmId];
  data.activeRhythmCompletions = [{ rhythmId, completionId }];
  data.datedRhythmCompletions = [{
    id: completionId,
    rhythmId,
    effectiveDate: currentDate,
    localTime: '15:00',
    timeZone: 'UTC',
    completedAt: `${currentDate}T15:00:00.000Z`,
    recordedAt: `${currentDate}T15:00:00.000Z`
  }];
  data.strength.workouts = [{
    id: `strength-log-${slug}`,
    date: currentDate,
    muscleIds: ['chest'],
    rhythmId,
    rhythmOccurrence: currentDate,
    completionId
  }];
  data.timeBlocks.sleepStart = '23:15';
  return data;
}

function accountStorage(data: PreviewData) {
  const values = new Map<string, string>([
    [PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(data))]
  ]);
  const storage: PreviewStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  return { storage, values, raw: values.get(PREVIEW_STORAGE_KEY)! };
}

function accountBackupRecord(document: PreviewEnvelope, revision: number): PreviewAccountBackupRecord {
  return {
    document,
    schemaVersion: PREVIEW_SCHEMA_VERSION,
    revision,
    updatedAt: '2026-11-04T12:00:00.000Z'
  };
}

function memoryBackend() {
  const records = new Map<string, PreviewAccountBackupRecord>();
  const apiFor = (accountId: string): PreviewAccountBackupApi => ({
    read: async () => records.get(accountId) ?? null,
    save: async (document, expectedRevision) => {
      const current = records.get(accountId);
      if ((current?.revision ?? 0) !== expectedRevision) {
        throw new PreviewAccountBackupError('stale', 'The account backup changed.');
      }
      const revision = expectedRevision + 1;
      records.set(accountId, accountBackupRecord(document, revision));
      return revision;
    }
  });
  return { records, apiFor };
}

function renderControls(
  api: PreviewAccountBackupApi | null,
  storage: PreviewStorage,
  data: PreviewData,
  localRaw: string,
  onRestore?: (data: PreviewData, expectedRaw: string | null) => string | null,
  isIdentityCurrent: () => boolean = () => true,
  accountId = accountA,
  openAdvanced = true
) {
  const view = render(
    <PreviewAccountBackupControls
      api={api}
      accountId={accountId}
      storage={storage}
      data={data}
      currentDate={currentDate}
      localRaw={localRaw}
      localRecoveryRaw={storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)}
      enabled
      isIdentityCurrent={isIdentityCurrent}
      onRestore={onRestore ?? ((nextData, expectedRaw) => {
        const result = writePreview(storage, nextData, expectedRaw, {
          currentDate,
          operation: 'replace'
        });
        return result.kind === 'saved'
          ? null
          : result.kind === 'error'
            ? result.message
            : 'Local preview changed.';
      })}
      onRecoveryChanged={() => {}}
    />
  );
  if (openAdvanced) {
    fireEvent.click(screen.getByRole('button', { name: /Advanced recovery/ }));
  }
  return view;
}

describe('manual Preview account backup and restore', () => {
  it('keeps technical account status collapsed inside advanced recovery', async () => {
    const backend = memoryBackend();
    const data = fitnessData('Status');
    const local = accountStorage(data);
    backend.records.set(accountA, accountBackupRecord(createPreviewEnvelope(data), 3));

    renderControls(backend.apiFor(accountA), local.storage, data, local.raw);

    const details = screen.getByText('Technical details').closest('details');
    expect(details?.hasAttribute('open')).toBe(false);
    fireEvent.click(screen.getByText('Technical details'));
    expect(await screen.findByText(/Last updated .*revision 3\./)).toBeTruthy();
    expect(screen.queryByText(/Signed-in account ending in/)).toBeNull();
  });

  it('clearly disables account operations when the authenticated backup API is unavailable', () => {
    const data = fitnessData('Unavailable');
    const local = accountStorage(data);

    renderControls(null, local.storage, data, local.raw, undefined, () => true, accountB);

    expect(screen.getByRole('alert').textContent).toMatch(/not configured/i);
    expect(screen.getByRole('button', { name: /Save this device’s copy to account/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /Replace this device’s data with account copy/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText(/Signed-in account ending in/)).toBeNull();
  });

  it('downloads the validated current account document through one read without changing either copy', async () => {
    const user = userEvent.setup();
    const backend = memoryBackend();
    const accountData = fitnessData('Preserved cloud');
    const record = accountBackupRecord(createPreviewEnvelope(accountData), 7);
    backend.records.set(accountA, record);
    const localData = fitnessData('Unchanged device');
    const local = accountStorage(localData);
    const api = backend.apiFor(accountA);
    const read = vi.spyOn(api, 'read');
    const save = vi.spyOn(api, 'save');
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:account-backup');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderControls(api, local.storage, localData, local.raw);
    fireEvent.click(screen.getByText('Technical details'));
    await screen.findByText(/Last updated .*revision 7\./);
    read.mockClear();
    await user.click(screen.getByRole('button', { name: /Download account copy/ }));

    await screen.findByText('The account copy was downloaded. No account data was changed.');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(JSON.parse(await (blob as Blob).text())).toEqual(record.document);
    expect(click).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(backend.records.get(accountA)).toEqual(record);
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
  });

  it('backs up in one browser and restores Rhythms, settings and a linked workout exactly once in another', async () => {
    const user = userEvent.setup();
    const backend = memoryBackend();
    const firstData = fitnessData('First browser');
    const first = accountStorage(firstData);

    renderControls(backend.apiFor(accountA), first.storage, firstData, first.raw);
    await user.click(screen.getByRole('button', { name: /Save this device’s copy to account/ }));
    await screen.findByText('This device’s data was saved to your account.');
    expect(backend.records.get(accountA)?.revision).toBe(1);

    cleanup();
    const secondData = fitnessData('Second browser');
    const second = accountStorage(secondData);
    const exactOriginalLocalRaw = second.raw;
    renderControls(backend.apiFor(accountA), second.storage, secondData, second.raw);
    await user.click(screen.getByRole('button', { name: /Replace this device’s data with account copy/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Replace this device’s data?' });
    expect(dialog.textContent).toContain('replaces local data with the account copy');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(second.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(exactOriginalLocalRaw);
    expect(backend.records.get(accountA)?.revision).toBe(1);

    await user.click(screen.getByRole('button', { name: /Replace this device’s data with account copy/ }));
    const confirmation = await screen.findByRole('dialog', { name: 'Replace this device’s data?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Replace this device’s data' }));
    await screen.findByText(/The account copy replaced this device’s data/);

    expect(second.storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBe(exactOriginalLocalRaw);
    const restored = loadPreview(second.storage, currentDate);
    expect(restored.kind).toBe('loaded');
    if (restored.kind !== 'loaded') return;
    expect(restored.data.people[0]?.displayName).toBe('First browser');
    expect(restored.data.timeBlocks.sleepStart).toBe('23:15');
    expect(restored.data.savedRhythms).toHaveLength(1);
    expect(restored.data.strength.workouts).toHaveLength(1);
    expect(restored.data.datedRhythmCompletions).toHaveLength(1);
    expect(restored.data.activeRhythmCompletions).toHaveLength(1);
    expect(restored.data.strength.workouts[0]?.completionId)
      .toBe(restored.data.datedRhythmCompletions[0]?.id);
  });

  it('requires an explicit choice before updating a different existing account backup', async () => {
    const user = userEvent.setup();
    const backend = memoryBackend();
    const previousData = fitnessData('Previous cloud');
    const nextData = fitnessData('Current browser');
    backend.records.set(accountA, accountBackupRecord(createPreviewEnvelope(previousData), 1));
    const local = accountStorage(nextData);
    renderControls(backend.apiFor(accountA), local.storage, nextData, local.raw);

    await user.click(screen.getByRole('button', { name: /Save this device’s copy to account/ }));
    const firstConfirmation = await screen.findByRole('dialog', { name: 'Replace account copy?' });
    expect(firstConfirmation.textContent).toContain('These copies differ.');
    await user.click(within(firstConfirmation).getByRole('button', { name: 'Cancel' }));
    expect(backend.records.get(accountA)?.revision).toBe(1);
    expect(backend.records.get(accountA)?.document).toEqual(createPreviewEnvelope(previousData));

    await user.click(screen.getByRole('button', { name: /Save this device’s copy to account/ }));
    const secondConfirmation = await screen.findByRole('dialog', { name: 'Replace account copy?' });
    await user.click(within(secondConfirmation).getByRole('button', { name: 'Replace account copy' }));

    await screen.findByText('The account copy was updated.');
    expect(backend.records.get(accountA)?.revision).toBe(2);
    expect(backend.records.get(accountA)?.document).toEqual(createPreviewEnvelope(nextData));
  });

  it('keeps synthetic accounts isolated and refuses to replace a cloud copy that changed after confirmation', async () => {
    const user = userEvent.setup();
    const backend = memoryBackend();
    const firstData = fitnessData('Account A');
    const secondData = fitnessData('Account B');
    const first = accountStorage(firstData);
    const second = accountStorage(secondData);

    renderControls(backend.apiFor(accountA), first.storage, firstData, first.raw);
    await user.click(screen.getByRole('button', { name: /Save this device’s copy to account/ }));
    await screen.findByText('This device’s data was saved to your account.');
    expect(await backend.apiFor(accountB).read()).toBeNull();
    cleanup();

    const changedLocalData = fitnessData('New local copy');
    const changedLocal = accountStorage(changedLocalData);
    renderControls(backend.apiFor(accountA), changedLocal.storage, changedLocalData, changedLocal.raw);
    await user.click(screen.getByRole('button', { name: /Save this device’s copy to account/ }));
    const confirmation = await screen.findByRole('dialog', { name: 'Replace account copy?' });
    expect(confirmation.textContent).toContain('replaces the account copy with this device’s saved data');
    backend.records.set(
      accountA,
      accountBackupRecord(createPreviewEnvelope(secondData), 2)
    );
    await user.click(within(confirmation).getByRole('button', { name: 'Replace account copy' }));

    await screen.findByRole('alert');
    expect(backend.records.get(accountA)?.revision).toBe(2);
    expect(backend.records.get(accountA)?.document).toEqual(createPreviewEnvelope(secondData));
    expect(changedLocal.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(changedLocal.raw);
    expect(await backend.apiFor(accountB).read()).toBeNull();
    expect(second.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(second.raw);
  });

  it('does not replace local data if the cloud revision changes after restore confirmation', async () => {
    const user = userEvent.setup();
    const backend = memoryBackend();
    const remoteData = fitnessData('Remote');
    backend.records.set(accountA, accountBackupRecord(createPreviewEnvelope(remoteData), 1));
    const localData = fitnessData('Local');
    const local = accountStorage(localData);

    renderControls(backend.apiFor(accountA), local.storage, localData, local.raw);
    await user.click(screen.getByRole('button', { name: /Replace this device’s data with account copy/ }));
    const confirmation = await screen.findByRole('dialog', { name: 'Replace this device’s data?' });
    backend.records.set(accountA, accountBackupRecord(createPreviewEnvelope(fitnessData('New remote')), 2));
    await user.click(within(confirmation).getByRole('button', { name: 'Replace this device’s data' }));

    await screen.findByRole('alert');
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
    expect(local.storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBeNull();
  });

  it('abandons an in-flight restore when the signed-in account changes', async () => {
    const user = userEvent.setup();
    const remoteData = fitnessData('Account A');
    let resolveRead: ((record: PreviewAccountBackupRecord) => void) | null = null;
    let accountIsCurrent = true;
    const api: PreviewAccountBackupApi = {
      read: () => new Promise(resolve => {
        resolveRead = resolve;
      }),
      save: vi.fn(async () => 1)
    };
    const localData = fitnessData('Account B local');
    const local = accountStorage(localData);

    renderControls(api, local.storage, localData, local.raw, undefined, () => accountIsCurrent);
    await user.click(screen.getByRole('button', { name: /Replace this device’s data with account copy/ }));
    accountIsCurrent = false;
    await act(async () => {
      resolveRead?.(accountBackupRecord(createPreviewEnvelope(remoteData), 1));
      await Promise.resolve();
    });
    expect(screen.queryByRole('dialog', { name: 'Replace this device’s data?' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Advanced recovery' })).toBeTruthy();
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
    expect(local.storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBeNull();
  });

  it('does not report restore success or replace local data when the recovery snapshot cannot be written', async () => {
    const user = userEvent.setup();
    const backend = memoryBackend();
    const remoteData = fitnessData('Remote');
    backend.records.set(accountA, accountBackupRecord(createPreviewEnvelope(remoteData), 1));
    const localData = fitnessData('Local');
    const local = accountStorage(localData);
    const failingStorage: PreviewStorage = {
      getItem: key => local.storage.getItem(key),
      setItem: (key, value) => {
        if (key === PREVIEW_STORAGE_KEY) throw new Error('simulated replacement failure');
        local.storage.setItem(key, value);
      }
    };

    renderControls(backend.apiFor(accountA), failingStorage, localData, local.raw);
    await user.click(screen.getByRole('button', { name: /Replace this device’s data with account copy/ }));
    const confirmation = await screen.findByRole('dialog', { name: 'Replace this device’s data?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Replace this device’s data' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be saved on this device/i);
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
    expect(local.storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBe(local.raw);
    expect(screen.queryByText(/The account copy replaced this device’s data/)).toBeNull();
  });

  it('leaves both copies unchanged when reading the account fails', async () => {
    const user = userEvent.setup();
    const data = fitnessData('Network failure');
    const local = accountStorage(data);
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => {
        throw new Error('simulated network failure');
      }),
      save: vi.fn(async () => 1)
    };

    renderControls(api, local.storage, data, local.raw);
    await user.click(screen.getByRole('button', { name: /Replace this device’s data with account copy/ }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/simulated network failure/i);
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
    expect(api.save).not.toHaveBeenCalled();
  });

  it('leaves the previous account backup and browser data intact when saving fails before commit', async () => {
    const user = userEvent.setup();
    const previousData = fitnessData('Previous cloud');
    const localData = fitnessData('Current browser');
    const local = accountStorage(localData);
    const previousRecord = accountBackupRecord(createPreviewEnvelope(previousData), 4);
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => previousRecord),
      save: vi.fn(async () => {
        throw new Error('simulated interrupted save before commit');
      })
    };

    renderControls(api, local.storage, localData, local.raw);
    await user.click(screen.getByRole('button', { name: /Save this device’s copy to account/ }));
    const confirmation = await screen.findByRole('dialog', { name: 'Replace account copy?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Replace account copy' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/simulated interrupted save/i);
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
    expect(await api.read()).toEqual(previousRecord);
    expect(screen.queryByText(/Updated your account backup/)).toBeNull();
  });

  it('ignores a late save response after the signed-in account changes', async () => {
    const user = userEvent.setup();
    const existing = accountBackupRecord(createPreviewEnvelope(fitnessData('Previous')), 1);
    const localData = fitnessData('Current');
    const local = accountStorage(localData);
    let resolveSave: ((revision: number) => void) | null = null;
    let accountIsCurrent = true;
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => existing),
      save: () => new Promise(resolve => {
        resolveSave = resolve;
      })
    };

    renderControls(api, local.storage, localData, local.raw, undefined, () => accountIsCurrent);
    await user.click(screen.getByRole('button', { name: /Save this device’s copy to account/ }));
    const confirmation = await screen.findByRole('dialog', { name: 'Replace account copy?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Replace account copy' }));
    accountIsCurrent = false;
    await act(async () => {
      resolveSave?.(2);
      await Promise.resolve();
    });

    expect(screen.queryByText(/Updated your account backup/)).toBeNull();
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
  });

  it('does not overwrite a different existing pre-restore recovery copy', () => {
    const data = fitnessData('Local');
    const local = accountStorage(data);
    local.values.set(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY, '{"preserved":"earlier copy"}');

    expect(preservePreviewBeforeCloudRestore(local.storage, local.raw)).toMatchObject({
      kind: 'conflict'
    });
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
    expect(local.storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBe('{"preserved":"earlier copy"}');
  });

  it('uses the authenticated client without accepting a client-supplied account id', async () => {
    const document = createPreviewEnvelope(fitnessData('Adapter'));
    const row = accountBackupRecord(document, 1);
    const maybeSingle = vi.fn(async () => ({ data: {
      document: row.document,
      revision: row.revision,
      schema_version: row.schemaVersion,
      updated_at: row.updatedAt
    }, error: null }));
    const from = vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle })) }));
    const rpc = vi.fn(async () => ({ data: 2, error: null }));
    const api = createPreviewAccountBackupApi({ from, rpc });

    expect(await api.read()).toEqual(row);
    expect(await api.save(document, 1)).toBe(2);
    expect(from).toHaveBeenCalledWith('tend_preview_backups');
    expect(rpc).toHaveBeenCalledWith('tend_save_preview_backup', {
      p_document: document,
      p_expected_revision: 1,
      p_schema_version: PREVIEW_SCHEMA_VERSION
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(accountA);
  });

  it('shares an in-flight metadata read between sync and manual backup controls', async () => {
    const row = accountBackupRecord(createPreviewEnvelope(fitnessData('Shared read')), 1);
    let resolveRead!: (value: { data: unknown; error: unknown }) => void;
    const maybeSingle = vi.fn(() => new Promise<{ data: unknown; error: unknown }>(resolve => {
      resolveRead = resolve;
    }));
    const api = createPreviewAccountBackupApi({
      from: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle })) })),
      rpc: vi.fn()
    });

    const first = api.read();
    const second = api.read();
    expect(maybeSingle).toHaveBeenCalledTimes(1);
    resolveRead({
      data: {
        document: row.document,
        revision: row.revision,
        schema_version: row.schemaVersion,
        updated_at: row.updatedAt
      },
      error: null
    });
    await expect(first).resolves.toEqual(row);
    await expect(second).resolves.toEqual(row);
  });

  it('classifies a stale atomic-save response for explicit review without retrying', async () => {
    const document = createPreviewEnvelope(fitnessData('Stale API'));
    const api = createPreviewAccountBackupApi({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null }))
        }))
      })),
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: '40001' }
      }))
    });

    await expect(api.save(document, 1)).rejects.toMatchObject({
      kind: 'stale'
    });
  });

  it('classifies only the exact P0001 stale message as a conflict', async () => {
    const document = createPreviewEnvelope(fitnessData('P0001 stale'));
    const rpc = vi.fn(async () => ({
      data: null,
      error: { code: 'P0001', message: 'Stale Preview backup revision' }
    }));
    const api = createPreviewAccountBackupApi({
      from: vi.fn(),
      rpc
    });

    await expect(api.save(document, 1)).rejects.toMatchObject({ kind: 'stale' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('does not classify unrelated P0001 errors as stale conflicts', async () => {
    const document = createPreviewEnvelope(fitnessData('P0001 invalid'));
    const api = createPreviewAccountBackupApi({
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: 'P0001', message: 'Invalid Preview backup document' }
      }))
    });

    await expect(api.save(document, 1)).rejects.toMatchObject({ kind: 'request' });
  });

  it('compares JSONB-normalized envelopes without depending on object key order', () => {
    const document = createPreviewEnvelope(fitnessData('Stable'));
    const reordered = {
      schemaVersion: document.schemaVersion,
      format: document.format,
      data: Object.fromEntries(Object.entries(document.data).reverse()) as PreviewData
    };
    expect(previewEnvelopesEqual(document, reordered)).toBe(true);
  });

  it('rejects auth or session fields instead of including them in the transferable document', () => {
    const data = {
      ...fitnessData('No credentials'),
      auth: { accessToken: 'synthetic-secret' },
      session: { refreshToken: 'synthetic-refresh-secret' }
    };

    expect(() => createValidatedPreviewAccountDocument(data, currentDate))
      .toThrow(/could not be validated/i);
  });

  it('rejects malformed account documents and migrates an older supported envelope before restore', async () => {
    const malformed = {
      document: { format: 'not-preview', schemaVersion: 999 },
      schemaVersion: 999,
      revision: 1,
      updatedAt: null
    };
    const validation = await import('../src/storage/preview-account-backup.ts');
    expect(() => validation.validatePreviewAccountBackup(malformed, currentDate))
      .toThrow(/not supported/i);

    const currentDocument = createPreviewEnvelope(createSamplePreviewData());
    const oldData = { ...currentDocument.data };
    Reflect.deleteProperty(oldData, 'flexibility');
    const oldDocument = {
      format: currentDocument.format,
      schemaVersion: 36 as const,
      data: oldData
    };
    const migrated = validation.validatePreviewAccountBackup({
      document: oldDocument,
      schemaVersion: 36,
      revision: 1,
      updatedAt: null
    }, currentDate);
    expect(migrated.sourceSchemaVersion).toBe(36);
    expect(migrated.envelope.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
  });
});
