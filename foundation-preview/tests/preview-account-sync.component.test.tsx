import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviewAccountSync } from '../src/components/PreviewAccountSync.tsx';
import {
  createEmptyPreviewData,
  createPreviewEnvelope,
  createSamplePreviewData,
  isPreviewDataPristine,
  parsePreviewBackup
} from '../src/domain/preview-state.ts';
import type { PreviewData } from '../src/domain/preview-state.ts';
import { prepareDatedRhythmCompletion } from '../src/domain/rhythm-completion.ts';
import { saveStrengthWorkoutLog } from '../src/domain/strength.ts';
import { rhythmTimeValueFromLabel } from '../src/domain/rhythm-schedule.ts';
import type {
  PreviewAccountBackupApi,
  PreviewAccountBackupRecord,
  PreviewAccountBackupSupabaseClient
} from '../src/storage/preview-account-backup.ts';
import {
  createPreviewAccountBackupApi,
  PreviewAccountBackupError
} from '../src/storage/preview-account-backup.ts';
import {
  PREVIEW_CLOUD_RESTORE_RECOVERY_KEY,
  PREVIEW_STORAGE_KEY,
  loadPreviewImportSyncGuard,
  writePreview
} from '../src/storage/preview-storage.ts';
import type { PreviewStorage } from '../src/storage/preview-storage.ts';

const currentDate = '2026-11-06';
const accountId = 'a0000000-0000-4000-8000-000000000001';

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

function makeStorage(initialData?: PreviewData) {
  const values = new Map<string, string>();
  if (initialData) values.set(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(initialData)));
  const storage: PreviewStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  return { storage, values };
}

function backend(initial?: PreviewAccountBackupRecord) {
  let record = initial ?? null;
  let saveCalls = 0;
  let readCalls = 0;
  const expectedRevisions: number[] = [];
  const savedPeople: string[] = [];
  const api: PreviewAccountBackupApi = {
    read: async () => {
      readCalls += 1;
      return record ? structuredClone(record) : null;
    },
    save: async (document, expectedRevision) => {
      saveCalls += 1;
      expectedRevisions.push(expectedRevision);
      savedPeople.push(
        (document.data.people[0] as { displayName?: string } | undefined)?.displayName ?? 'No Person'
      );
      if ((record?.revision ?? 0) !== expectedRevision) {
        const error = new Error('stale revision') as Error & { kind: string };
        error.kind = 'stale';
        throw error;
      }
      const revision = expectedRevision + 1;
      record = {
        document: structuredClone(document),
        schemaVersion: document.schemaVersion,
        revision,
        updatedAt: new Date().toISOString()
      };
      return revision;
    }
  };
  return {
    api,
    get record() {
      return record ? structuredClone(record) : null;
    },
    get saveCalls() {
      return saveCalls;
    },
    get readCalls() {
      return readCalls;
    },
    get expectedRevisions() {
      return [...expectedRevisions];
    },
    get savedPeople() {
      return [...savedPeople];
    },
    replace(next: PreviewAccountBackupRecord | null) {
      record = next ? structuredClone(next) : null;
    }
  };
}

function Browser({
  api,
  storage,
  initialData = createSamplePreviewData(),
  localIsPristine = false,
  autoSyncEnabled = true,
  authRefreshSequence = 0,
  isIdentityCurrent = () => true,
  onRestoreCall
}: {
  api: PreviewAccountBackupApi;
  storage: PreviewStorage;
  initialData?: PreviewData;
  localIsPristine?: boolean;
  autoSyncEnabled?: boolean;
  authRefreshSequence?: number;
  isIdentityCurrent?: () => boolean;
  onRestoreCall?: () => void;
}) {
  const [data, setData] = useState(() => {
    const raw = storage.getItem(PREVIEW_STORAGE_KEY);
    if (!raw) return initialData;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'data' in parsed) {
      return (parsed as { data: PreviewData }).data;
    }
    return initialData;
  });
  const [raw, setRaw] = useState(() => storage.getItem(PREVIEW_STORAGE_KEY));
  const [manualLock, setManualLock] = useState(false);
  const [syncTarget, setSyncTarget] = useState<HTMLDivElement | null>(null);

  function editPerson(label: string) {
    const first = data.people[0];
    if (!first) throw new Error('Synthetic preview fixture needs a Person.');
    const next = {
      ...data,
      people: data.people.map(person =>
        person.id === first.id ? { ...person, displayName: label } : person
      )
    };
    const result = writePreview(storage, next, raw, { currentDate });
    if (result.kind !== 'saved') throw new Error('Synthetic local edit did not save.');
    setData(next);
    setRaw(result.raw);
  }

  function restore(next: PreviewData, expectedRaw: string | null): string | null {
    onRestoreCall?.();
    const result = writePreview(storage, next, expectedRaw, {
      currentDate,
      operation: 'replace'
    });
    if (result.kind === 'saved') {
      setData(next);
      setRaw(result.raw);
      return null;
    }
    return result.kind === 'error' ? result.message : 'Local data changed.';
  }

  return (
    <>
      <output data-testid="person-name">{data.people[0]?.displayName ?? 'No Person'}</output>
      <button type="button" onClick={() => editPerson('Device edit')}>Edit this device</button>
      <button type="button" onClick={() => editPerson('Second device edit')}>Edit second device</button>
      <div ref={setSyncTarget} />
      <PreviewAccountSync
        portalTarget={syncTarget}
        api={api}
        accountId={accountId}
        authRefreshSequence={authRefreshSequence}
        storage={storage}
        data={data}
        localIsPristine={localIsPristine}
        currentDate={currentDate}
        localRaw={raw}
        localRecoveryRaw={storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)}
        localRecoveryError={null}
        enabled
        autoSyncEnabled={autoSyncEnabled}
        visible
        manualOperationLocked={manualLock}
        isIdentityCurrent={isIdentityCurrent}
        onRestore={restore}
        onManualOperationLockChange={setManualLock}
      />
    </>
  );
}

function cloudRecord(data: PreviewData, revision = 1): PreviewAccountBackupRecord {
  return {
    document: createPreviewEnvelope(data),
    schemaVersion: createPreviewEnvelope(data).schemaVersion,
    revision,
    updatedAt: '2026-11-06T12:00:00.000Z'
  };
}

async function waitForRevision(
  backendState: ReturnType<typeof backend>,
  revision: number
) {
  await waitFor(() => expect(backendState.record?.revision).toBe(revision), { timeout: 5000 });
}

describe('Preview account sync', () => {
  it('keeps automatic cloud reconciliation off while manual backup remains available', async () => {
    const localData = createSamplePreviewData();
    const cloudData = createSamplePreviewData();
    cloudData.people = cloudData.people.map(person =>
      person.id === cloudData.people[0]?.id
        ? { ...person, displayName: 'Existing account version' }
        : person
    );
    const service = backend(cloudRecord(cloudData, 4));
    const storage = makeStorage(localData);
    const localRaw = storage.values.get(PREVIEW_STORAGE_KEY);
    const view = render(
      <Browser api={service.api} storage={storage.storage} autoSyncEnabled={false} />
    );

    expect(await screen.findByText('Automatic sync is off')).toBeTruthy();
    expect(screen.getByText('Account status not checked.')).toBeTruthy();
    expect(service.readCalls).toBe(0);
    expect(service.saveCalls).toBe(0);
    expect(storage.values.get(PREVIEW_STORAGE_KEY)).toBe(localRaw);
    expect(screen.getByRole('button', { name: 'Back up to my account' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Restore from my account' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByText('Automatic sync is off. Account status is checked only when you choose a manual backup or restore.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Back up to my account' }));
    await screen.findByRole('heading', { name: 'Replace account backup?' });
    expect(service.readCalls).toBe(1);
    expect(service.saveCalls).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(service.record?.revision).toBe(4);
    expect(storage.values.get(PREVIEW_STORAGE_KEY)).toBe(localRaw);

    fireEvent.click(screen.getByRole('button', { name: 'Restore from my account' }));
    await screen.findByRole('heading', { name: 'Restore account backup?' });
    expect(service.readCalls).toBe(2);
    expect(service.saveCalls).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(service.record?.revision).toBe(4);
    expect(storage.values.get(PREVIEW_STORAGE_KEY)).toBe(localRaw);
    view.unmount();
  });

  it('uses one startup backup read for both sync reconciliation and manual status', async () => {
    const data = createSamplePreviewData();
    const record = cloudRecord(data, 4);
    const pending: {
      resolve?: (result: { data: unknown; error: unknown }) => void;
    } = {};
    const maybeSingle = vi.fn(() => new Promise<{ data: unknown; error: unknown }>(resolve => {
      pending.resolve = resolve;
    }));
    const api = createPreviewAccountBackupApi({
      from: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle })) })),
      rpc: vi.fn()
    } satisfies PreviewAccountBackupSupabaseClient);
    const storage = makeStorage(data);
    const view = render(<Browser api={api} storage={storage.storage} initialData={data} />);

    await waitFor(() => expect(maybeSingle).toHaveBeenCalledTimes(1));
    await act(async () => {
      pending.resolve?.({
        data: {
          document: record.document,
          revision: record.revision,
          schema_version: record.schemaVersion,
          updated_at: record.updatedAt
        },
        error: null
      });
    });
    await screen.findByText(/Last backup: .*revision 4\./);
    await screen.findAllByText('Saved to your account');
    await new Promise(resolve => setTimeout(resolve, 950));

    expect(maybeSingle).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('leaves a newer cloud schema and its fields untouched instead of downgrading it', async () => {
    const localData = createSamplePreviewData();
    const localRaw = JSON.stringify(createPreviewEnvelope(localData));
    const currentDocument = createPreviewEnvelope(localData);
    const futureDocument = {
      ...currentDocument,
      schemaVersion: 40,
      data: {
        ...currentDocument.data,
        futureV40Field: { retained: true }
      }
    };
    const service = backend({
      document: futureDocument,
      schemaVersion: 40,
      revision: 8,
      updatedAt: '2026-11-06T12:00:00.000Z'
    });
    const storage = makeStorage(localData);
    const view = render(<Browser api={service.api} storage={storage.storage} />);

    await screen.findAllByText(/not supported/i);
    expect(service.saveCalls).toBe(0);
    expect(storage.values.get(PREVIEW_STORAGE_KEY)).toBe(localRaw);
    expect((service.record?.document as typeof futureDocument).data.futureV40Field)
      .toEqual({ retained: true });
    view.unmount();
  });

  it('clears a stale manual read error when a later automatic sync read succeeds', async () => {
    const data = createSamplePreviewData();
    const record = cloudRecord(data, 15);
    const maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'Synthetic temporary read failure' } })
      .mockResolvedValueOnce({
        data: {
          document: record.document,
          revision: record.revision,
          schema_version: record.schemaVersion,
          updated_at: record.updatedAt
        },
        error: null
      });
    const api = createPreviewAccountBackupApi({
      from: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle })) })),
      rpc: vi.fn()
    } satisfies PreviewAccountBackupSupabaseClient);
    const storage = makeStorage(data);
    const view = render(<Browser api={api} storage={storage.storage} initialData={data} />);

    const readError = 'The account backup could not be read. Check the connection and that Preview storage is configured.';
    expect(await screen.findAllByText(readError)).toHaveLength(2);
    expect(maybeSingle).toHaveBeenCalledTimes(1);

    await act(async () => window.dispatchEvent(new Event('online')));

    expect(await screen.findByText(/Last backup: .*revision 15\./)).toBeTruthy();
    expect(screen.queryByText(readError)).toBeNull();
    expect(await screen.findByText('Saved to your account')).toBeTruthy();
    expect(maybeSingle).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  it('retries reconciliation after an expired-token read recovers through TOKEN_REFRESHED', async () => {
    const localData = createSamplePreviewData();
    const cloudData = createSamplePreviewData();
    const marker = 'OFFLINE RECONNECT CHECK — 4203 — Q8M2';
    localData.people = localData.people.map((person, index) =>
      index === 0 ? { ...person, displayName: marker } : person
    );
    const storage = makeStorage(localData);
    storage.values.set(`${PREVIEW_STORAGE_KEY}:account-sync-state`, JSON.stringify({
      accountId,
      revision: 15,
      syncedEnvelope: createPreviewEnvelope(cloudData),
      syncedAt: '2026-11-06T12:00:00.000Z'
    }));

    let accessTokenValid = false;
    let readCalls = 0;
    let savedRevision = 15;
    let savedData: PreviewData | null = null;
    const api: PreviewAccountBackupApi = {
      read: async () => {
        readCalls += 1;
        if (!navigator.onLine) throw new TypeError('Failed to fetch');
        if (!accessTokenValid) throw new Error('HTTP 401: access token expired');
        return cloudRecord(cloudData, savedRevision);
      },
      save: async (document, expectedRevision) => {
        expect(expectedRevision).toBe(savedRevision);
        savedData = structuredClone(document.data);
        savedRevision += 1;
        return savedRevision;
      }
    };
    const refreshSession = async () => {
      if (!navigator.onLine) throw new TypeError('Failed to fetch');
      accessTokenValid = true;
    };

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    expect(navigator.onLine).toBe(false);
    const view = render(<Browser api={api} storage={storage.storage} initialData={localData} />);
    await waitFor(() => expect(readCalls).toBe(1));
    await expect(refreshSession()).rejects.toThrow('Failed to fetch');

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await act(async () => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(readCalls).toBe(2));
    expect(await screen.findByText(/HTTP 401: access token expired/)).toBeTruthy();
    expect(savedData).toBeNull();

    await act(async () => {
      await refreshSession();
      view.rerender(
        <Browser
          api={api}
          storage={storage.storage}
          initialData={localData}
          authRefreshSequence={1}
        />
      );
    });

    await waitFor(() => expect(savedData?.people[0]?.displayName).toBe(marker));
    expect(readCalls).toBe(3);
    expect(savedRevision).toBe(16);
    expect(await screen.findByText('Saved to your account')).toBeTruthy();
    expect(storage.values.get(PREVIEW_STORAGE_KEY)).toContain(marker);
    view.unmount();
  });

  it('pauses imported local data for an explicit choice instead of uploading it automatically', async () => {
    const cloudData = createSamplePreviewData();
    cloudData.people = cloudData.people.map((person, index) =>
      index === 0 ? { ...person, displayName: 'Existing account data' } : person
    );
    const importedData = createSamplePreviewData();
    importedData.people = importedData.people.map((person, index) =>
      index === 0 ? { ...person, displayName: 'Imported local data' } : person
    );
    const storage = makeStorage(importedData);
    const importedRaw = storage.values.get(PREVIEW_STORAGE_KEY)!;
    const sourceRaw = JSON.stringify(createPreviewEnvelope(importedData));
    const imported = writePreview(storage.storage, importedData, importedRaw, {
      currentDate,
      importSourceRaw: sourceRaw,
      operation: 'import'
    });
    expect(imported.kind).toBe('saved');
    const service = backend(cloudRecord(cloudData, 3));
    const view = render(<Browser api={service.api} storage={storage.storage} />);

    await screen.findByRole('heading', { name: 'This device and your account both have changes' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(service.saveCalls).toBe(0);
    expect(service.record?.revision).toBe(3);
    expect(storage.values.get(PREVIEW_STORAGE_KEY)).toContain('Imported local data');

    fireEvent.click(within(view.container).getByRole('button', { name: 'Keep this device’s changes' }));
    await waitForRevision(service, 4);
    expect((service.record?.document as { data: PreviewData }).data.people[0]?.displayName)
      .toBe('Imported local data');
    expect(loadPreviewImportSyncGuard(storage.storage)).toMatchObject({
      kind: 'loaded',
      guard: { kind: 'resolved', importedRaw: imported.kind === 'saved' ? imported.raw : null }
    });
    view.unmount();
  });

  it('does not upload imported data automatically when the account has no document yet', async () => {
    const importedData = createSamplePreviewData();
    importedData.people = importedData.people.map((person, index) =>
      index === 0 ? { ...person, displayName: 'Imported without cloud document' } : person
    );
    const storage = makeStorage(importedData);
    const importedRaw = storage.values.get(PREVIEW_STORAGE_KEY)!;
    const sourceRaw = JSON.stringify(createPreviewEnvelope(importedData));
    expect(writePreview(storage.storage, importedData, importedRaw, {
      currentDate,
      importSourceRaw: sourceRaw,
      operation: 'import'
    }).kind).toBe('saved');
    const service = backend();
    const view = render(<Browser api={service.api} storage={storage.storage} />);

    expect(await screen.findByText(/Imported Preview data is saved on this device/)).toBeTruthy();
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(service.saveCalls).toBe(0);
    expect(service.record).toBeNull();
    expect(storage.values.get(PREVIEW_STORAGE_KEY)).toBe(importedRaw);
    view.unmount();
  });

  it('keeps imported data local and pending when cloud reads fail', async () => {
    const importedData = createSamplePreviewData();
    importedData.people = importedData.people.map((person, index) =>
      index === 0 ? { ...person, displayName: 'Offline imported data' } : person
    );
    const storage = makeStorage(importedData);
    const importedRaw = storage.values.get(PREVIEW_STORAGE_KEY)!;
    const sourceRaw = JSON.stringify(createPreviewEnvelope(importedData));
    expect(writePreview(storage.storage, importedData, importedRaw, {
      currentDate,
      importSourceRaw: sourceRaw,
      operation: 'import'
    }).kind).toBe('saved');
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => { throw new Error('Synthetic cloud unavailable'); }),
      save: vi.fn(async () => 1)
    };
    const view = render(<Browser api={api} storage={storage.storage} />);

    expect(await screen.findAllByText('Synthetic cloud unavailable')).toHaveLength(2);
    expect(api.save).not.toHaveBeenCalled();
    expect(storage.values.get(PREVIEW_STORAGE_KEY)).toBe(importedRaw);
    expect(loadPreviewImportSyncGuard(storage.storage)).toMatchObject({
      kind: 'loaded',
      guard: { kind: 'pending', importedRaw }
    });
    view.unmount();
  });

  it('applies account data over a persisted unchanged default when sync metadata is absent', async () => {
    const accountData = createSamplePreviewData();
    const service = backend(cloudRecord(accountData, 4));
    const emptyData = createEmptyPreviewData();
    const storage = makeStorage(emptyData);
    const raw = storage.values.get(PREVIEW_STORAGE_KEY)!;
    const parsed = parsePreviewBackup(raw, currentDate);
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) throw new Error('Empty default fixture must validate.');
    const localIsPristine = isPreviewDataPristine(parsed.envelope.data, createEmptyPreviewData());
    expect(localIsPristine).toBe(true);
    const view = render(
      <Browser
        api={service.api}
        storage={storage.storage}
        initialData={emptyData}
        localIsPristine={localIsPristine}
      />
    );

    await waitFor(() => expect(view.container.querySelector('[data-testid="person-name"]')?.textContent)
      .toBe(accountData.people[0]?.displayName));
    expect(service.saveCalls).toBe(0);
    expect(service.record?.revision).toBe(4);
    expect(storage.values.get(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toContain('"data"');
    expect(storage.values.get(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toContain('"people":[]');
    expect(screen.getAllByText('Saved to your account').length).toBeGreaterThan(0);
    view.unmount();
  });

  it('keeps a non-default local edit in conflict when sync metadata is absent', async () => {
    const accountData = createSamplePreviewData();
    const service = backend(cloudRecord(accountData, 4));
    const editedData = createEmptyPreviewData();
    editedData.goals = [{
      id: 'sample-goal-1',
      title: 'OFFLINE TEST ONLY — 4198 — 2026-11-09',
      currency: 'USD',
      direction: 'increase',
      startingBalanceMinor: 0,
      startDate: '2026-11-09',
      targetBalanceMinor: 100,
      targetDate: '2026-11-10',
      checkIns: [],
      correctionHistory: []
    }];
    const localIsPristine = isPreviewDataPristine(editedData, createEmptyPreviewData());
    expect(localIsPristine).toBe(false);
    const storage = makeStorage(editedData);
    const localRaw = storage.values.get(PREVIEW_STORAGE_KEY);
    const view = render(
      <Browser
        api={service.api}
        storage={storage.storage}
        initialData={editedData}
        localIsPristine={localIsPristine}
      />
    );

    await screen.findByRole('heading', { name: 'This device and your account both have changes' });
    expect(service.saveCalls).toBe(0);
    expect(service.record?.revision).toBe(4);
    expect(storage.values.get(PREVIEW_STORAGE_KEY)).toBe(localRaw);
    expect((service.record?.document as { data: PreviewData }).data.people).toHaveLength(accountData.people.length);
    view.unmount();
  });

  it('uploads only after checking an empty cloud, then applies newer cloud edits on another browser', async () => {
    const service = backend();
    const sourceStorage = makeStorage(createSamplePreviewData());
    const destinationStorage = makeStorage();
    const source = render(<Browser api={service.api} storage={sourceStorage.storage} />);
    await waitForRevision(service, 1);
    expect(screen.getAllByText('Saved to your account').length).toBeGreaterThan(0);

    const destination = render(
      <Browser api={service.api} storage={destinationStorage.storage} initialData={createEmptyPreviewData()} />
    );
    await waitFor(() => expect(destination.container.querySelector('[data-testid="person-name"]')?.textContent)
      .toBe(createSamplePreviewData().people[0]?.displayName));

    fireEvent.click(within(source.container).getByRole('button', { name: 'Edit this device' }));
    await waitForRevision(service, 2);
    expect(sourceStorage.values.get(PREVIEW_STORAGE_KEY)).toContain('Device edit');

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(destination.container.querySelector('[data-testid="person-name"]')?.textContent)
      .toBe('Device edit'));
    expect(destinationStorage.values.get(PREVIEW_STORAGE_KEY)).toContain('Device edit');
    expect(service.saveCalls, `CAS revisions: ${service.expectedRevisions.join(', ')}; people: ${service.savedPeople.join(' | ')}`).toBe(2);
    expect(service.record?.revision).toBe(2);
    destination.unmount();
    source.unmount();
  });

  it('does not retry a P0001 stale sync write and keeps both versions for a choice', async () => {
    const localData = createSamplePreviewData();
    const cloudData = createSamplePreviewData();
    const service = backend(cloudRecord(localData, 1));
    let staleWrites = 0;
    const api: PreviewAccountBackupApi = {
      read: () => service.api.read(),
      save: async () => {
        staleWrites += 1;
        const competingCloud = {
          ...cloudData,
          people: cloudData.people.map(person =>
            person.id === cloudData.people[0]?.id
              ? { ...person, displayName: 'Competing account edit' }
              : person
          )
        };
        service.replace(cloudRecord(competingCloud, 2));
        throw new PreviewAccountBackupError('stale', 'Stale Preview backup revision');
      }
    };
    const storage = makeStorage(localData);
    const view = render(<Browser api={api} storage={storage.storage} />);
    await screen.findAllByText('Saved to your account');

    fireEvent.click(view.getByRole('button', { name: 'Edit this device' }));
    await screen.findByRole('heading', { name: 'This device and your account both have changes' });

    expect(staleWrites).toBe(1);
    expect(service.record?.revision).toBe(2);
    expect((service.record?.document as { data: PreviewData }).data.people[0]?.displayName)
      .toBe('Competing account edit');
    expect(storage.values.get(PREVIEW_STORAGE_KEY)).toContain('Device edit');
    view.unmount();
  });

  it('coordinates manual backup with sync until its explicit replacement confirmation', async () => {
    const deviceData = createSamplePreviewData();
    deviceData.people = deviceData.people.map(person =>
      person.id === deviceData.people[0]?.id
        ? { ...person, displayName: 'Device version' }
        : person
    );
    const accountData = createSamplePreviewData();
    accountData.people = accountData.people.map(person =>
      person.id === accountData.people[0]?.id
        ? { ...person, displayName: 'Account version' }
        : person
    );
    const service = backend(cloudRecord(accountData, 2));
    const storage = makeStorage(deviceData);
    const view = render(<Browser api={service.api} storage={storage.storage} />);
    await screen.findByRole('heading', { name: 'This device and your account both have changes' });

    fireEvent.click(view.getByRole('button', { name: 'Back up to my account' }));
    await screen.findByRole('heading', { name: 'Replace account backup?' });
    expect(service.saveCalls).toBe(0);
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(service.saveCalls).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Replace account backup' }));
    await waitForRevision(service, 3);
    expect((service.record?.document as { data: PreviewData }).data.people[0]?.displayName)
      .toBe('Device version');
    view.unmount();
  });

  it('coordinates manual restore and preserves the device copy until confirmation', async () => {
    const deviceData = createSamplePreviewData();
    deviceData.people = deviceData.people.map(person =>
      person.id === deviceData.people[0]?.id
        ? { ...person, displayName: 'Device version' }
        : person
    );
    const accountData = createSamplePreviewData();
    accountData.people = accountData.people.map(person =>
      person.id === accountData.people[0]?.id
        ? { ...person, displayName: 'Account version' }
        : person
    );
    const service = backend(cloudRecord(accountData, 2));
    const storage = makeStorage(deviceData);
    const deviceRaw = storage.values.get(PREVIEW_STORAGE_KEY);
    const view = render(<Browser api={service.api} storage={storage.storage} />);
    await screen.findByRole('heading', { name: 'This device and your account both have changes' });

    fireEvent.click(view.getByRole('button', { name: 'Restore from my account' }));
    await screen.findByRole('heading', { name: 'Restore account backup?' });
    expect(storage.values.get(PREVIEW_STORAGE_KEY)).toBe(deviceRaw);
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(storage.values.get(PREVIEW_STORAGE_KEY)).toBe(deviceRaw);

    fireEvent.click(screen.getByRole('button', { name: 'Replace this browser’s data' }));
    await waitFor(() => expect(view.getByTestId('person-name').textContent).toBe('Account version'));
    expect(storage.values.get(PREVIEW_STORAGE_KEY)).not.toBe(deviceRaw);
    expect(storage.values.get(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBe(deviceRaw);
    expect(service.record?.revision).toBe(2);
    view.unmount();
  });

  it('keeps offline edits locally through a remount and syncs them after reconnecting', async () => {
    const service = backend();
    const storage = makeStorage(createSamplePreviewData());
    const firstTab = render(<Browser api={service.api} storage={storage.storage} />);
    await waitForRevision(service, 1);
    firstTab.unmount();

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const offlineTab = render(<Browser api={service.api} storage={storage.storage} />);
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    fireEvent.click(offlineTab.getByRole('button', { name: 'Edit this device' }));
    await waitFor(() => expect(storage.values.get(PREVIEW_STORAGE_KEY)).toContain('Device edit'));
    expect(service.record?.revision).toBe(1);
    offlineTab.unmount();

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    const reopened = render(<Browser api={service.api} storage={storage.storage} />);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await waitForRevision(service, 2);
    expect((service.record?.document as { data: PreviewData }).data.people[0]?.displayName).toBe('Device edit');
    reopened.unmount();
  });

  it('preserves both copies and waits for an explicit choice when both devices changed', async () => {
    const service = backend();
    const baseline = createSamplePreviewData();
    const storageA = makeStorage(baseline);
    const storageB = makeStorage();
    const deviceA = render(<Browser api={service.api} storage={storageA.storage} />);
    await waitForRevision(service, 1);
    const deviceB = render(
      <Browser api={service.api} storage={storageB.storage} initialData={createEmptyPreviewData()} />
    );
    await waitFor(() => expect(deviceB.container.querySelector('[data-testid="person-name"]')?.textContent)
      .toBe(baseline.people[0]?.displayName));

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await act(async () => window.dispatchEvent(new Event('offline')));
    fireEvent.click(within(deviceB.container).getByRole('button', { name: 'Edit second device' }));
    await waitFor(() => expect(storageB.values.get(PREVIEW_STORAGE_KEY)).toContain('Second device edit'));
    fireEvent.click(within(deviceA.container).getByRole('button', { name: 'Edit this device' }));
    await waitFor(() => expect(storageA.values.get(PREVIEW_STORAGE_KEY)).toContain('Device edit'));
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await act(async () => window.dispatchEvent(new Event('online')));

    const conflictChoice = await screen.findByRole('heading', {
      name: 'This device and your account both have changes'
    });
    expect(conflictChoice).toBeTruthy();
    const conflictA = deviceA.container.querySelector('.preview-account-sync__conflict');
    const conflictB = deviceB.container.querySelector('.preview-account-sync__conflict');
    expect(Boolean(conflictA) !== Boolean(conflictB)).toBe(true);
    const conflictedContainer = conflictA ? deviceA.container : deviceB.container;
    const conflictedStorage = conflictA ? storageA : storageB;
    const localChoice = conflictA ? 'Device edit' : 'Second device edit';
    const initialCloudChoice = conflictA ? 'Second device edit' : 'Device edit';
    expect((service.record?.document as { data: PreviewData }).data.people[0]?.displayName)
      .toBe(initialCloudChoice);
    expect(conflictedStorage.values.get(PREVIEW_STORAGE_KEY)).toContain(localChoice);

    fireEvent.click(within(conflictedContainer).getByRole('button', { name: 'Keep this device’s changes' }));
    await waitForRevision(service, 3);
    expect((service.record?.document as { data: PreviewData }).data.people[0]?.displayName).toBe(localChoice);
    expect(conflictedStorage.values.get(`${PREVIEW_STORAGE_KEY}:account-sync-cloud-recovery`))
      .toContain(initialCloudChoice);
    deviceA.unmount();
    deviceB.unmount();
  });

  it('uses the account version only after preserving the changed local copy', async () => {
    const service = backend();
    const localData = createSamplePreviewData();
    const cloudData = createSamplePreviewData();
    cloudData.people = cloudData.people.map((person, index) =>
      index === 0 ? { ...person, displayName: 'Account edit' } : person
    );
    const storage = makeStorage(localData);
    const view = render(<Browser api={service.api} storage={storage.storage} />);
    await waitForRevision(service, 1);
    service.replace(cloudRecord(cloudData, 2));

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await act(async () => window.dispatchEvent(new Event('offline')));
    fireEvent.click(within(view.container).getByRole('button', { name: 'Edit this device' }));
    await waitFor(() => expect(storage.values.get(PREVIEW_STORAGE_KEY)).toContain('Device edit'));
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await act(async () => window.dispatchEvent(new Event('online')));
    await screen.findByRole('heading', { name: 'This device and your account both have changes' });
    const localRecovery = storage.values.get(PREVIEW_STORAGE_KEY);

    fireEvent.click(within(view.container).getByRole('button', { name: 'Use the account version' }));
    await waitFor(() => expect(view.container.querySelector('[data-testid="person-name"]')?.textContent)
      .toBe('Account edit'));
    expect(storage.values.get(`${PREVIEW_STORAGE_KEY}:account-sync-device-recovery`)).toBe(localRecovery);
    expect(service.record?.revision).toBe(2);
    expect((service.record?.document as { data: PreviewData }).data.people[0]?.displayName)
      .toBe('Account edit');
    view.unmount();
  });

  it('uses a separate recovery copy for the device version when an older restore copy exists', async () => {
    const localData = createSamplePreviewData();
    const cloudData = createSamplePreviewData();
    cloudData.people = cloudData.people.map(person =>
      person.id === cloudData.people[0]?.id
        ? { ...person, displayName: 'Account edit' }
        : person
    );
    const storage = makeStorage(localData);
    const earlierRecovery = JSON.stringify(createPreviewEnvelope(createEmptyPreviewData()));
    storage.values.set(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY, earlierRecovery);
    const localRecovery = storage.values.get(PREVIEW_STORAGE_KEY);
    const service = backend(cloudRecord(cloudData, 2));
    const view = render(<Browser api={service.api} storage={storage.storage} />);
    await screen.findByRole('heading', { name: 'This device and your account both have changes' });

    fireEvent.click(within(view.container).getByRole('button', { name: 'Use the account version' }));
    await waitFor(() => expect(view.container.querySelector('[data-testid="person-name"]')?.textContent)
      .toBe('Account edit'));
    expect(storage.values.get(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBe(earlierRecovery);
    expect(storage.values.get(`${PREVIEW_STORAGE_KEY}:account-sync-device-recovery`))
      .toBe(localRecovery);
    expect(service.record?.revision).toBe(2);
    expect(view.container.textContent).toContain('Download previous device version');
    view.unmount();
  });

  it('applies a newer cloud version when the device is unchanged despite an older recovery copy', async () => {
    const initialData = createSamplePreviewData();
    const service = backend(cloudRecord(initialData, 1));
    const storage = makeStorage(initialData);
    const view = render(<Browser api={service.api} storage={storage.storage} />);
    await waitFor(() => expect(screen.getAllByText('Saved to your account').length).toBeGreaterThan(0));

    const earlierRecovery = JSON.stringify(createPreviewEnvelope(createEmptyPreviewData()));
    storage.values.set(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY, earlierRecovery);
    const newerData = createSamplePreviewData();
    newerData.people = newerData.people.map(person =>
      person.id === newerData.people[0]?.id
        ? { ...person, displayName: 'New cloud version' }
        : person
    );
    service.replace(cloudRecord(newerData, 2));
    await act(async () => window.dispatchEvent(new Event('focus')));

    await waitFor(() => expect(view.container.querySelector('[data-testid="person-name"]')?.textContent)
      .toBe('New cloud version'));
    expect(service.saveCalls).toBe(0);
    expect(service.record?.revision).toBe(2);
    expect(storage.values.get(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBe(earlierRecovery);
    view.unmount();
  });

  it('restores one linked workout and its single Rhythm completion without duplicating either', async () => {
    const service = backend();
    const date = '2026-11-06';
    const rhythmId = 'user-rhythm-00000000-0000-4000-8000-000000000001';
    const completionId = 'synthetic-workout-completion';
    const data = createSamplePreviewData();
    const timeOfDay = rhythmTimeValueFromLabel('Anytime');
    if (timeOfDay === undefined) throw new Error('Could not create synthetic Rhythm time fixture.');
    const rhythm: PreviewData['savedRhythms'][number] = {
      id: rhythmId,
      title: 'Synthetic Strength Rhythm',
      description: 'Synthetic linked workout fixture',
      cadence: 'Daily',
      timeLabel: 'Anytime',
      timeOfDay,
      personIds: [],
      categoryIds: ['health'],
      schedule: { frequency: 'daily' },
      personal: false,
      createdLocalDate: date,
      createdTimeZone: 'UTC',
      primaryFoundationId: 'health-strength',
      secondaryFoundationIds: [],
      healthLogCapability: 'workout'
    };
    const completion = prepareDatedRhythmCompletion({
      id: completionId,
      rhythmId,
      effectiveDate: date,
      hour: 10,
      minute: 0,
      period: 'AM',
      timeZone: 'UTC',
      memory: 'Synthetic linked workout'
    }, new Date('2026-11-06T12:00:00.000Z'));
    if (!completion.valid) throw new Error('Could not create synthetic Rhythm completion fixture.');
    const workout = saveStrengthWorkoutLog(data.strength.workouts, {
      id: 'synthetic-linked-workout',
      date,
      muscleIds: ['chest'],
      rhythmId,
      rhythmOccurrence: date,
      completionId
    });
    if (!workout.valid) throw new Error('Could not create synthetic linked workout fixture.');
    data.savedRhythms = [rhythm];
    data.rhythmHistoryIds = [rhythmId];
    data.datedRhythmCompletions = [completion.record];
    data.strength = { ...data.strength, workouts: workout.workouts };

    const sourceStorage = makeStorage(data);
    const destinationStorage = makeStorage();
    const source = render(<Browser api={service.api} storage={sourceStorage.storage} />);
    await waitForRevision(service, 1);
    const destination = render(
      <Browser api={service.api} storage={destinationStorage.storage} initialData={createEmptyPreviewData()} />
    );
    await waitFor(() => expect(destinationStorage.values.get(PREVIEW_STORAGE_KEY)).toContain(completionId));
    await act(async () => window.dispatchEvent(new Event('focus')));

    const restoredRaw = destinationStorage.values.get(PREVIEW_STORAGE_KEY);
    if (restoredRaw === undefined) throw new Error('Cloud restore did not persist local data.');
    const restored = parsePreviewBackup(restoredRaw, date);
    if (!restored.valid) throw new Error(`Cloud restore produced invalid local data: ${restored.message}`);
    expect(restored.envelope.data.strength.workouts).toHaveLength(1);
    expect(restored.envelope.data.strength.workouts[0]?.id).toBe('synthetic-linked-workout');
    expect(restored.envelope.data.datedRhythmCompletions).toHaveLength(1);
    expect(restored.envelope.data.datedRhythmCompletions[0]?.id).toBe(completionId);
    expect(service.record?.revision).toBe(1);
    expect(service.saveCalls).toBe(1);
    destination.unmount();
    source.unmount();
  });

  it('recognizes a successful write whose response was lost without writing a duplicate revision', async () => {
    const base = backend();
    const storage = makeStorage(createSamplePreviewData());
    let loseFirstResponse = true;
    const api: PreviewAccountBackupApi = {
      read: () => base.api.read(),
      save: async (document, revision) => {
        const savedRevision = await base.api.save(document, revision);
        if (loseFirstResponse) {
          loseFirstResponse = false;
          throw new Error('Synthetic response interruption');
        }
        return savedRevision;
      }
    };
    const view = render(<Browser api={api} storage={storage.storage} />);
    await waitForRevision(base, 1);
    await waitFor(() => expect(screen.getAllByText('Saved to your account').length).toBeGreaterThan(0));
    expect(base.saveCalls).toBe(1);
    view.unmount();
  });

  it('ignores a delayed response after sign-out makes the account identity no longer current', async () => {
    const service = backend(cloudRecord(createSamplePreviewData()));
    let resolveRead: ((record: PreviewAccountBackupRecord | null) => void) | null = null;
    const api: PreviewAccountBackupApi = {
      read: () => new Promise(resolve => {
        resolveRead = resolve;
      }),
      save: service.api.save
    };
    let identityCurrent = true;
    const onRestoreCall = vi.fn();
    const storage = makeStorage();
    const view = render(
      <Browser
        api={api}
        storage={storage.storage}
        isIdentityCurrent={() => identityCurrent}
        onRestoreCall={onRestoreCall}
      />
    );
    view.unmount();
    identityCurrent = false;
    await act(async () => {
      resolveRead?.(service.record);
    });
    expect(onRestoreCall).not.toHaveBeenCalled();
    expect(storage.values.has(PREVIEW_STORAGE_KEY)).toBe(false);
  });
});
