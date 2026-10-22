import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { PreviewDataControls } from '../src/components/PreviewDataControls.tsx';
import {
  createPreviewEnvelope,
  createSamplePreviewData,
  parsePreviewBackup,
  validatePreviewEnvelope
} from '../src/domain/preview-state.ts';
import {
  browserPreviewStorage,
  loadPreview,
  loadV1RecoveryCopy,
  PREVIEW_STORAGE_KEY,
  PREVIEW_V1_RECOVERY_KEY,
  writePreview
} from '../src/storage/preview-storage.ts';
import type { PreviewData } from '../src/domain/preview-state.ts';
import { installMemoryStorage, MemoryStorage } from './memory-storage.ts';

beforeEach(installMemoryStorage);
afterEach(() => {
  cleanup();
  window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
  vi.unstubAllGlobals();
});

function sampleWithHistory(): PreviewData {
  const data = createSamplePreviewData();
  data.goals[0]!.correctionHistory.push({
    effectiveDate: '2026-10-18',
    previousBalanceMinor: 120_000,
    previousNote: 'Earlier value',
    replacedAt: '2026-10-20T12:30:00.000Z'
  });
  data.completedRhythmIds = ['sample-pray-together'];
  return data;
}

function versionOneRaw(data: PreviewData): string {
  const envelope = createPreviewEnvelope(data);
  return JSON.stringify({
    format: envelope.format,
    schemaVersion: 1,
    data: {
      goals: envelope.data.goals,
      completedRhythmIds: envelope.data.completedRhythmIds
    }
  });
}

function storageFixture(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };
  return { storage, values };
}

function alteredEnvelope(change: (value: Record<string, unknown>) => void): unknown {
  const value: unknown = JSON.parse(JSON.stringify(createPreviewEnvelope(sampleWithHistory())));
  change(value as Record<string, unknown>);
  return value;
}

function setDownloadMocks() {
  const createObjectURL = vi.fn((_blob: Blob) => 'blob:synthetic-preview');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return { createObjectURL, revokeObjectURL };
}

describe('synthetic preview storage adapter and envelope', () => {
  it('round-trips the explicit versioned envelope with goals, check-ins, corrections, and Today completion', () => {
    const data = sampleWithHistory();
    const envelope = createPreviewEnvelope(data);
    const parsed = validatePreviewEnvelope(envelope, '2026-10-21');
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;
    expect(parsed.envelope.format).toBe('tend.synthetic-preview');
    expect(parsed.envelope.schemaVersion).toBe(2);
    expect(parsed.envelope.data).toEqual(data);

    const { storage } = storageFixture();
    expect(writePreview(storage, data, null).kind).toBe('saved');
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind === 'loaded') expect(loaded.data).toEqual(data);
  });

  it('restores valid empty state without reinitializing sample goals or completions', () => {
    const empty = { goals: [], completedRhythmIds: [], savedRhythms: [] };
    const raw = JSON.stringify(createPreviewEnvelope(empty));
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: raw });
    const result = loadPreview(storage, '2026-10-21');
    expect(result.kind).toBe('loaded');
    if (result.kind === 'loaded') expect(result.data).toEqual(empty);
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
  });

  it('does not overwrite an existing saved draft during startup or a stale initial write', () => {
    const saved = sampleWithHistory();
    const raw = JSON.stringify(createPreviewEnvelope(saved));
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: raw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
    expect(writePreview(storage, createSamplePreviewData(), null)).toEqual({ kind: 'conflict', actualRaw: raw });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(raw);
  });

  it('migrates a v1 backup in memory while preserving goals, corrections, completions, and valid empty states', () => {
    const data = sampleWithHistory();
    const raw = versionOneRaw(data);
    const parsed = parsePreviewBackup(raw, '2026-10-21');
    expect(parsed.valid).toBe(true);
    if (parsed.valid) {
      expect(parsed.envelope.schemaVersion).toBe(2);
      expect(parsed.envelope.data).toEqual({ ...data, savedRhythms: [] });
      expect(parsed.envelope.data.goals[0]!.checkIns).toEqual(data.goals[0]!.checkIns);
      expect(parsed.envelope.data.goals[0]!.correctionHistory).toEqual(data.goals[0]!.correctionHistory);
      expect(parsed.envelope.data.completedRhythmIds).toEqual(data.completedRhythmIds);
    }

    const emptyV1 = JSON.stringify({
      format: 'tend.synthetic-preview',
      schemaVersion: 1,
      data: { goals: [], completedRhythmIds: [] }
    });
    const emptyResult = parsePreviewBackup(emptyV1, '2026-10-21');
    expect(emptyResult.valid && emptyResult.envelope.data).toEqual({
      goals: [],
      completedRhythmIds: [],
      savedRhythms: []
    });
  });

  it('archives the exact v1 envelope before the first v2 write and never overwrites that recovery copy', () => {
    const initial = sampleWithHistory();
    const originalRaw = versionOneRaw(initial);
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: originalRaw });
    const loaded = loadPreview(storage, '2026-10-21');
    expect(loaded.kind).toBe('loaded');
    if (loaded.kind !== 'loaded') return;
    expect(loaded.data).toEqual({ ...initial, savedRhythms: [] });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(loadV1RecoveryCopy(storage)).toEqual({ kind: 'loaded', raw: null });

    const updated = { ...loaded.data, completedRhythmIds: ['sample-connect'] };
    expect(writePreview(storage, updated, originalRaw).kind).toBe('saved');
    expect(values.get(PREVIEW_V1_RECOVERY_KEY)).toBe(originalRaw);
    const recoveryCopy = values.get(PREVIEW_V1_RECOVERY_KEY);
    const activeV2 = values.get(PREVIEW_STORAGE_KEY)!;
    expect(JSON.parse(activeV2).schemaVersion).toBe(2);
    expect(writePreview(storage, { ...updated, completedRhythmIds: [] }, activeV2).kind).toBe('saved');
    expect(values.get(PREVIEW_V1_RECOVERY_KEY)).toBe(recoveryCopy);

    const occupied = storageFixture({
      [PREVIEW_STORAGE_KEY]: originalRaw,
      [PREVIEW_V1_RECOVERY_KEY]: '{"other":"preserved"}'
    });
    expect(writePreview(occupied.storage, loaded.data, originalRaw)).toMatchObject({ kind: 'error' });
    expect(occupied.values.get(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(occupied.values.get(PREVIEW_V1_RECOVERY_KEY)).toBe('{"other":"preserved"}');
  });

  it('does not overwrite an unsupported active envelope', () => {
    const unsupportedRaw = JSON.stringify({
      format: 'tend.synthetic-preview',
      schemaVersion: 3,
      data: { goals: [], completedRhythmIds: [], savedRhythms: [] }
    });
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: unsupportedRaw });
    expect(loadPreview(storage, '2026-10-21')).toMatchObject({ kind: 'unsupported', raw: unsupportedRaw });
    expect(writePreview(storage, createSamplePreviewData(), null)).toEqual({
      kind: 'conflict',
      actualRaw: unsupportedRaw
    });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(unsupportedRaw);
  });

  it('touches only the isolated preview key, leaving existing Tend storage keys unchanged', () => {
    const legacyKeys = {
      'tend-state': '{"live":"unchanged"}',
      'tend:account-cache': '{"account":"unchanged"}',
      'supabase.auth.token': '{"auth":"unchanged"}',
      'tend:calendar-cache': '{"calendar":"unchanged"}',
      'tend:sync-state': '{"sync":"unchanged"}'
    };
    const { storage, values } = storageFixture(legacyKeys);
    expect(loadPreview(storage, '2026-10-21').kind).toBe('missing');
    expect(writePreview(storage, createSamplePreviewData(), null).kind).toBe('saved');
    for (const [key, value] of Object.entries(legacyKeys)) expect(values.get(key)).toBe(value);
    expect([...values.keys()]).toEqual([...Object.keys(legacyKeys), PREVIEW_STORAGE_KEY]);
  });

  it('rejects malformed JSON, unsupported versions, malformed records, duplicate IDs, and invalid references', () => {
    expect(parsePreviewBackup('{', '2026-10-21').valid).toBe(false);
    const unsupported = createPreviewEnvelope(sampleWithHistory());
    expect(validatePreviewEnvelope({ ...unsupported, schemaVersion: 3 }, '2026-10-21')).toMatchObject({
      valid: false,
      kind: 'unsupported'
    });
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      (data.goals as Array<Record<string, unknown>>)[0]!.targetBalanceMinor = -1;
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      goals.push({ ...goals[0] });
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      data.completedRhythmIds = ['not-a-today-example'];
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      goals[0]!.startDate = '2026-02-30';
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      const checkIns = goals[0]!.checkIns as Array<Record<string, unknown>>;
      checkIns[0]!.effectiveDate = 'not-a-date';
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      const checkIns = goals[0]!.checkIns as Array<Record<string, unknown>>;
      checkIns[0]!.effectiveDate = '2026-10-22';
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      const checkIns = goals[0]!.checkIns as Array<Record<string, unknown>>;
      checkIns[1]!.id = checkIns[0]!.id;
    }), '2026-10-21').valid).toBe(false);
    expect(validatePreviewEnvelope(alteredEnvelope(value => {
      const data = value.data as Record<string, unknown>;
      const goals = data.goals as Array<Record<string, unknown>>;
      goals[0]!.currency = 'ZZZ';
    }), '2026-10-21').valid).toBe(false);
  });

  it('preserves corrupt stored bytes and reports blocked and quota-failed storage', () => {
    const corruptRaw = '{"broken":';
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: corruptRaw });
    expect(loadPreview(storage, '2026-10-21')).toMatchObject({ kind: 'corrupt', raw: corruptRaw });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(corruptRaw);

    const blocked = {
      getItem: () => { throw new Error('Storage access denied'); },
      setItem: () => {},
      removeItem: () => {}
    };
    expect(loadPreview(blocked, '2026-10-21')).toMatchObject({ kind: 'unavailable', message: 'Storage access denied' });

    const quota = {
      getItem: () => null,
      setItem: () => { throw new Error('Quota exceeded'); },
      removeItem: () => {}
    };
    expect(writePreview(quota, createSamplePreviewData(), null))
      .toMatchObject({ kind: 'error', message: 'Quota exceeded' });
  });

  it('detects an external-tab write before replacing a stale value', () => {
    const first = JSON.stringify(createPreviewEnvelope(createSamplePreviewData()));
    const secondData = sampleWithHistory();
    const second = JSON.stringify(createPreviewEnvelope(secondData));
    const { storage, values } = storageFixture({ [PREVIEW_STORAGE_KEY]: first });
    expect(writePreview(storage, secondData, first)).toMatchObject({ kind: 'saved' });
    expect(writePreview(storage, createSamplePreviewData(), first))
      .toEqual({ kind: 'conflict', actualRaw: second });
    expect(values.get(PREVIEW_STORAGE_KEY)).toBe(second);
  });
});

describe('preview backup controls', () => {
  it('exports the explicit envelope and imports the backup through confirmation', async () => {
    const user = userEvent.setup();
    const data = sampleWithHistory();
    const onImport = vi.fn(() => null);
    const { createObjectURL } = setDownloadMocks();
    render(
      <PreviewDataControls
        data={data}
        status={{ kind: 'saved' }}
        currentDate="2026-10-21"
        onImport={onImport}
        onReset={() => null}
        onRetrySave={() => {}}
        onReloadExternal={() => null}
        onReplaceExternal={() => null}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Export preview backup' }));
    const exportedBlob = createObjectURL.mock.calls[0]![0];
    const exportedText = await exportedBlob.text();
    const exported = JSON.parse(exportedText) as Record<string, unknown>;
    expect(Object.keys(exported).sort()).toEqual(['data', 'format', 'schemaVersion']);
    expect(exported.format).toBe('tend.synthetic-preview');
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File([exportedText], 'exported.json', { type: 'application/json' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    await user.click(within(dialog).getByRole('button', { name: 'Replace with backup' }));
    expect(onImport).toHaveBeenCalledWith(data);
  });

  it('imports only after validation and confirmation, and cancellation preserves current state', async () => {
    const user = userEvent.setup();
    const imported = sampleWithHistory();
    imported.goals[0]!.title = '<script>sample</script>';
    const onImport = vi.fn(() => null);
    const { container } = render(
      <PreviewDataControls
        data={createSamplePreviewData()}
        status={{ kind: 'saved' }}
        currentDate="2026-10-21"
        onImport={onImport}
        onReset={() => null}
        onRetrySave={() => {}}
        onReloadExternal={() => null}
        onReplaceExternal={() => null}
      />
    );
    const input = within(container).getByLabelText('Import preview backup') as HTMLInputElement;
    const file = new File([JSON.stringify(createPreviewEnvelope(imported))], 'sample.json', { type: 'application/json' });
    await user.upload(input, file);
    const dialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    expect(within(dialog).getByText(/Cancel leaves the current preview unchanged/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Download current preview backup' })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByText('Preview data saved in this browser.')).toBeTruthy();
  });

  it('offers export before reset and preserves storage when the replacement is cancelled', async () => {
    const user = userEvent.setup();
    const original = JSON.stringify(createPreviewEnvelope(sampleWithHistory()));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, original);
    const { createObjectURL } = setDownloadMocks();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(screen.getByRole('button', { name: 'Reset sample data' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset sample data?' });
    await user.click(within(dialog).getByRole('button', { name: 'Download current preview backup' }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(original);
  });

  it('preserves corrupt storage, offers raw recovery, and resets only the preview key after confirmation', async () => {
    const user = userEvent.setup();
    const corruptRaw = '{"bad":';
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, corruptRaw);
    window.localStorage.setItem('tend-state', '{"live":"keep"}');
    const { createObjectURL } = setDownloadMocks();
    render(<App />);

    expect(await screen.findByText(/original value is preserved/)).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(corruptRaw);
    await user.click(screen.getByRole('button', { name: 'Download raw recovery file' }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    const recoveryBlob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(await recoveryBlob.text()).toBe(corruptRaw);

    await user.click(screen.getByRole('button', { name: 'Reset sample data' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset sample data?' });
    await user.click(within(dialog).getByRole('button', { name: 'Reset sample data' }));
    expect(await screen.findByText('Preview data saved in this browser.')).toBeTruthy();
    expect(loadPreview(browserPreviewStorage(), '2026-10-21').kind).toBe('loaded');
    expect(window.localStorage.getItem('tend-state')).toBe('{"live":"keep"}');
  });

  it('keeps app state on an invalid backup and restores goal corrections and Today completion on remount', async () => {
    const user = userEvent.setup();
    const openFinances = () => user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Finances' }));
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.click(screen.getByRole('button', { name: 'Details for Pray together' }));
    const rhythmDialog = await screen.findByRole('dialog', { name: 'Pray together' });
    await user.click(within(rhythmDialog).getByRole('button', { name: 'Tend Pray together' }));
    await waitFor(() => expect(within(rhythmDialog).getByRole('button', { name: 'Tended Pray together' }).matches(':disabled')).toBe(true));
    await openFinances();
    const goal = screen.getByRole('article', { name: 'Starter reserve' });
    await user.click(within(goal).getAllByRole('button', { name: 'Correct' })[0]!);
    const correction = screen.getByRole('dialog', { name: 'Correct balance check-in' });
    const balance = within(correction).getByLabelText('Current balance');
    await user.clear(balance);
    await user.type(balance, '1350.00');
    await user.click(within(correction).getByRole('button', { name: 'Save correction' }));
    const beforeInvalidImport = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File(['{"format":"bad"}'], 'invalid.json', { type: 'application/json' })
    );
    expect(await screen.findByText(/format or schema version is not supported/)).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(beforeInvalidImport);

    cleanup();
    render(<App />);
    expect(await screen.findByText('1 of 3 tended')).toBeTruthy();
    await openFinances();
    const restored = screen.getByRole('article', { name: 'Starter reserve' });
    expect(within(restored).getByText('$1,350.00')).toBeTruthy();
    expect(within(restored).getByText(/previous value \$1,250\.00/)).toBeTruthy();
    expect(within(restored).getByRole('heading', { name: 'Correction history' })).toBeTruthy();
  });

  it('renders imported strings as text and persists the confirmed preview replacement', async () => {
    const user = userEvent.setup();
    const imported = sampleWithHistory();
    imported.goals[0]!.title = '<script>synthetic</script>';
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    await user.upload(
      screen.getByLabelText('Import preview backup'),
      new File([JSON.stringify(createPreviewEnvelope(imported))], 'safe-data.json', { type: 'application/json' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Replace preview data?' });
    await user.click(within(dialog).getByRole('button', { name: 'Replace with backup' }));
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Finances' }));
    const importedGoal = screen.getByRole('article', { name: '<script>synthetic</script>' });
    expect(importedGoal.textContent).toContain('<script>synthetic</script>');
    expect(importedGoal.querySelector('script')).toBeNull();
    const saved = JSON.parse(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!) as {
      data: { goals: Array<{ title: string }> };
    };
    expect(saved.data.goals[0]!.title).toBe('<script>synthetic</script>');
  });

  it('requires an explicit decision for another tab and supports reload or replacement', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Preview data saved in this browser.');
    const oldValue = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    const external = createSamplePreviewData();
    external.goals[0]!.title = 'Another tab reserve';
    const newValue = JSON.stringify(createPreviewEnvelope(external));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, newValue);
    const storageEvent = new Event('storage');
    Object.defineProperties(storageEvent, {
      key: { value: PREVIEW_STORAGE_KEY },
      oldValue: { value: oldValue },
      newValue: { value: newValue }
    });
    window.dispatchEvent(storageEvent);
    expect(await screen.findByText(/changed in another tab/)).toBeTruthy();
    await user.click(within(screen.getByRole('navigation', { name: 'Areas' })).getByRole('button', { name: 'Finances' }));
    expect(screen.getByRole('article', { name: 'Starter reserve' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reload other tab’s preview' }));
    expect(await screen.findByRole('article', { name: 'Another tab reserve' })).toBeTruthy();
    expect(window.localStorage.getItem(PREVIEW_STORAGE_KEY)).toBe(newValue);

    const laterExternal = createSamplePreviewData();
    laterExternal.goals[0]!.title = 'Third tab reserve';
    const laterValue = JSON.stringify(createPreviewEnvelope(laterExternal));
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, laterValue);
    const laterEvent = new Event('storage');
    Object.defineProperties(laterEvent, {
      key: { value: PREVIEW_STORAGE_KEY },
      oldValue: { value: newValue },
      newValue: { value: laterValue }
    });
    window.dispatchEvent(laterEvent);
    await screen.findByText(/changed in another tab/);
    await user.click(screen.getByRole('button', { name: 'Replace other tab’s data' }));
    const replaceDialog = await screen.findByRole('dialog', { name: 'Replace the other tab?' });
    expect(within(replaceDialog).getByRole('button', { name: 'Download current preview backup' })).toBeTruthy();
    await user.click(within(replaceDialog).getByRole('button', { name: 'Replace other tab' }));
    expect(JSON.parse(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!).data.goals[0].title)
      .toBe('Another tab reserve');
  });

  it('reports blocked storage and quota errors without claiming that data was saved', async () => {
    vi.spyOn(MemoryStorage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage access denied'); });
    render(<App />);
    expect(await screen.findByText(/Browser storage is unavailable/)).toBeTruthy();
    expect(screen.queryByText('Preview data saved in this browser.')).toBeNull();
    cleanup();
    vi.restoreAllMocks();

    vi.spyOn(MemoryStorage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
    render(<App />);
    expect(await screen.findByText(/Preview data was not saved\. Quota exceeded/)).toBeTruthy();
    expect(screen.queryByText('Preview data saved in this browser.')).toBeNull();
  });
});
