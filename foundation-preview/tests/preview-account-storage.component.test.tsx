import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { PreviewDataControls } from '../src/components/PreviewDataControls.tsx';
import {
  createAuthenticatedPreviewIdentity,
  previewIdentityKey,
  validatePreviewIdentity
} from '../src/domain/preview-identity.ts';
import {
  createEmptyPreviewData,
  createPreviewEnvelope,
  createSamplePreviewData,
  parsePreviewBackup
} from '../src/domain/preview-state.ts';
import {
  createPreviewStorageScope,
  loadPreview,
  listenForPreviewChanges,
  PREVIEW_ACCOUNT_STORAGE_PREFIX,
  PREVIEW_RAW_RECOVERY_KEY,
  PREVIEW_STORAGE_KEY,
  PREVIEW_V32_RECOVERY_KEY,
  writePreview
} from '../src/storage/preview-storage.ts';
import type { PreviewStorage } from '../src/storage/preview-storage.ts';
import { installMemoryStorage } from './memory-storage.ts';

beforeEach(installMemoryStorage);
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function authenticatedIdentity(id: string, generation: number) {
  const identity = createAuthenticatedPreviewIdentity(id, generation);
  if (identity.kind !== 'authenticated') throw new Error('Synthetic account fixture is invalid.');
  return identity;
}

const accountA = authenticatedIdentity('a0000000-0000-4000-8000-000000000001', 1);
const accountB = authenticatedIdentity('b0000000-0000-4000-8000-000000000002', 1);

function mapStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage: PreviewStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  return { storage, values };
}

function accountData(label: string) {
  const sample = createSamplePreviewData();
  const first = sample.people[0];
  if (!first) throw new Error('Sample people fixture is missing.');
  return {
    ...sample,
    people: [{ ...first, displayName: label }, ...sample.people.slice(1)]
  };
}

function storedAccountName(label: string): string {
  return label;
}

describe('account-isolated Preview storage', () => {
  it('does not create storage scopes for pending, signed-out, or invalid identities', () => {
    const calls: string[] = [];
    const storage: PreviewStorage = {
      getItem: key => {
        calls.push(`get:${key}`);
        return null;
      },
      setItem: (key, value) => calls.push(`set:${key}:${value.length}`)
    };

    expect(createPreviewStorageScope(storage, { kind: 'pending' })).toBeNull();
    expect(createPreviewStorageScope(storage, { kind: 'signed-out' })).toBeNull();
    expect(validatePreviewIdentity({ kind: 'authenticated', accountId: 'email@example.test', sessionGeneration: 1 }))
      .toMatchObject({ kind: 'error' });
    expect(createPreviewStorageScope(storage, { kind: 'error', message: 'Unavailable.' })).toBeNull();
    expect(calls).toEqual([]);
  });

  it('isolates datasets and exact migration recovery without claiming the unbound synthetic key', () => {
    const { storage, values } = mapStorage({ [PREVIEW_STORAGE_KEY]: 'unbound-synthetic-data' });
    const scopeA = createPreviewStorageScope(storage, accountA);
    const scopeB = createPreviewStorageScope(storage, accountB);
    expect(scopeA).not.toBeNull();
    expect(scopeB).not.toBeNull();
    if (!scopeA || !scopeB) return;

    const v33 = createPreviewEnvelope(createEmptyPreviewData());
    const v32 = {
      ...v33,
      schemaVersion: 32,
      data: { ...v33.data }
    };
    delete (v32.data as Record<string, unknown>).prayerRequests;
    delete (v32.data as Record<string, unknown>).timeBlocks;
    delete (v32.data as Record<string, unknown>).showTended;
    const originalV32 = JSON.stringify(v32);
    scopeA.storage.setItem(PREVIEW_STORAGE_KEY, originalV32);

    const migrated = loadPreview(scopeA.storage, '2026-11-01');
    expect(migrated.kind).toBe('loaded');
    if (migrated.kind !== 'loaded') return;
    expect(migrated.data.prayerRequests).toEqual([]);
    expect(writePreview(scopeA.storage, migrated.data, migrated.raw, { currentDate: '2026-11-01' }).kind)
      .toBe('saved');

    const accountRootA = `${PREVIEW_ACCOUNT_STORAGE_PREFIX}:${accountA.accountId}`;
    const accountRootB = `${PREVIEW_ACCOUNT_STORAGE_PREFIX}:${accountB.accountId}`;
    expect(values.get(`${accountRootA}:v32-recovery`)).toBe(originalV32);
    expect(values.get(PREVIEW_V32_RECOVERY_KEY) ?? null).toBeNull();
    expect(scopeB.storage.getItem(PREVIEW_STORAGE_KEY)).toBeNull();
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe('unbound-synthetic-data');
    expect(values.has(accountRootB)).toBe(false);
    expect([...values.keys()].every(key => !key.includes('@example.test'))).toBe(true);

    const corruptRaw = '{"unreadable":';
    scopeA.storage.setItem(PREVIEW_STORAGE_KEY, corruptRaw);
    expect(writePreview(scopeA.storage, createEmptyPreviewData(), corruptRaw, {
      allowUnrecoverableReplacement: true,
      currentDate: '2026-11-01',
      operation: 'reset'
    }).kind).toBe('saved');
    expect(values.get(`${accountRootA}:raw-recovery`)).toBe(corruptRaw);
    expect(values.get(PREVIEW_RAW_RECOVERY_KEY) ?? null).toBeNull();
    expect(scopeB.storage.getItem(PREVIEW_RAW_RECOVERY_KEY)).toBeNull();
  });

  it('keeps writes, reset candidates, and conflicts within the scoped account', () => {
    const { storage, values } = mapStorage();
    const scopeA = createPreviewStorageScope(storage, accountA);
    const scopeB = createPreviewStorageScope(storage, accountB);
    if (!scopeA || !scopeB) return;
    const dataA = { ...accountData('Account A'), showTended: true };
    const dataB = { ...accountData('Account B'), showTended: false };
    const savedA = writePreview(scopeA.storage, dataA, null, { currentDate: '2026-11-01' });
    const savedB = writePreview(scopeB.storage, dataB, null, { currentDate: '2026-11-01' });
    expect(savedA.kind).toBe('saved');
    expect(savedB.kind).toBe('saved');
    if (savedA.kind !== 'saved' || savedB.kind !== 'saved') return;

    expect(writePreview(scopeA.storage, dataB, null, { currentDate: '2026-11-01' }))
      .toMatchObject({ kind: 'conflict' });
    const loadedA = loadPreview(scopeA.storage, '2026-11-01');
    const loadedB = loadPreview(scopeB.storage, '2026-11-01');
    expect(loadedA.kind).toBe('loaded');
    expect(loadedB.kind).toBe('loaded');
    if (loadedA.kind !== 'loaded' || loadedB.kind !== 'loaded') return;
    expect(loadedA.data.people[0]?.displayName).toBe(storedAccountName('Account A'));
    expect(loadedB.data.people[0]?.displayName).toBe(storedAccountName('Account B'));
    expect(loadedA.data.showTended).toBe(true);
    expect(loadedB.data.showTended).toBe(false);
    expect(values.size).toBe(2);
  });

  it('saves the Today preference in the account envelope and restores it without creating completions', async () => {
    const scope = createPreviewStorageScope({
      getItem: key => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value)
    }, accountA);
    if (!scope) return;
    const initialData = createEmptyPreviewData();
    const saved = writePreview(scope.storage, initialData, null, { currentDate: '2026-11-01' });
    expect(saved.kind).toBe('saved');

    const firstRender = render(<App identity={accountA} />);
    const toggle = await screen.findByRole('button', { name: /Show tended Rhythms/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    await waitFor(() => {
      const loaded = loadPreview(scope.storage, '2026-11-01');
      expect(loaded.kind === 'loaded' && loaded.data.showTended).toBe(true);
    });
    firstRender.unmount();

    render(<App identity={accountA} />);
    expect((await screen.findByRole('button', { name: /Hide tended Rhythms/ })).getAttribute('aria-expanded')).toBe('true');
    const loadedAgain = loadPreview(scope.storage, '2026-11-01');
    expect(loadedAgain.kind).toBe('loaded');
    if (loadedAgain.kind === 'loaded') {
      expect(loadedAgain.data.datedRhythmCompletions).toEqual([]);
      expect(loadedAgain.data.activeRhythmCompletions).toEqual([]);
      expect(loadedAgain.data.completedRhythmIds).toEqual([]);
    }
  });

  it('scopes cross-tab change events to the active account key', () => {
    const calls: Array<string | null> = [];
    const unsubscribe = listenForPreviewChanges(value => calls.push(value), accountA);
    window.dispatchEvent(new StorageEvent('storage', {
      key: `${PREVIEW_ACCOUNT_STORAGE_PREFIX}:${accountB.accountId}`,
      newValue: 'account-b'
    }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: `${PREVIEW_ACCOUNT_STORAGE_PREFIX}:${accountA.accountId}`,
      newValue: 'account-a'
    }));
    window.dispatchEvent(new StorageEvent('storage', { key: null, newValue: null }));
    unsubscribe();
    expect(calls).toEqual(['account-a', null]);
  });

  it('switches accounts without showing the previous account and clears views on sign-out', async () => {
    const scopeA = createPreviewStorageScope({
      getItem: key => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value)
    }, accountA);
    const scopeB = createPreviewStorageScope({
      getItem: key => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value)
    }, accountB);
    if (!scopeA || !scopeB) return;
    const a = writePreview(scopeA.storage, accountData('Account A'), null, { currentDate: '2026-11-01' });
    const b = writePreview(scopeB.storage, accountData('Account B'), null, { currentDate: '2026-11-01' });
    expect(a.kind).toBe('saved');
    expect(b.kind).toBe('saved');
    if (a.kind !== 'saved') return;
    const savedAccountARaw = a.raw;

    const user = userEvent.setup();
    const { rerender } = render(<App identity={accountA} />);
    await screen.findByRole('button', { name: 'People' });
    await user.click(screen.getByRole('button', { name: 'People' }));
    await screen.findByText('Account A');
    await user.click(screen.getByRole('button', { name: 'Open profile for Account A' }));
    const profile = screen.getByRole('main', { name: 'Account A' });
    await user.click(within(profile).getByRole('button', { name: 'Person settings' }));
    const settings = screen.getByRole('dialog', { name: 'Person settings — Account A' });
    await user.click(within(settings).getByRole('combobox', { name: /^Category:/ }));
    await user.click(within(settings).getByRole('option', { name: 'Friend' }));
    expect(within(settings).getByRole('combobox', { name: 'Category: Friend' })).toBeTruthy();

    rerender(<App identity={{ ...accountB, sessionGeneration: 2 }} />);
    expect(screen.queryByText('Account A')).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Person settings — Account A' })).toBeNull();
    expect(valuesForAccount(scopeA.storage)).toBe(savedAccountARaw);
    await screen.findByRole('button', { name: 'People' });
    await user.click(screen.getByRole('button', { name: 'People' }));
    await screen.findByText('Account B');

    rerender(<App identity={{ kind: 'signed-out' }} />);
    expect(screen.queryByText('Account B')).toBeNull();
    expect(screen.getByText('No account Preview data was loaded.')).toBeTruthy();

    rerender(<App identity={{ ...accountA, sessionGeneration: 3 }} />);
    await screen.findByRole('button', { name: 'People' });
    await user.click(await screen.findByRole('button', { name: 'People' }));
    await screen.findByText('Account A');
  });

  it('does not load or claim the existing synthetic key when account identity is unavailable', async () => {
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewEnvelope(accountData('Unbound'))));
    render(<App identity={{ kind: 'pending' }} />);
    expect(screen.getByText('Your account data has not been opened.')).toBeTruthy();
    expect(screen.queryByText('Unbound')).toBeNull();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).not.toBeNull();
    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.length).toBe(1);
  });

  it('exports, imports, and resets only the active account dataset', async () => {
    const scopeA = createPreviewStorageScope({
      getItem: key => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value)
    }, accountA);
    const scopeB = createPreviewStorageScope({
      getItem: key => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value)
    }, accountB);
    if (!scopeA || !scopeB) return;
    const savedA = writePreview(scopeA.storage, accountData('Account A'), null, { currentDate: '2026-11-01' });
    const savedB = writePreview(scopeB.storage, accountData('Account B'), null, { currentDate: '2026-11-01' });
    expect(savedA.kind).toBe('saved');
    expect(savedB.kind).toBe('saved');
    if (savedA.kind !== 'saved' || savedB.kind !== 'saved') return;
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, 'unbound-data');
    const savedBRaw = scopeB.storage.getItem(PREVIEW_STORAGE_KEY);

    const downloadBlobs: Blob[] = [];
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((blob: Blob) => {
        downloadBlobs.push(blob);
        return 'blob:account-preview';
      }),
      revokeObjectURL: vi.fn()
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<App identity={accountA} />);
    await screen.findByRole('button', { name: 'People' });
    await user.click(screen.getByRole('button', { name: 'More, settings' }));
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Export preview backup' }));
    expect(downloadBlobs).toHaveLength(1);
    const exported = parsePreviewBackup(await downloadBlobs[0]!.text(), '2026-11-01');
    expect(exported.valid).toBe(true);
    if (exported.valid) expect(exported.envelope.data.people[0]?.displayName).toBe('Account A');

    const importedData = createPreviewEnvelope(accountData('Imported A'));
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File([JSON.stringify(importedData)], 'account-a-import.json', { type: 'application/json' })
    );
    const importDialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    await user.click(within(importDialog).getByRole('button', { name: 'Replace with backup' }));
    await waitForScopedValue(scopeA.storage, 'Imported A');
    expect(scopeB.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(savedBRaw);
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe('unbound-data');

    await user.click(screen.getByRole('button', { name: 'Reset sample data' }));
    const resetDialog = await screen.findByRole('dialog', { name: 'Reset sample data?' });
    await user.click(within(resetDialog).getByRole('button', { name: 'Reset sample data' }));
    const reset = loadPreview(scopeA.storage, '2026-11-01');
    expect(reset.kind).toBe('loaded');
    if (reset.kind === 'loaded') expect(reset.data.people).toEqual([]);
    expect(scopeB.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(savedBRaw);
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe('unbound-data');
    vi.unstubAllGlobals();
  });

  function valuesForAccount(storage: PreviewStorage): string | null {
    return storage.getItem(PREVIEW_STORAGE_KEY);
  }

  async function waitForScopedValue(storage: PreviewStorage, expectedName: string): Promise<void> {
    await vi.waitFor(() => {
      const loaded = loadPreview(storage, '2026-11-01');
      expect(loaded.kind).toBe('loaded');
      if (loaded.kind === 'loaded') expect(loaded.data.people[0]?.displayName).toBe(expectedName);
    });
  }

  it('uses a distinct session key for an account after logout and reauthentication', () => {
    const first = createAuthenticatedPreviewIdentity(accountA.accountId, 10);
    const second = createAuthenticatedPreviewIdentity(accountA.accountId, 11);
    expect(previewIdentityKey(first)).not.toBe(previewIdentityKey(second));
    const scopeFirst = createPreviewStorageScope(mapStorage().storage, first);
    const scopeSecond = createPreviewStorageScope(mapStorage().storage, second);
    expect(scopeFirst?.key).toBe(scopeSecond?.key);
  });

  it('aborts and ignores a late backup file read after its account view unmounts', () => {
    const data = createSamplePreviewData();
    const onImport = vi.fn(() => null);
    const onAbort = vi.fn();
    const raw = JSON.stringify(createPreviewEnvelope(data));
    const readerState: { current: FileReader | null } = { current: null };
    class ControlledFileReader {
      result: string | null = null;
      onload: FileReader['onload'] = null;
      onloadend: FileReader['onloadend'] = null;
      onerror: FileReader['onerror'] = null;
      readAsText = vi.fn();
      abort = onAbort;

      constructor() {
        readerState.current = this as unknown as FileReader;
      }

      complete(value: string) {
        this.result = value;
        this.onload?.call(
          this as unknown as FileReader,
          new ProgressEvent('load') as ProgressEvent<FileReader>
        );
      }
    }
    vi.stubGlobal('FileReader', ControlledFileReader);

    const view = render(
      <PreviewDataControls
        data={data}
        status={{ kind: 'saved' }}
        currentDate="2026-11-01"
        onImport={onImport}
        onReset={() => null}
        onRetrySave={() => {}}
        onReloadExternal={() => null}
        onReplaceExternal={() => null}
      />
    );
    fireEvent.change(screen.getByLabelText('Import preview backup'), {
      target: { files: [new File(['{}'], 'late-preview.json', { type: 'application/json' })] }
    });
    const createdReader = readerState.current as ControlledFileReader | null;
    expect(createdReader?.readAsText).toHaveBeenCalledOnce();
    view.unmount();
    expect(onAbort).toHaveBeenCalledOnce();
    createdReader?.complete(raw);
    expect(onImport).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
