import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PreviewData, PreviewEnvelope } from '../domain/preview-state.ts';
import {
  createValidatedPreviewAccountDocument,
  previewEnvelopesEqual,
  validatePreviewAccountBackup
} from '../storage/preview-account-backup.ts';
import type {
  PreviewAccountBackupApi,
  PreviewAccountBackupRecord,
  ValidatedPreviewAccountBackup
} from '../storage/preview-account-backup.ts';
import {
  PREVIEW_STORAGE_KEY,
  preservePreviewBeforeCloudRestore,
  loadPreviewImportSyncGuard,
  resolvePreviewImportSyncGuard
} from '../storage/preview-storage.ts';
import type { PreviewStorage } from '../storage/preview-storage.ts';
import { PreviewAccountBackupControls } from './PreviewAccountBackupControls.tsx';
import type { VerifiedAccountStatus } from './PreviewAccountBackupControls.tsx';

const syncStateKey = `${PREVIEW_STORAGE_KEY}:account-sync-state`;
const syncCloudRecoveryKey = `${PREVIEW_STORAGE_KEY}:account-sync-cloud-recovery`;
const syncDeviceRecoveryKey = `${PREVIEW_STORAGE_KEY}:account-sync-device-recovery`;
const syncDebounceMs = 900;

type SyncMetadata = {
  accountId: string;
  revision: number;
  syncedEnvelope: PreviewEnvelope | null;
  syncedAt: string | null;
};

type LocalSnapshot = {
  data: PreviewData;
  raw: string | null;
  envelope: PreviewEnvelope;
};

type SyncConflict = {
  localRaw: string | null;
  localEnvelope: PreviewEnvelope;
  cloud: ValidatedPreviewAccountBackup;
  revision: number;
  updatedAt: string | null;
};

type SyncStatus =
  | { kind: 'checking' }
  | { kind: 'device' }
  | { kind: 'saving' }
  | { kind: 'account'; savedAt: string | null }
  | { kind: 'offline' }
  | { kind: 'attention'; message: string }
  | { kind: 'conflict' };

type PreviewAccountSyncProps = {
  portalTarget: HTMLElement | null;
  api: PreviewAccountBackupApi | null;
  accountId: string;
  authRefreshSequence: number;
  storage: PreviewStorage;
  data: PreviewData;
  localIsPristine: boolean;
  currentDate: string;
  localRaw: string | null;
  localRecoveryRaw: string | null;
  localRecoveryError: string | null;
  enabled: boolean;
  autoSyncEnabled: boolean;
  visible: boolean;
  manualOperationLocked: boolean;
  isIdentityCurrent: () => boolean;
  onRestore: (data: PreviewData, expectedLocalRaw: string | null) => string | null;
  onManualOperationLockChange: (locked: boolean) => void;
};

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Account sync could not be completed.';
}

function resolvePendingImportGuard(storage: PreviewStorage): string | null {
  const result = loadPreviewImportSyncGuard(storage);
  if (result.kind === 'error') return result.message;
  if (result.guard.kind !== 'pending') return null;
  const resolved = resolvePreviewImportSyncGuard(storage, result.guard.importedRaw);
  return resolved.kind === 'error' ? resolved.message : null;
}

function parseMetadata(
  storage: PreviewStorage,
  accountId: string,
  currentDate: string
): SyncMetadata | null {
  const raw = storage.getItem(syncStateKey);
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Saved sync information is invalid. No account data was changed.');
  }
  const value = parsed as Record<string, unknown>;
  if (value.accountId !== accountId
    || !Number.isSafeInteger(value.revision)
    || (value.revision as number) < 0
    || (value.syncedAt !== null && typeof value.syncedAt !== 'string')) {
    throw new Error('Saved sync information is invalid. No account data was changed.');
  }
  if (value.syncedEnvelope !== null) {
    const record = {
      document: value.syncedEnvelope,
      schemaVersion: (value.syncedEnvelope as { schemaVersion?: number }).schemaVersion,
      revision: Math.max(1, value.revision as number),
      updatedAt: value.syncedAt as string | null
    } as PreviewAccountBackupRecord;
    const validated = validatePreviewAccountBackup(record, currentDate);
    return {
      accountId,
      revision: value.revision as number,
      syncedEnvelope: validated.envelope,
      syncedAt: value.syncedAt as string | null
    };
  }
  if (value.revision !== 0 || value.syncedAt !== null) {
    throw new Error('Saved sync information is invalid. No account data was changed.');
  }
  return {
    accountId,
    revision: 0,
    syncedEnvelope: null,
    syncedAt: null
  };
}

function saveMetadata(storage: PreviewStorage, metadata: SyncMetadata): void {
  const serialized = JSON.stringify(metadata);
  storage.setItem(syncStateKey, serialized);
  if (storage.getItem(syncStateKey) !== serialized) {
    throw new Error('Sync progress could not be saved on this device.');
  }
}

function readLocalSnapshot(
  data: PreviewData,
  raw: string | null,
  currentDate: string
): LocalSnapshot {
  return {
    data,
    raw,
    envelope: createValidatedPreviewAccountDocument(data, currentDate)
  };
}

function formatTime(value: string | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : null;
}

function downloadCloudRecovery(raw: string): string | null {
  try {
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tend-preview-before-account-sync.json';
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return null;
  } catch (error) {
    return messageFor(error);
  }
}

export function PreviewAccountSync({
  portalTarget,
  api,
  accountId,
  authRefreshSequence,
  storage,
  data,
  localIsPristine,
  currentDate,
  localRaw,
  localRecoveryRaw,
  localRecoveryError,
  enabled,
  autoSyncEnabled,
  visible,
  manualOperationLocked,
  isIdentityCurrent,
  onRestore,
  onManualOperationLockChange
}: PreviewAccountSyncProps) {
  const [status, setStatus] = useState<SyncStatus>({ kind: 'checking' });
  const [verifiedAccountStatus, setVerifiedAccountStatus] = useState<{
    accountId: string;
    status: VerifiedAccountStatus;
  } | null>(null);
  const [conflict, setConflictState] = useState<SyncConflict | null>(null);
  const [syncMessage, setSyncMessage] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [cloudRecoveryRaw, setCloudRecoveryRaw] = useState<string | null>(null);
  const [cloudRecoveryError, setCloudRecoveryError] = useState('');
  const [deviceRecoveryRaw, setDeviceRecoveryRaw] = useState<string | null>(null);
  const [deviceRecoveryError, setDeviceRecoveryError] = useState('');
  const latest = useRef({
    api,
    accountId,
    storage,
    data,
    localIsPristine,
    currentDate,
    localRaw,
    enabled,
    autoSyncEnabled,
    manualOperationLocked,
    isIdentityCurrent,
    onRestore
  });
  const controlRef = useRef<{ refresh: () => void; changed: () => void } | null>(null);
  const previousManualOperationLocked = useRef(manualOperationLocked);
  const previousLocalInputs = useRef({ data, localRaw });
  const previousAuthRefreshSequence = useRef(authRefreshSequence);
  latest.current = {
    api,
    accountId,
    storage,
    data,
    localIsPristine,
    currentDate,
    localRaw,
    enabled,
    autoSyncEnabled,
    manualOperationLocked,
    isIdentityCurrent,
    onRestore
  };
  useEffect(() => {
    try {
      setCloudRecoveryRaw(storage.getItem(syncCloudRecoveryKey));
      setCloudRecoveryError('');
      setDeviceRecoveryRaw(storage.getItem(syncDeviceRecoveryKey));
      setDeviceRecoveryError('');
    } catch (error) {
      setCloudRecoveryRaw(null);
      setCloudRecoveryError(messageFor(error));
      setDeviceRecoveryRaw(null);
      setDeviceRecoveryError(messageFor(error));
    }
  }, [storage, accountId]);

  useEffect(() => {
    if (!enabled || !autoSyncEnabled) {
      setStatus({ kind: 'device' });
      setConflictState(null);
      return;
    }
    if (!api) {
      setStatus({ kind: 'attention', message: 'Account sync is unavailable in this Preview session. Changes remain on this device.' });
      setConflictState(null);
      return;
    }

    let active = true;
    let started = false;
    let localChangedDuringStartup = false;
    let busy = false;
    let refreshRequested = false;
    let localTimer: ReturnType<typeof setTimeout> | null = null;
    let metadata: SyncMetadata | null = null;

    function current(): boolean {
      return active && latest.current.enabled && latest.current.autoSyncEnabled
        && latest.current.accountId === accountId
        && latest.current.isIdentityCurrent();
    }

    function clearLocalTimer() {
      if (localTimer !== null) clearTimeout(localTimer);
      localTimer = null;
    }

    function setAttention(error: unknown) {
      if (!current()) return;
      if (!navigator.onLine) setStatus({ kind: 'offline' });
      else setStatus({ kind: 'attention', message: messageFor(error) });
    }

    function remember(
      envelope: PreviewEnvelope | null,
      revision: number,
      savedAt: string | null
    ): void {
      const next = { accountId, revision, syncedEnvelope: envelope, syncedAt: savedAt };
      saveMetadata(storage, next);
      metadata = next;
    }

    function presentConflict(local: LocalSnapshot, cloud: PreviewAccountBackupRecord): void {
      const validated = validatePreviewAccountBackup(cloud, latest.current.currentDate);
      clearLocalTimer();
      setConflictState({
        localRaw: local.raw,
        localEnvelope: local.envelope,
        cloud: validated,
        revision: cloud.revision,
        updatedAt: cloud.updatedAt
      });
      setStatus({ kind: 'conflict' });
    }

    async function applyCloud(
      local: LocalSnapshot,
      cloud: PreviewAccountBackupRecord,
      validated: ValidatedPreviewAccountBackup,
      preserveLocalCopy = true
    ): Promise<void> {
      if (preserveLocalCopy) {
        const preserved = preservePreviewBeforeCloudRestore(storage, local.raw);
        if (preserved.kind !== 'preserved' && preserved.kind !== 'not-needed') {
          throw new Error(preserved.message);
        }
      }
      if (!current()) return;
      const applyError = latest.current.onRestore(validated.data, local.raw);
      if (applyError) throw new Error(applyError);
      remember(validated.envelope, cloud.revision, cloud.updatedAt);
      // The restore callback may not have rerendered yet; don't replay a queued read against stale props.
      refreshRequested = false;
      setConflictState(null);
      setSyncMessage('Newer account data was saved on this device.');
      setStatus({ kind: 'account', savedAt: cloud.updatedAt });
    }

    async function settleWrite(
      document: PreviewEnvelope,
      expectedRevision: number,
      local: LocalSnapshot
    ): Promise<void> {
      const currentApi = latest.current.api;
      if (!currentApi || !current()) return;
      if (latest.current.manualOperationLocked) {
        refreshRequested = true;
        return;
      }
      setStatus({ kind: 'saving' });
      try {
        const revision = await currentApi.save(document, expectedRevision);
        if (!current()) return;
        const savedAt = new Date().toISOString();
        remember(document, revision, savedAt);
        setConflictState(null);
        setStatus({ kind: 'account', savedAt });
        setSyncMessage('');
        const newest = readLocalSnapshot(
          latest.current.data,
          latest.current.localRaw,
          latest.current.currentDate
        );
        if (!previewEnvelopesEqual(newest.envelope, local.envelope)) scheduleLocalSync();
      } catch (writeError) {
        if (!current()) return;
        try {
          const observed = await currentApi.read();
          if (!current()) return;
          if (latest.current.manualOperationLocked) {
            refreshRequested = true;
            return;
          }
          if (observed) {
            const validated = validatePreviewAccountBackup(observed, latest.current.currentDate);
            if (previewEnvelopesEqual(validated.envelope, document)) {
              remember(validated.envelope, observed.revision, observed.updatedAt);
              setConflictState(null);
              setStatus({ kind: 'account', savedAt: observed.updatedAt });
              setSyncMessage('');
              return;
            }
            if (observed.revision !== expectedRevision) {
              presentConflict(local, observed);
              return;
            }
          } else if (expectedRevision !== 0) {
            setConflictState({
              localRaw: local.raw,
              localEnvelope: local.envelope,
              cloud: {
                data: local.data,
                envelope: local.envelope,
                sourceSchemaVersion: local.envelope.schemaVersion
              },
              revision: 0,
              updatedAt: null
            });
            setStatus({ kind: 'attention', message: 'The account backup is no longer available. No local data was changed.' });
            return;
          }
          if (writeError instanceof Error
            && 'kind' in writeError
            && writeError.kind === 'stale') {
            const latestCloud = await currentApi.read();
            if (!current()) return;
            if (latest.current.manualOperationLocked) {
              refreshRequested = true;
              return;
            }
            if (latestCloud) presentConflict(local, latestCloud);
            else setStatus({ kind: 'attention', message: messageFor(writeError) });
            return;
          }
          const retryRevision = await currentApi.save(document, expectedRevision);
          if (!current()) return;
          const savedAt = new Date().toISOString();
          remember(document, retryRevision, savedAt);
          setConflictState(null);
          setStatus({ kind: 'account', savedAt });
          setSyncMessage('');
        } catch (retryError) {
          if (!current()) return;
          setAttention(retryError);
        }
      }
    }

    async function reconcile(): Promise<void> {
      if (!current() || !api || latest.current.manualOperationLocked) return;
      if (busy) {
        refreshRequested = true;
        return;
      }
      busy = true;
      refreshRequested = false;
      clearLocalTimer();
      try {
        const cloud = await api.read();
        if (!current()) return;
        if (latest.current.manualOperationLocked) {
          refreshRequested = true;
          return;
        }
        const local = readLocalSnapshot(
          latest.current.data,
          latest.current.localRaw,
          latest.current.currentDate
        );
        metadata ??= parseMetadata(storage, accountId, latest.current.currentDate);
        const importGuard = loadPreviewImportSyncGuard(storage);
        if (importGuard.kind === 'error') throw new Error(importGuard.message);
        const importPending = importGuard.guard.kind === 'pending';

        if (cloud === null) {
          setVerifiedAccountStatus({ accountId, status: { kind: 'empty' } });
          if (metadata?.revision && metadata.revision > 0) {
            setStatus({
              kind: 'attention',
              message: 'Your account backup is missing. This device was not uploaded automatically.'
            });
            return;
          }
          if (importPending) {
            setStatus({
              kind: 'attention',
              message: 'Imported Preview data is saved on this device. Choose an explicit account backup action before it can be saved to your account.'
            });
            return;
          }
          if (metadata === null) {
            remember(null, 0, null);
          }
          if (local.raw === null) {
            setStatus({ kind: 'device' });
            return;
          }
          await settleWrite(local.envelope, 0, local);
          return;
        }

        const cloudValidated = validatePreviewAccountBackup(cloud, latest.current.currentDate);
        setVerifiedAccountStatus({
          accountId,
          status: {
            kind: 'available',
            revision: cloud.revision,
            updatedAt: cloud.updatedAt
          }
        });
        if (previewEnvelopesEqual(local.envelope, cloudValidated.envelope)) {
          const guardError = importPending ? resolvePendingImportGuard(storage) : null;
          if (guardError) throw new Error(guardError);
          remember(cloudValidated.envelope, cloud.revision, cloud.updatedAt);
          setConflictState(null);
          setStatus({ kind: 'account', savedAt: cloud.updatedAt });
          return;
        }

        if (importPending) {
          presentConflict(local, cloud);
          return;
        }

        if (metadata === null) {
          if (local.raw === null || latest.current.localIsPristine) {
            await applyCloud(local, cloud, cloudValidated);
          } else {
            presentConflict(local, cloud);
          }
          return;
        }

        const localChanged = metadata.syncedEnvelope === null
          ? local.raw !== null
          : !previewEnvelopesEqual(local.envelope, metadata.syncedEnvelope);
        const cloudChanged = metadata.syncedEnvelope === null
          ? true
          : !previewEnvelopesEqual(cloudValidated.envelope, metadata.syncedEnvelope);

        if (!localChanged && cloudChanged) {
          await applyCloud(local, cloud, cloudValidated, false);
          return;
        }
        if (localChanged && !cloudChanged) {
          metadata = {
            accountId,
            revision: cloud.revision,
            syncedEnvelope: cloudValidated.envelope,
            syncedAt: cloud.updatedAt
          };
          await settleWrite(local.envelope, cloud.revision, local);
          return;
        }
        if (!localChanged && !cloudChanged) {
          remember(cloudValidated.envelope, cloud.revision, cloud.updatedAt);
          setStatus({ kind: 'account', savedAt: cloud.updatedAt });
          return;
        }
        presentConflict(local, cloud);
      } catch (error) {
        setAttention(error);
      } finally {
        busy = false;
        if (active && refreshRequested && !latest.current.manualOperationLocked) {
          void reconcile();
        }
      }
    }

    function scheduleLocalSync(): void {
      if (!current() || latest.current.manualOperationLocked || !navigator.onLine) return;
      if (!started) {
        localChangedDuringStartup = true;
        return;
      }
      clearLocalTimer();
      localTimer = setTimeout(() => {
        localTimer = null;
        void reconcile();
      }, syncDebounceMs);
    }

    async function refreshFromLifecycle(): Promise<void> {
      if (!navigator.onLine) {
        if (current()) setStatus({ kind: 'offline' });
        return;
      }
      await reconcile();
      started = true;
      if (current() && localChangedDuringStartup) {
        localChangedDuringStartup = false;
        scheduleLocalSync();
      }
    }

    function onOnline() {
      void refreshFromLifecycle();
    }
    function onOffline() {
      clearLocalTimer();
      if (current()) setStatus({ kind: 'offline' });
    }
    function onForeground() {
      if (document.visibilityState === 'visible') void refreshFromLifecycle();
    }

    void refreshFromLifecycle();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('focus', onForeground);
    document.addEventListener('visibilitychange', onForeground);

    const control = {
      refresh: () => void refreshFromLifecycle(),
      changed: () => scheduleLocalSync()
    };
    controlRef.current = control;

    return () => {
      active = false;
      clearLocalTimer();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('focus', onForeground);
      document.removeEventListener('visibilitychange', onForeground);
      if (controlRef.current === control) controlRef.current = null;
    };
  }, [api, accountId, storage, enabled, autoSyncEnabled]);

  useEffect(() => {
    if (previousAuthRefreshSequence.current === authRefreshSequence) return;
    previousAuthRefreshSequence.current = authRefreshSequence;
    if (autoSyncEnabled) controlRef.current?.refresh();
  }, [authRefreshSequence, autoSyncEnabled]);

  useEffect(() => {
    if (!enabled || !api) return;
    if (manualOperationLocked) {
      setManualBusy(true);
      previousManualOperationLocked.current = true;
      return;
    }
    setManualBusy(false);
    const wasLocked = previousManualOperationLocked.current;
    previousManualOperationLocked.current = false;
    if (wasLocked && autoSyncEnabled) controlRef.current?.refresh();
  }, [manualOperationLocked, enabled, autoSyncEnabled, api]);

  useEffect(() => {
    const changed = previousLocalInputs.current.data !== data
      || previousLocalInputs.current.localRaw !== localRaw;
    previousLocalInputs.current = { data, localRaw };
    if (!changed) return;
    if (!enabled || !autoSyncEnabled || conflict) return;
    controlRef.current?.changed();
  }, [data, localRaw, enabled, autoSyncEnabled, conflict]);

  async function resolveConflict(choice: 'cloud' | 'device') {
    const pending = conflict;
    const currentApi = latest.current.api;
    if (!pending || !currentApi || !latest.current.autoSyncEnabled || !latest.current.isIdentityCurrent()) return;
    setManualBusy(true);
    onManualOperationLockChange(true);
    try {
      const latestCloud = await currentApi.read();
      if (!latest.current.isIdentityCurrent()) return;
      if (!latestCloud || latestCloud.revision !== pending.revision) {
        if (latestCloud) {
          const local = readLocalSnapshot(
            latest.current.data,
            latest.current.localRaw,
            latest.current.currentDate
          );
          const validated = validatePreviewAccountBackup(latestCloud, latest.current.currentDate);
          setConflictState({
            localRaw: local.raw,
            localEnvelope: local.envelope,
            cloud: validated,
            revision: latestCloud.revision,
            updatedAt: latestCloud.updatedAt
          });
        } else {
          setStatus({ kind: 'attention', message: 'The account backup changed or disappeared. No data was replaced.' });
        }
        return;
      }
      const validated = validatePreviewAccountBackup(latestCloud, latest.current.currentDate);
      const local = readLocalSnapshot(
        latest.current.data,
        latest.current.localRaw,
        latest.current.currentDate
      );
      if (local.raw !== pending.localRaw) {
        setStatus({ kind: 'attention', message: 'This device changed while the conflict was open. Review the current versions again.' });
        setConflictState(null);
        controlRef.current?.refresh();
        return;
      }

      if (choice === 'cloud') {
        if (local.raw !== null) {
          const priorDeviceRecovery = storage.getItem(syncDeviceRecoveryKey);
          if (priorDeviceRecovery !== null && priorDeviceRecovery !== local.raw) {
            throw new Error('A different device recovery copy already exists. Download or preserve it before using the account version again.');
          }
          if (priorDeviceRecovery === null) storage.setItem(syncDeviceRecoveryKey, local.raw);
          const savedDeviceRecovery = storage.getItem(syncDeviceRecoveryKey);
          if (savedDeviceRecovery !== local.raw) {
            throw new Error('The previous device version could not be preserved. Nothing was replaced.');
          }
          setDeviceRecoveryRaw(savedDeviceRecovery);
        }
        const applyError = latest.current.onRestore(validated.data, local.raw);
        if (applyError) throw new Error(applyError);
        const guardError = resolvePendingImportGuard(storage);
        if (guardError) throw new Error(guardError);
        saveMetadata(storage, {
          accountId,
          revision: latestCloud.revision,
          syncedEnvelope: validated.envelope,
          syncedAt: latestCloud.updatedAt
        });
        setConflictState(null);
        setStatus({ kind: 'account', savedAt: latestCloud.updatedAt });
        setSyncMessage('Account data was saved on this device. Your previous local copy is recoverable.');
      } else {
        const cloudRecovery = {
          accountId,
          revision: latestCloud.revision,
          document: latestCloud.document,
          updatedAt: latestCloud.updatedAt,
          preservedAt: new Date().toISOString()
        };
        const recoveryRaw = JSON.stringify(cloudRecovery);
        const priorRecovery = storage.getItem(syncCloudRecoveryKey);
        if (priorRecovery !== null) {
          let matches = false;
          try {
            const existing: unknown = JSON.parse(priorRecovery);
            if (typeof existing === 'object' && existing !== null && !Array.isArray(existing)) {
              const value = existing as Record<string, unknown>;
              const existingDocument = value.document;
              if (value.accountId === accountId
                && value.revision === latestCloud.revision
                && typeof existingDocument === 'object'
                && existingDocument !== null
                && !Array.isArray(existingDocument)) {
                const existingRecord = {
                  document: existingDocument,
                  schemaVersion: (existingDocument as { schemaVersion?: number }).schemaVersion,
                  revision: latestCloud.revision,
                  updatedAt: latestCloud.updatedAt
                } as PreviewAccountBackupRecord;
                matches = previewEnvelopesEqual(
                  validatePreviewAccountBackup(existingRecord, latest.current.currentDate).envelope,
                  validated.envelope
                );
              }
            }
          } catch (error) {
            throw new Error(
              `The saved account recovery copy could not be validated (${messageFor(error)}). Download or preserve it before replacing the account version.`
            );
          }
          if (!matches) {
            throw new Error('A different account recovery copy already exists. Download or preserve it before replacing the account version.');
          }
        } else {
          storage.setItem(syncCloudRecoveryKey, recoveryRaw);
        }
        const savedRecovery = storage.getItem(syncCloudRecoveryKey);
        if (savedRecovery !== recoveryRaw) {
          throw new Error('The previous account version could not be preserved. Nothing was replaced.');
        }
        setCloudRecoveryRaw(savedRecovery);
        try {
          const revision = await currentApi.save(local.envelope, latestCloud.revision);
          if (!latest.current.isIdentityCurrent()) return;
          const guardError = resolvePendingImportGuard(storage);
          if (guardError) throw new Error(guardError);
          const savedAt = new Date().toISOString();
          saveMetadata(storage, {
            accountId,
            revision,
            syncedEnvelope: local.envelope,
            syncedAt: savedAt
          });
          setConflictState(null);
          setStatus({ kind: 'account', savedAt });
          setSyncMessage('This device’s data is now saved to your account. The previous account version is recoverable.');
        } catch (error) {
          const observed = await currentApi.read();
          if (!latest.current.isIdentityCurrent()) return;
          if (observed) {
            const observedValidated = validatePreviewAccountBackup(observed, latest.current.currentDate);
            if (previewEnvelopesEqual(observedValidated.envelope, local.envelope)) {
              saveMetadata(storage, {
                accountId,
                revision: observed.revision,
                syncedEnvelope: observedValidated.envelope,
                syncedAt: observed.updatedAt
              });
              setConflictState(null);
              setStatus({ kind: 'account', savedAt: observed.updatedAt });
              setSyncMessage('This device’s data is now saved to your account. The previous account version is recoverable.');
            } else {
              setConflictState({
                localRaw: local.raw,
                localEnvelope: local.envelope,
                cloud: observedValidated,
                revision: observed.revision,
                updatedAt: observed.updatedAt
              });
              setStatus({ kind: 'conflict' });
            }
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      setStatus({
        kind: navigator.onLine ? 'attention' : 'offline',
        ...(navigator.onLine ? { message: messageFor(error) } : {})
      } as SyncStatus);
    } finally {
      setManualBusy(false);
      onManualOperationLockChange(false);
    }
  }

  if (!visible || !portalTarget) return null;

  const statusText = !autoSyncEnabled
    ? 'Automatic sync is off'
    : status.kind === 'checking'
    ? 'Saved on this device'
    : status.kind === 'device'
      ? 'Saved on this device'
      : status.kind === 'saving'
        ? 'Saving…'
        : status.kind === 'account'
          ? 'Saved to your account'
          : status.kind === 'offline'
            ? 'Offline · changes saved on this device'
            : status.kind === 'attention'
              ? 'Needs attention'
              : 'Needs attention';
  const formattedSavedAt = status.kind === 'account' ? formatTime(status.savedAt) : null;

  return createPortal((
    <>
      <section className="settings-section preview-account-sync" aria-labelledby="preview-account-sync-title">
        <h3 id="preview-account-sync-title">
          {autoSyncEnabled ? 'Account sync' : 'Automatic account sync'}
        </h3>
        <p className="preview-account-sync__status" role="status">{statusText}</p>
        {!autoSyncEnabled && (
          <p>Changes stay saved on this device. Use manual backup or restore below to transfer account data.</p>
        )}
        {status.kind === 'account' && formattedSavedAt && (
          <p>Last saved to your account: {formattedSavedAt}.</p>
        )}
        {autoSyncEnabled && status.kind === 'checking' && <p>Checking your account for newer data…</p>}
        {status.kind === 'attention' && <p className="preview-account-sync__error" role="alert">{status.message}</p>}
        {syncMessage && <p role="status">{syncMessage}</p>}
        {conflict && (
          <div className="preview-account-sync__conflict" role="group" aria-labelledby="preview-account-sync-conflict-title">
            <h4 id="preview-account-sync-conflict-title">This device and your account both have changes</h4>
            <p>
              Automatic sync paused. Choose one version to keep; the other is preserved as a recovery copy. Tend will not merge these changes.
            </p>
            <p>
              Account backup: revision {conflict.revision}
              {formatTime(conflict.updatedAt) ? ` · ${formatTime(conflict.updatedAt)}` : ''}.
            </p>
            <div className="preview-account-sync__actions">
              <button type="button" className="btn mini" disabled={manualBusy} onClick={() => void resolveConflict('device')}>
                Keep this device’s changes
              </button>
              <button type="button" className="btn mini ghost" disabled={manualBusy} onClick={() => void resolveConflict('cloud')}>
                Use the account version
              </button>
            </div>
          </div>
        )}
        {status.kind === 'offline' && <p>Edits are kept on this device and will be checked when you reconnect.</p>}
      </section>
      <PreviewAccountBackupControls
        api={api}
        accountId={accountId}
        storage={storage}
        data={data}
        currentDate={currentDate}
        localRaw={localRaw}
        localRecoveryRaw={localRecoveryRaw}
        localRecoveryError={localRecoveryError}
        autoSyncEnabled={autoSyncEnabled}
        enabled={enabled && !manualBusy && (!autoSyncEnabled || (status.kind !== 'saving' && status.kind !== 'checking'))}
        syncBusy={autoSyncEnabled && (status.kind === 'saving' || status.kind === 'checking')}
        verifiedAccountStatus={verifiedAccountStatus?.accountId === accountId
          ? verifiedAccountStatus.status
          : null}
        isIdentityCurrent={isIdentityCurrent}
        onRestore={onRestore}
        onRecoveryChanged={() => {}}
        onExclusiveChange={locked => {
          setManualBusy(locked);
          onManualOperationLockChange(locked);
        }}
        onOperationFinished={() => controlRef.current?.refresh()}
      />
      {cloudRecoveryError && <p className="preview-account-sync__error" role="alert">{cloudRecoveryError}</p>}
      {cloudRecoveryRaw !== null && (
        <button
          type="button"
          className="btn mini ghost"
          onClick={() => {
            const error = downloadCloudRecovery(cloudRecoveryRaw);
            setSyncMessage(error ?? 'The previous account version was downloaded as a recovery copy.');
          }}
        >
          Download previous account version
        </button>
      )}
      {deviceRecoveryError && <p className="preview-account-sync__error" role="alert">{deviceRecoveryError}</p>}
      {deviceRecoveryRaw !== null && (
        <button
          type="button"
          className="btn mini ghost"
          onClick={() => {
            const error = downloadCloudRecovery(deviceRecoveryRaw);
            setSyncMessage(error ?? 'The previous device version was downloaded as a recovery copy.');
          }}
        >
          Download previous device version
        </button>
      )}
    </>
  ), portalTarget);
}
