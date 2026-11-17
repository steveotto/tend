import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviewAccountBackupControls } from '../src/components/PreviewAccountBackupControls.tsx';
import type { PreviewAccountSyncState } from '../src/components/PreviewAccountBackupControls.tsx';
import {
  createPreviewEnvelope,
  createSamplePreviewData,
  parsePreviewBackup,
  PREVIEW_SCHEMA_VERSION,
  validatePreviewEnvelope
} from '../src/domain/preview-state.ts';
import type { PreviewData, PreviewEnvelope } from '../src/domain/preview-state.ts';
import type { SavedRhythm } from '../src/domain/rhythm-editor.ts';
import {
  createPreviewAccountBackupApi,
  createValidatedPreviewAccountDocument,
  PreviewAccountBackupError,
  previewEnvelopesEqual,
  validatePreviewAccountBackup
} from '../src/storage/preview-account-backup.ts';
import type {
  PreviewAccountBackupApi,
  PreviewAccountBackupRecord
} from '../src/storage/preview-account-backup.ts';
import {
  loadPreview,
  PREVIEW_CLOUD_RESTORE_RECOVERY_KEY,
  PREVIEW_STRENGTH_REPAIR_RECOVERY_KEY,
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
  openRecovery = true,
  autoSyncEnabled = true,
  syncStatus: PreviewAccountSyncState = 'account',
  onRepair?: (data: PreviewData, expectedRaw: string) => string | null,
  localSaveConfirmed = true,
  localSavePending = false,
  recoveryOperationLocked = false,
  enabled = true,
  syncBusy = false
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
      enabled={enabled}
      localSaveConfirmed={localSaveConfirmed}
      localSavePending={localSavePending}
      recoveryOperationLocked={recoveryOperationLocked}
      syncBusy={syncBusy}
      autoSyncEnabled={autoSyncEnabled}
      syncStatus={syncStatus}
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
      onRepair={onRepair ?? ((nextData, expectedRaw) => {
        const result = writePreview(storage, nextData, expectedRaw, {
          allowTargetedRepair: true,
          currentDate,
          operation: 'repair'
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
  if (openRecovery) {
    fireEvent.click(screen.getByRole('button', { name: /Account recovery/ }));
  }
  return view;
}

function missingCompletionData(): PreviewData {
  const data = fitnessData('Broken completion link');
  const workout = data.strength.workouts[0];
  if (!workout) throw new Error('Synthetic preview fixture is missing its workout.');
  const date = '2026-10-19';
  data.strength.workouts = [{
    ...workout,
    id: 'strength-log-lower-body',
    date,
    workoutName: 'Lower Body',
    notes: 'Preserve this synthetic workout note.',
    startedAt: `${date}T10:00:00.000Z`,
    finishedAt: `${date}T11:00:00.000Z`,
    timeZone: 'UTC',
    rhythmOccurrence: date,
    completionId: 'missing-completion-reference'
  }];
  return data;
}

describe('manual Preview account backup and restore', () => {
  it('keeps technical account status collapsed inside account recovery', async () => {
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

  it('keeps Account recovery closeable with a keyboard-accessible scroll region and restores focus', async () => {
    const user = userEvent.setup();
    const data = fitnessData('Scrollable recovery');
    const local = accountStorage(data);
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => null),
      save: vi.fn(async () => 1)
    };

    renderControls(api, local.storage, data, local.raw, undefined, () => true, accountA, false);
    const opener = screen.getByRole('button', { name: /Account recovery/ });
    await user.click(opener);

    const dialog = await screen.findByRole('dialog', { name: 'Account recovery' });
    const close = within(dialog).getByRole('button', { name: 'Close Account recovery' });
    const scrollRegion = within(dialog).getByRole('region', { name: 'Account recovery content' });
    expect(dialog.classList.contains('money-goal-dialog--scrollable-body')).toBe(true);
    expect(close.closest('.money-goal-dialog__persistent-header')).toBeTruthy();
    expect(scrollRegion.tabIndex).toBe(0);
    expect(document.activeElement).toBe(close);
    expect(document.body.style.position).toBe('fixed');

    await user.click(close);
    expect(await screen.queryByRole('dialog', { name: 'Account recovery' })).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.position).not.toBe('fixed');
  });

  it('lets a confirmed account save continue after closing its confirmation dialog', async () => {
    const user = userEvent.setup();
    const deviceData = fitnessData('Synthetic device version');
    const accountData = fitnessData('Synthetic account version');
    const local = accountStorage(deviceData);
    const record = accountBackupRecord(createPreviewEnvelope(accountData), 3);
    let completeSave: ((revision: number) => void) | null = null;
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => record),
      save: vi.fn(() => new Promise<number>(resolve => { completeSave = resolve; }))
    };

    renderControls(api, local.storage, deviceData, local.raw);
    await user.click(screen.getByRole('button', { name: /Save this device’s copy to account/ }));
    const confirmation = await screen.findByRole('dialog', { name: 'Replace account copy?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Replace account copy' }));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));

    const close = within(confirmation).getByRole('button', { name: 'Close Account recovery' });
    expect(close.hasAttribute('disabled')).toBe(false);
    await user.click(close);
    expect(screen.queryByRole('dialog', { name: 'Account recovery' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Replace account copy?' })).toBeNull();
    expect(document.body.style.position).not.toBe('fixed');
    expect(api.save).toHaveBeenCalledTimes(1);

    await act(async () => {
      if (!completeSave) throw new Error('Synthetic account save did not start.');
      completeSave(4);
    });
    const opener = screen.getByRole('button', { name: /Account recovery/ });
    await user.click(opener);
    expect(await screen.findByText('The account copy was updated.')).toBeTruthy();
    expect(api.save).toHaveBeenCalledTimes(1);
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

  it('shows a safe validation diagnostic before reading or uploading to the account', async () => {
    const user = userEvent.setup();
    const data = fitnessData('Synthetic backup validation');
    data.savedRhythms[0]!.timeOfDay = 'custom-time-block:22222222-2222-4222-8222-222222222222';
    const local = accountStorage(data);
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => null),
      save: vi.fn(async () => 1)
    };

    renderControls(api, local.storage, data, local.raw, undefined, () => true, accountA, true, false);
    await user.click(screen.getByRole('button', { name: /Save this device’s copy to account/ }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('preview.rhythm-time-block.unconfigured');
    expect(alert.textContent).toContain('data.savedRhythms[*].timeOfDay');
    expect(alert.textContent).not.toContain('Synthetic backup validation');
    expect(alert.textContent).not.toContain('custom-time-block:22222222');
    expect(api.read).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
  });

  it('checks valid local data without reading storage or accessing the account', async () => {
    const user = userEvent.setup();
    const data = fitnessData('Synthetic valid check');
    const local = accountStorage(data);
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => null),
      save: vi.fn(async () => 1)
    };

    renderControls(api, local.storage, data, local.raw, undefined, () => true, accountA, true, false);
    const getItem = vi.spyOn(local.storage, 'getItem');
    const setItem = vi.spyOn(local.storage, 'setItem');
    await user.click(screen.getByRole('button', { name: /Check data/ }));

    expect((await screen.findByText(/passed backup validation/i)).textContent)
      .toContain('No storage or account data was changed.');
    expect(api.read).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('shows the privacy-safe relationship diagnostic without reading or writing storage or account', async () => {
    const user = userEvent.setup();
    const data = fitnessData('Synthetic invalid check');
    data.strength.workouts[0]!.workoutName = 'Synthetic flagged workout';
    data.strength.workouts[0]!.notes = 'Do not display this workout note.';
    data.strength.workouts[0]!.completionId = 'synthetic-missing-completion';
    data.strength.workouts.push({
      id: 'synthetic-unrelated-workout',
      date: '2026-11-03',
      muscleIds: ['back'],
      workoutName: 'Synthetic unrelated workout',
      notes: 'Do not display unrelated details.'
    });
    const originalData = JSON.stringify(data);
    const local = accountStorage(data);
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => null),
      save: vi.fn(async () => 1)
    };

    renderControls(api, local.storage, data, local.raw, undefined, () => true, accountA, true, false);
    const getItem = vi.spyOn(local.storage, 'getItem');
    const setItem = vi.spyOn(local.storage, 'setItem');
    await user.click(screen.getByRole('button', { name: /Check data/ }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('preview.strength.completion-link.invalid');
    expect(alert.textContent).toContain('data.strength.workouts[*].completionId');
    expect(alert.textContent).toContain('2 total, 0 linked, 1 unlinked, 1 invalid');
    expect(alert.textContent).toContain('missing completion 1');
    expect(alert.textContent).not.toContain('Synthetic invalid check');
    expect(alert.textContent).not.toContain('synthetic-missing-completion');
    const inspection = await screen.findByText(/Workout: Synthetic flagged workout/);
    expect(inspection.textContent).toContain(`Date: ${currentDate}`);
    expect(inspection.textContent).toContain('Matching completion for the same Rhythm/date: yes');
    expect(inspection.textContent).not.toContain('Do not display');
    expect(inspection.textContent).not.toContain('Synthetic unrelated workout');
    expect(JSON.stringify(data)).toBe(originalData);
    expect(api.read).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('reports when no completion exists for the missing workout Rhythm/date', async () => {
    const user = userEvent.setup();
    const data = fitnessData('Synthetic no matching completion');
    data.strength.workouts[0]!.workoutName = 'Synthetic unmatched workout';
    data.strength.workouts[0]!.completionId = 'synthetic-missing-completion';
    data.datedRhythmCompletions = [];
    data.activeRhythmCompletions = [];
    const local = accountStorage(data);
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => null),
      save: vi.fn(async () => 1)
    };

    renderControls(api, local.storage, data, local.raw, undefined, () => true, accountA, true, false);
    const getItem = vi.spyOn(local.storage, 'getItem');
    const setItem = vi.spyOn(local.storage, 'setItem');
    await user.click(screen.getByRole('button', { name: /Check data/ }));

    const inspection = await screen.findByText(/Workout: Synthetic unmatched workout/);
    expect(inspection.textContent).toContain(`Date: ${currentDate}`);
    expect(inspection.textContent).toContain('Matching completion for the same Rhythm/date: no');
    expect(api.read).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('requires confirmation, preserves exact source bytes, and removes only the approved workout association', async () => {
    const user = userEvent.setup();
    const data = missingCompletionData();
    const local = accountStorage(data);
    const originalRaw = local.raw;
    const originalEnvelope = JSON.parse(originalRaw) as PreviewEnvelope;
    const originalWorkout = originalEnvelope.data.strength.workouts[0]!;
    const originalCompletions = JSON.stringify(originalEnvelope.data.datedRhythmCompletions);
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => null),
      save: vi.fn(async () => 1)
    };

    renderControls(api, local.storage, data, local.raw);
    await user.click(screen.getByRole('button', { name: /Check data/ }));
    expect(await screen.findByText(/Workout: Lower Body/)).toBeTruthy();
    const repairAction = await screen.findByRole('button', { name: /Repair this workout’s broken Rhythm link/ });
    await user.click(repairAction);

    const confirmation = await screen.findByRole('dialog', { name: 'Repair this workout’s Rhythm link?' });
    expect(confirmation.textContent).toContain('will stay intact in History');
    expect(confirmation.textContent).toContain('normal sync may upload the repaired document');
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));

    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(originalRaw);
    expect(local.storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBeNull();
    await user.click(repairAction);
    const confirmed = await screen.findByRole('dialog', { name: 'Repair this workout’s Rhythm link?' });
    await user.click(within(confirmed).getByRole('button', { name: 'Repair this workout' }));

    expect(await screen.findByText(/Local save: confirmed/)).toBeTruthy();
    expect(local.storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBeNull();
    expect(local.storage.getItem(PREVIEW_STRENGTH_REPAIR_RECOVERY_KEY)).toBe(originalRaw);
    const savedRaw = local.storage.getItem(PREVIEW_STORAGE_KEY);
    expect(savedRaw).not.toBe(originalRaw);
    const saved = parsePreviewBackup(savedRaw!, currentDate);
    expect(saved.valid).toBe(true);
    if (!saved.valid) return;
    const savedEnvelope = JSON.parse(savedRaw!) as PreviewEnvelope;
    const {
      rhythmId,
      rhythmOccurrence,
      completionId,
      ...expectedWorkout
    } = originalWorkout;
    void rhythmId;
    void rhythmOccurrence;
    void completionId;
    expect(savedEnvelope.data.strength.workouts).toEqual([expectedWorkout]);
    expect(savedEnvelope.data.datedRhythmCompletions).toEqual(originalEnvelope.data.datedRhythmCompletions);
    expect(JSON.stringify(savedEnvelope.data.datedRhythmCompletions)).toBe(originalCompletions);
    expect(api.save).not.toHaveBeenCalled();
  });

  it('uses a repair-specific archive and leaves an earlier pre-restore copy unchanged', async () => {
    const user = userEvent.setup();
    const data = missingCompletionData();
    const local = accountStorage(data);
    const earlierRecovery = '{"preserve":"earlier pre-restore copy"}';
    local.values.set(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY, earlierRecovery);
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => null),
      save: vi.fn(async () => 1)
    };

    renderControls(api, local.storage, data, local.raw);
    await user.click(screen.getByRole('button', { name: /Check data/ }));
    await user.click(await screen.findByRole('button', { name: /Repair this workout’s broken Rhythm link/ }));
    const confirmation = await screen.findByRole('dialog', { name: 'Repair this workout’s Rhythm link?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Repair this workout' }));

    expect(await screen.findByText(/Local save: confirmed/)).toBeTruthy();
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).not.toBe(local.raw);
    expect(local.storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBe(earlierRecovery);
    expect(local.storage.getItem(PREVIEW_STRENGTH_REPAIR_RECOVERY_KEY)).toBe(local.raw);
    expect(api.save).not.toHaveBeenCalled();
  });

  it('stops without writes when the repair-specific archive already contains different bytes', async () => {
    const user = userEvent.setup();
    const data = missingCompletionData();
    const local = accountStorage(data);
    const earlierRecovery = '{"preserve":"earlier pre-restore copy"}';
    const existingRepairArchive = '{"preserve":"earlier repair source"}';
    local.values.set(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY, earlierRecovery);
    local.values.set(PREVIEW_STRENGTH_REPAIR_RECOVERY_KEY, existingRepairArchive);
    const onRepair = vi.fn(() => null);
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => null),
      save: vi.fn(async () => 1)
    };

    renderControls(
      api,
      local.storage,
      data,
      local.raw,
      undefined,
      () => true,
      accountA,
      true,
      true,
      'account',
      onRepair
    );
    await user.click(screen.getByRole('button', { name: /Check data/ }));
    await user.click(await screen.findByRole('button', { name: /Repair this workout’s broken Rhythm link/ }));
    const confirmation = await screen.findByRole('dialog', { name: 'Repair this workout’s Rhythm link?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Repair this workout' }));

    const error = await screen.findByRole('alert');
    expect(error.textContent).toMatch(/repair-specific recovery archive already contains different data/i);
    expect(error.textContent).toMatch(/no workout repair was written/i);
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
    expect(local.storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBe(earlierRecovery);
    expect(local.storage.getItem(PREVIEW_STRENGTH_REPAIR_RECOVERY_KEY)).toBe(existingRepairArchive);
    expect(onRepair).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('reports the preserved source and no confirmed repair when the active write fails', async () => {
    const user = userEvent.setup();
    const data = missingCompletionData();
    const local = accountStorage(data);
    const earlierRecovery = '{"preserve":"earlier pre-restore copy"}';
    local.values.set(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY, earlierRecovery);
    const failingStorage: PreviewStorage = {
      getItem: key => local.storage.getItem(key),
      setItem: (key, value) => {
        if (key === PREVIEW_STORAGE_KEY) throw new Error('synthetic active write failure');
        local.storage.setItem(key, value);
      }
    };
    const onRepair = (nextData: PreviewData, expectedRaw: string) => {
      const result = writePreview(failingStorage, nextData, expectedRaw, {
        allowTargetedRepair: true,
        currentDate,
        operation: 'repair'
      });
      return result.kind === 'error' ? result.message : 'Unexpected repair result.';
    };
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => null),
      save: vi.fn(async () => 1)
    };

    renderControls(
      api,
      failingStorage,
      data,
      local.raw,
      undefined,
      () => true,
      accountA,
      true,
      true,
      'account',
      onRepair
    );
    await user.click(screen.getByRole('button', { name: /Check data/ }));
    await user.click(await screen.findByRole('button', { name: /Repair this workout’s broken Rhythm link/ }));
    const confirmation = await screen.findByRole('dialog', { name: 'Repair this workout’s Rhythm link?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Repair this workout' }));

    const error = await screen.findByRole('alert');
    expect(error.textContent).toMatch(/repair save was not confirmed/i);
    expect(error.textContent).toMatch(/exact source is preserved in the repair-specific archive/i);
    expect(error.textContent).toMatch(/account sync was not started/i);
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
    expect(local.storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBe(earlierRecovery);
    expect(local.storage.getItem(PREVIEW_STRENGTH_REPAIR_RECOVERY_KEY)).toBe(local.raw);
    expect(api.save).not.toHaveBeenCalled();
  });

  it('keeps the close control available above a long repair diagnostic', async () => {
    const user = userEvent.setup();
    const data = missingCompletionData();
    const local = accountStorage(data);
    const longDiagnostic = `Synthetic repair diagnostic: ${'field path remains available. '.repeat(120)}`;
    const onRepair = vi.fn(() => longDiagnostic);
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => null),
      save: vi.fn(async () => 1)
    };

    renderControls(api, local.storage, data, local.raw, undefined, () => true, accountA, true, true, 'account', onRepair);
    await user.click(screen.getByRole('button', { name: /Check data/ }));
    await user.click(await screen.findByRole('button', { name: /Repair this workout’s broken Rhythm link/ }));
    const confirmation = await screen.findByRole('dialog', { name: 'Repair this workout’s Rhythm link?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Repair this workout' }));

    const dialog = screen.getByRole('dialog', { name: 'Account recovery' });
    const error = await within(dialog).findByRole('alert');
    const close = within(dialog).getByRole('button', { name: 'Close Account recovery' });
    const scrollRegion = within(dialog).getByRole('region', { name: 'Account recovery content' });
    expect(error.textContent).toContain(longDiagnostic);
    expect(scrollRegion.contains(error)).toBe(true);
    expect(close.closest('.money-goal-dialog__persistent-header')).toBeTruthy();
    expect(close.hasAttribute('disabled')).toBe(false);
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
    expect(api.save).not.toHaveBeenCalled();
  });

  it('stops the targeted repair if the exact recovery copy cannot be written', async () => {
    const user = userEvent.setup();
    const data = missingCompletionData();
    const local = accountStorage(data);
    const failingStorage: PreviewStorage = {
      getItem: key => local.storage.getItem(key),
      setItem: (key, value) => {
        if (key === PREVIEW_STRENGTH_REPAIR_RECOVERY_KEY) throw new Error('synthetic recovery write failure');
        local.storage.setItem(key, value);
      }
    };
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => null),
      save: vi.fn(async () => 1)
    };

    renderControls(api, failingStorage, data, local.raw);
    await user.click(screen.getByRole('button', { name: /Check data/ }));
    await user.click(await screen.findByRole('button', { name: /Repair this workout’s broken Rhythm link/ }));
    const confirmation = await screen.findByRole('dialog', { name: 'Repair this workout’s Rhythm link?' });
    await user.click(within(confirmation).getByRole('button', { name: 'Repair this workout' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/repair recovery copy could not be verified/i);
    expect(screen.getByRole('alert').textContent).toMatch(/no workout repair was written/i);
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
    expect(local.storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBeNull();
    expect(local.storage.getItem(PREVIEW_STRENGTH_REPAIR_RECOVERY_KEY)).toBeNull();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('stops without overwriting when the saved source changes after confirmation', async () => {
    const user = userEvent.setup();
    const data = missingCompletionData();
    const local = accountStorage(data);
    const changedRaw = '{"synthetic":"newer source"}';
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => null),
      save: vi.fn(async () => 1)
    };

    renderControls(api, local.storage, data, local.raw);
    await user.click(screen.getByRole('button', { name: /Check data/ }));
    await user.click(await screen.findByRole('button', { name: /Repair this workout’s broken Rhythm link/ }));
    const confirmation = await screen.findByRole('dialog', { name: 'Repair this workout’s Rhythm link?' });
    local.values.set(PREVIEW_STORAGE_KEY, changedRaw);
    await user.click(within(confirmation).getByRole('button', { name: 'Repair this workout' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/saved device data changed/i);
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(changedRaw);
    expect(local.storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBeNull();
    expect(local.storage.getItem(PREVIEW_STRENGTH_REPAIR_RECOVERY_KEY)).toBeNull();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('stops without writing when the signed-in account changes after confirmation', async () => {
    const user = userEvent.setup();
    const data = missingCompletionData();
    const local = accountStorage(data);
    let accountIsCurrent = true;
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => null),
      save: vi.fn(async () => 1)
    };

    renderControls(api, local.storage, data, local.raw, undefined, () => accountIsCurrent);
    await user.click(screen.getByRole('button', { name: /Check data/ }));
    await user.click(await screen.findByRole('button', { name: /Repair this workout’s broken Rhythm link/ }));
    const confirmation = await screen.findByRole('dialog', { name: 'Repair this workout’s Rhythm link?' });
    accountIsCurrent = false;
    await user.click(within(confirmation).getByRole('button', { name: 'Repair this workout' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/signed-in account changed/i);
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
    expect(local.storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBeNull();
    expect(local.storage.getItem(PREVIEW_STRENGTH_REPAIR_RECOVERY_KEY)).toBeNull();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('hides the repair action when the approved workout is ambiguous', async () => {
    const user = userEvent.setup();
    const data = missingCompletionData();
    data.strength.workouts.push({
      ...data.strength.workouts[0]!,
      id: 'second-lower-body',
      notes: 'Ambiguous synthetic record.'
    });
    const local = accountStorage(data);
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => null),
      save: vi.fn(async () => 1)
    };

    renderControls(api, local.storage, data, local.raw);
    await user.click(screen.getByRole('button', { name: /Check data/ }));

    expect(screen.queryByRole('button', { name: /Repair this workout’s broken Rhythm link/ })).toBeNull();
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
  });

  it('storage permits repair only for the diagnosed validation failure with the exact source copy', () => {
    const data = missingCompletionData();
    const local = accountStorage(data);
    const target = data.strength.workouts[0]!;
    const {
      rhythmId,
      rhythmOccurrence,
      completionId,
      ...preservedWorkout
    } = target;
    void rhythmId;
    void rhythmOccurrence;
    void completionId;
    const repairedData: PreviewData = {
      ...data,
      strength: {
        ...data.strength,
        workouts: [preservedWorkout]
      }
    };
    expect(createValidatedPreviewAccountDocument(repairedData, currentDate)).toBeTruthy();

    expect(writePreview(local.storage, repairedData, local.raw, {
      allowTargetedRepair: true,
      currentDate,
      operation: 'repair'
    })).toMatchObject({
      kind: 'error',
      diagnostic: { rejectedRule: 'targeted-repair-not-approved' }
    });
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);

    const earlierRestoreCopy = '{"different":"restore bytes"}';
    local.storage.setItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY, earlierRestoreCopy);
    expect(writePreview(local.storage, repairedData, local.raw, {
      allowTargetedRepair: true,
      currentDate,
      operation: 'repair'
    })).toMatchObject({
      kind: 'error',
      diagnostic: { rejectedRule: 'targeted-repair-not-approved' }
    });
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
    expect(local.storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBe(earlierRestoreCopy);
    local.storage.setItem(PREVIEW_STRENGTH_REPAIR_RECOVERY_KEY, local.raw);
    expect(writePreview(local.storage, data, local.raw, {
      allowTargetedRepair: true,
      currentDate,
      operation: 'repair'
    })).toMatchObject({
      kind: 'error',
      diagnostic: { rejectedRule: 'targeted-repair-result-invalid' }
    });
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
    expect(writePreview(local.storage, repairedData, local.raw, {
      allowTargetedRepair: true,
      currentDate,
      operation: 'repair'
    })).toMatchObject({ kind: 'saved' });
    expect(local.storage.getItem(PREVIEW_CLOUD_RESTORE_RECOVERY_KEY)).toBe(earlierRestoreCopy);
    expect(local.storage.getItem(PREVIEW_STRENGTH_REPAIR_RECOVERY_KEY)).toBe(local.raw);

    const noOpLocal = accountStorage(data);
    noOpLocal.storage.setItem(PREVIEW_STRENGTH_REPAIR_RECOVERY_KEY, noOpLocal.raw);
    const noOpStorage: PreviewStorage = {
      getItem: key => noOpLocal.storage.getItem(key),
      setItem: (key, value) => {
        if (key !== PREVIEW_STORAGE_KEY) noOpLocal.storage.setItem(key, value);
      }
    };
    expect(writePreview(noOpStorage, repairedData, noOpLocal.raw, {
      allowTargetedRepair: true,
      currentDate,
      operation: 'repair'
    })).toMatchObject({ kind: 'conflict', actualRaw: noOpLocal.raw });
    expect(noOpLocal.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(noOpLocal.raw);

    const invalidForAnotherReason = fitnessData('Wrong diagnosis');
    invalidForAnotherReason.savedRhythms[0]!.timeOfDay =
      'custom-time-block:22222222-2222-4222-8222-222222222222';
    const otherFailure = accountStorage(invalidForAnotherReason);
    otherFailure.storage.setItem(PREVIEW_STRENGTH_REPAIR_RECOVERY_KEY, otherFailure.raw);
    expect(writePreview(otherFailure.storage, createSamplePreviewData(), otherFailure.raw, {
      allowTargetedRepair: true,
      currentDate,
      operation: 'repair'
    })).toMatchObject({
      kind: 'error',
      diagnostic: { rejectedRule: 'targeted-repair-not-approved' }
    });
  });

  it('reports relationship counts without exposing workout contents or identifiers', () => {
    const data = fitnessData('Synthetic relationship diagnostic');
    data.strength.workouts.push(
      { id: 'synthetic-unlinked-workout', date: '2026-11-03', muscleIds: ['back'] },
      {
        id: 'synthetic-missing-completion-workout',
        date: '2026-11-02',
        muscleIds: ['hamstrings'],
        rhythmId: data.savedRhythms[0]!.id,
        rhythmOccurrence: '2026-11-02',
        completionId: 'synthetic-missing-completion'
      },
      {
        id: 'synthetic-missing-rhythm-workout',
        date: '2026-11-01',
        muscleIds: ['shoulders'],
        rhythmId: 'synthetic-missing-rhythm',
        rhythmOccurrence: '2026-11-01',
        completionId: 'synthetic-known-completion'
      }
    );
    data.datedRhythmCompletions.push({
      id: 'synthetic-known-completion',
      rhythmId: data.savedRhythms[0]!.id,
      effectiveDate: '2026-11-01',
      localTime: '15:00',
      timeZone: 'UTC',
      completedAt: '2026-11-01T15:00:00.000Z',
      recordedAt: '2026-11-01T15:00:00.000Z'
    });

    let validationError: unknown;
    try {
      createValidatedPreviewAccountDocument(data, currentDate);
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toMatchObject({
      diagnostic: {
        code: 'preview.strength.completion-link.invalid',
        path: 'data.strength.workouts[*].completionId',
        strengthCompletionLinks: {
          workouts: 4,
          linked: 1,
          unlinked: 1,
          invalid: 2,
          missingRhythm: 1,
          missingCompletion: 1,
          rhythmMismatch: 1
        }
      }
    });
    expect(validationError).toBeInstanceOf(Error);
    if (validationError instanceof Error) {
      expect(validationError.message).toContain('1 linked, 1 unlinked, 2 invalid');
      expect(validationError.message).not.toContain('Synthetic relationship diagnostic');
      expect(validationError.message).not.toContain('synthetic-missing-rhythm');
      expect(validationError.message).not.toContain('synthetic-missing-completion');
      expect(validationError.message).not.toContain('synthetic-unlinked-workout');
      expect(validationError.message).not.toContain('synthetic-missing-completion-workout');
    }
  });

  it('shows relationship counts before any account request or local write', async () => {
    const user = userEvent.setup();
    const data = fitnessData('Synthetic visible relationship diagnostic');
    data.strength.workouts.push({
      id: 'synthetic-visible-invalid-workout',
      date: '2026-11-03',
      muscleIds: ['back'],
      rhythmId: data.savedRhythms[0]!.id,
      rhythmOccurrence: '2026-11-03',
      completionId: 'synthetic-visible-missing-completion'
    });
    const local = accountStorage(data);
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => null),
      save: vi.fn(async () => 1)
    };

    renderControls(api, local.storage, data, local.raw, undefined, () => true, accountA, true, false);
    await user.click(screen.getByRole('button', { name: /Save this device’s copy to account/ }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('1 linked, 0 unlinked, 1 invalid');
    expect(alert.textContent).toContain('missing completion 1');
    expect(alert.textContent).not.toContain('Synthetic visible relationship diagnostic');
    expect(alert.textContent).not.toContain('synthetic-visible-invalid-workout');
    expect(alert.textContent).not.toContain('synthetic-visible-missing-completion');
    expect(api.read).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    expect(local.storage.getItem(PREVIEW_STORAGE_KEY)).toBe(local.raw);
  });

  it('preserves an archived Rhythm’s linked workout through a supported schema migration', () => {
    const data = fitnessData('Synthetic archived relationship');
    const rhythmId = data.savedRhythms[0]!.id;
    data.archivedRhythmIds = [rhythmId];
    data.strength.workouts[0]!.notes = 'Preserve this synthetic workout note.';
    data.strength.workouts.push({
      id: 'synthetic-unlinked-workout',
      date: '2026-11-03',
      muscleIds: ['back']
    });
    const workout = data.strength.workouts[0];
    if (!workout) throw new Error('Synthetic relationship fixture is missing its workout.');
    const preservedWorkout = structuredClone(workout);
    const envelope = JSON.parse(JSON.stringify(createPreviewEnvelope(data))) as {
      schemaVersion: number;
      data: {
        goals: Array<{ supportingRhythmIds?: string[] }>;
      };
    };
    envelope.schemaVersion = 43;
    for (const goal of envelope.data.goals) delete goal.supportingRhythmIds;

    const migrated = parsePreviewBackup(JSON.stringify(envelope), currentDate);

    expect(migrated).toMatchObject({ valid: true, sourceSchemaVersion: 43 });
    if (!migrated.valid) return;
    expect(migrated.envelope.data.archivedRhythmIds).toEqual([rhythmId]);
    expect(migrated.envelope.data.savedRhythms[0]?.id).toBe(rhythmId);
    expect(migrated.envelope.data.strength.workouts[0]).toMatchObject(preservedWorkout);
    expect(migrated.envelope.data.strength.workouts[0]?.supersetGroups).toEqual([]);
    expect(migrated.envelope.data.strength.workouts[1]).toMatchObject({
      id: 'synthetic-unlinked-workout',
      date: '2026-11-03',
      muscleIds: ['back']
    });
    expect(migrated.envelope.data.datedRhythmCompletions[0]?.id).toBe(workout.completionId);
  });

  it('does not invent a missing Strength completion while migrating an older schema', () => {
    const data = fitnessData('Synthetic missing completion migration');
    data.datedRhythmCompletions = [];
    data.activeRhythmCompletions = [];
    const current = createPreviewEnvelope(data);
    const priorData = { ...current.data };
    for (const goal of priorData.goals) delete goal.supportingRhythmIds;
    const raw = JSON.stringify({
      ...current,
      schemaVersion: 43,
      data: priorData
    });

    const migrated = parsePreviewBackup(raw, currentDate);

    expect(migrated).toMatchObject({
      valid: false,
      diagnostic: {
        code: 'preview.strength.completion-link.invalid',
        path: 'data.strength.workouts[*].completionId',
        strengthCompletionLinks: {
          workouts: 1,
          linked: 0,
          unlinked: 0,
          invalid: 1,
          missingCompletion: 1
        }
      }
    });
    expect(raw).toContain('"completionId":"workout-completion-synthetic-missing-completion-migration"');
  });

  it('saves, reloads, saves again, and serializes the same linked workout relationship', () => {
    const data = fitnessData('Synthetic repeated save');
    const local = accountStorage(data);
    const workout = data.strength.workouts[0];
    const completion = data.datedRhythmCompletions[0];
    if (!workout || !completion) throw new Error('Synthetic linked workout fixture is incomplete.');

    const firstSave = writePreview(local.storage, data, local.raw, { currentDate });
    expect(firstSave.kind).toBe('saved');
    if (firstSave.kind !== 'saved') return;
    const reloaded = loadPreview(local.storage, currentDate);
    expect(reloaded.kind).toBe('loaded');
    if (reloaded.kind !== 'loaded') return;
    const secondSave = writePreview(
      local.storage,
      { ...reloaded.data, showTended: !reloaded.data.showTended },
      firstSave.raw,
      { currentDate }
    );
    expect(secondSave.kind).toBe('saved');
    if (secondSave.kind !== 'saved') return;

    const serialized = parsePreviewBackup(secondSave.raw, currentDate);
    expect(serialized.valid).toBe(true);
    if (!serialized.valid) return;
    expect(serialized.envelope.data.strength.workouts[0]).toMatchObject({
      id: workout.id,
      rhythmId: workout.rhythmId,
      rhythmOccurrence: workout.rhythmOccurrence,
      completionId: workout.completionId,
      muscleIds: workout.muscleIds
    });
    expect(serialized.envelope.data.datedRhythmCompletions).toContainEqual(completion);
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

  it('lists and downloads a validated server-preserved account revision without writing either copy', async () => {
    const user = userEvent.setup();
    const data = fitnessData('Server-preserved account');
    const document = createPreviewEnvelope(data);
    const archive = {
      document,
      schemaVersion: PREVIEW_SCHEMA_VERSION,
      revision: 3,
      updatedAt: '2026-11-04T12:00:00.000Z',
      preservedAt: '2026-11-04T12:05:00.000Z'
    };
    const localData = fitnessData('Unchanged device');
    const local = accountStorage(localData);
    const save = vi.fn(async () => 4);
    const listRecoveries = vi.fn(async () => [archive]);
    const api: PreviewAccountBackupApi = {
      read: vi.fn(async () => null),
      save,
      listRecoveries
    };
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:account-recovery');
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL: vi.fn()
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderControls(api, local.storage, localData, local.raw, undefined, () => true, accountA, false);
    await user.click(screen.getByRole('button', { name: /Account recovery/ }));
    const download = await screen.findByRole('button', {
      name: /Download preserved account copy · revision 3/
    });
    await user.click(download);

    expect(await screen.findByText('Previous account copy downloaded unchanged.')).toBeTruthy();
    expect(listRecoveries).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(JSON.parse(await (createObjectURL.mock.calls[0]?.[0] as Blob).text())).toEqual(document);
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
    expect(screen.getByRole('dialog', { name: 'Account recovery' })).toBeTruthy();
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

  it('preserves, reads back, and lists immutable account recovery records through authenticated RPCs', async () => {
    const document = createPreviewEnvelope(fitnessData('Remote recovery'));
    const archive = {
      document,
      schemaVersion: PREVIEW_SCHEMA_VERSION,
      revision: 3,
      updatedAt: '2026-11-04T12:00:00.000Z',
      preservedAt: '2026-11-04T12:05:00.000Z'
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: 3, error: null })
      .mockResolvedValueOnce({ data: archive, error: null })
      .mockResolvedValueOnce({ data: [archive], error: null });
    const api = createPreviewAccountBackupApi({
      from: vi.fn(),
      rpc
    });

    await expect(api.preserveRecovery?.(3)).resolves.toBe(3);
    await expect(api.readRecovery?.(3)).resolves.toEqual(archive);
    await expect(api.listRecoveries?.()).resolves.toEqual([archive]);
    expect(rpc.mock.calls).toEqual([
      ['tend_preserve_preview_backup', { p_expected_revision: 3 }],
      ['tend_read_preview_backup_recovery', { p_source_revision: 3 }],
      ['tend_list_preview_backup_recoveries', {}]
    ]);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(accountA);
  });

  it('distinguishes a stale account revision from an archive collision', async () => {
    const staleRpc = vi.fn(async () => ({
      data: null,
      error: { code: 'P0001', message: 'Stale Preview backup revision' }
    }));
    const staleApi = createPreviewAccountBackupApi({ from: vi.fn(), rpc: staleRpc });
    await expect(staleApi.preserveRecovery?.(3)).rejects.toMatchObject({ kind: 'stale' });

    const collisionRpc = vi.fn(async () => ({
      data: null,
      error: { code: 'P0001', message: 'Preview recovery archive conflict' }
    }));
    const collisionApi = createPreviewAccountBackupApi({ from: vi.fn(), rpc: collisionRpc });
    await expect(collisionApi.preserveRecovery?.(3)).rejects.toMatchObject({
      kind: 'recovery-conflict'
    });
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

  it('preserves validated Calendar sources and visibility through the account backup document', () => {
    const data = createSamplePreviewData();
    data.calendarSources = [{
      id: 'calendar-source-account-sync-test',
      name: 'Synthetic account calendar',
      url: 'https://p123-caldav.icloud.com/published/synthetic-account-sync-token',
      enabled: false
    }];
    data.showCalendarOnToday = false;
    const document = createValidatedPreviewAccountDocument(data, currentDate);
    const restored = validatePreviewAccountBackup({
      document,
      schemaVersion: PREVIEW_SCHEMA_VERSION,
      revision: 3,
      updatedAt: '2026-11-04T12:00:00.000Z'
    }, currentDate);

    expect(restored.data.calendarSources).toEqual(data.calendarSources);
    expect(restored.data.showCalendarOnToday).toBe(false);
  });

  it('backs up migrated current-schema data with user-created People and their details', () => {
    const data = createSamplePreviewData();
    const personId = 'synthetic-person-backup-001';
    data.people.push({ id: personId, displayName: 'Synthetic Contact' });
    data.peopleGroups = data.peopleGroups.map(group => group.id === 'friends'
      ? { ...group, memberIds: [...group.memberIds, personId] }
      : group);
    data.personDetails.push({ personId, relationshipLabel: 'Friend' });

    const envelope = createPreviewEnvelope(data);
    envelope.schemaVersion = PREVIEW_SCHEMA_VERSION;
    const migrated = validatePreviewAccountBackup({
      document: envelope,
      schemaVersion: PREVIEW_SCHEMA_VERSION,
      revision: 1,
      updatedAt: null
    }, currentDate);
    const accountDocument = createValidatedPreviewAccountDocument(migrated.data, currentDate);
    const restored = validatePreviewAccountBackup({
      document: accountDocument,
      schemaVersion: PREVIEW_SCHEMA_VERSION,
      revision: 2,
      updatedAt: null
    }, currentDate);

    expect(restored.data.people).toContainEqual({ id: personId, displayName: 'Synthetic Contact' });
    expect(restored.data.personDetails).toContainEqual({ personId, relationshipLabel: 'Friend' });
    expect(restored.data.peopleGroups.find(group => group.id === 'friends')?.memberIds).toContain(personId);
  });

  it('migrates an older account backup with Calendar sources and defaults visibility to enabled', () => {
    const data = createSamplePreviewData();
    data.calendarSources = [{
      id: 'calendar-source-legacy-account-test',
      name: 'Legacy synthetic calendar',
      url: 'https://p123-caldav.icloud.com/published/synthetic-legacy-account-token',
      enabled: true
    }];
    const current = createPreviewEnvelope(data);
    const priorData = { ...current.data };
    Reflect.deleteProperty(priorData, 'showCalendarOnToday');
    const restored = validatePreviewAccountBackup({
      document: {
        format: current.format,
        schemaVersion: 41,
        data: priorData
      },
      schemaVersion: 41,
      revision: 2,
      updatedAt: '2026-11-03T12:00:00.000Z'
    }, currentDate);

    expect(restored.sourceSchemaVersion).toBe(41);
    expect(restored.data.calendarSources).toEqual(data.calendarSources);
    expect(restored.data.showCalendarOnToday).toBe(true);
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

  it('reports a privacy-safe validation code and field path without echoing document values', () => {
    const data = fitnessData('Synthetic diagnostic');
    data.savedRhythms[0]!.timeOfDay = 'custom-time-block:22222222-2222-4222-8222-222222222222';
    let validationError: unknown;
    try {
      createValidatedPreviewAccountDocument(data, currentDate);
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toMatchObject({
      kind: 'invalid',
      diagnostic: {
        code: 'preview.rhythm-time-block.unconfigured',
        path: 'data.savedRhythms[*].timeOfDay or data.savedRhythms[*].scoring.scheduleHistory[*].timeOfDay'
      }
    });
    expect(validationError).toBeInstanceOf(Error);
    if (validationError instanceof Error) {
      expect(validationError.message).toContain('Diagnostic: preview.rhythm-time-block.unconfigured');
      expect(validationError.message).not.toContain('Synthetic diagnostic');
      expect(validationError.message).not.toContain('custom-time-block:22222222');
    }
  });

  it('identifies an unrecognized data field without exposing its value', () => {
    const envelope = createPreviewEnvelope(fitnessData('Synthetic field diagnostic'));
    const invalid = {
      ...envelope,
      data: { ...envelope.data, unexpectedField: 'private synthetic note' }
    };

    expect(validatePreviewEnvelope(invalid, currentDate)).toMatchObject({
      valid: false,
      diagnostic: {
        code: 'preview.data.unrecognized-field',
        path: 'data.unexpectedField'
      }
    });
    expect(JSON.stringify(validatePreviewEnvelope(invalid, currentDate)))
      .not.toContain('private synthetic note');
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
