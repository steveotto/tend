import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { PreviewData, PreviewEnvelope } from '../domain/preview-state.ts';
import {
  PreviewAccountBackupError,
  createValidatedPreviewAccountDocument,
  previewEnvelopesEqual,
  validatePreviewAccountBackup
} from '../storage/preview-account-backup.ts';
import type {
  PreviewAccountBackupApi,
  PreviewAccountBackupRecord,
  PreviewAccountRecoveryArchive,
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
import type { PreviewPersistenceStatus } from './PreviewDataControls.tsx';

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

type ConflictResolutionProgress = {
  choice: 'cloud' | 'device';
  phase: 'checking' | 'preserving' | 'saving' | 'verifying' | 'restoring';
};

type ConflictReadOnlyCheckReport = {
  phase: 'account-read' | 'identity-change' | 'revision-conflict' | 'recovery-archive' | 'unexpected';
  errorCode: 'none' | 'request' | 'invalid' | 'stale' | 'recovery-conflict' | 'unknown' | 'storage-unavailable' | 'archive-invalid' | 'archive-mismatch' | 'unexpected';
  revisionMatch: 'match' | 'mismatch' | 'not-checked';
  archiveMatch: 'match' | 'mismatch' | 'missing' | 'invalid' | 'unavailable' | 'not-checked';
};

type ConflictResolutionPhase =
  | 'account-read'
  | 'identity-check'
  | 'revision-check'
  | 'device-check'
  | 'recovery-archive'
  | 'account-save'
  | 'save-verification'
  | 'post-save-bookkeeping';

type RecoveryArchiveFailureCode =
  | 'storage-unavailable'
  | 'archive-read-failed'
  | 'archive-write-failed'
  | 'archive-readback-failed'
  | 'archive-readback-missing'
  | 'archive-readback-mismatch'
  | 'archive-serialization-failed'
  | 'archive-invalid'
  | 'account-archive-write-failed'
  | 'account-archive-readback-failed'
  | 'account-archive-readback-missing'
  | 'account-archive-readback-mismatch';

class RecoveryArchivePersistenceError extends Error {
  constructor(readonly code: RecoveryArchiveFailureCode) {
    super(code);
    this.name = 'RecoveryArchivePersistenceError';
  }
}

type SyncStatus =
  | { kind: 'checking' }
  | { kind: 'device' }
  | { kind: 'pending' }
  | { kind: 'saving' }
  | { kind: 'account'; savedAt: string | null }
  | { kind: 'offline' }
  | { kind: 'attention'; message: string }
  | { kind: 'conflict' };

type PreviewAccountSyncProps = {
  children?: ReactNode;
  portalTarget: HTMLElement | null;
  recoveryPortalTarget: HTMLElement | null;
  api: PreviewAccountBackupApi | null;
  accountId: string;
  email?: string;
  authRefreshSequence: number;
  storage: PreviewStorage;
  data: PreviewData;
  localIsPristine: boolean;
  currentDate: string;
  localRaw: string | null;
  importRecoveryRaw?: string | null;
  importRecoverySourceRaw?: string | null;
  importRecoveryArchiveRaw?: string | null;
  importRecoveryError?: string | null;
  localRecoveryRaw: string | null;
  localRecoveryError: string | null;
  repairRecoveryRaw: string | null;
  repairRecoveryError: string | null;
  onRepairRecoveryChanged: () => void;
  onRecoveryArchiveChanged?: () => void;
  enabled: boolean;
  localSaveConfirmed: boolean;
  localSaveStatus: PreviewPersistenceStatus['kind'];
  localSaveError: string | null;
  onRetryLocalSave: () => void;
  autoSyncEnabled: boolean;
  visible: boolean;
  onOpenRecovery: () => void;
  manualOperationLocked: boolean;
  isIdentityCurrent: () => boolean;
  onRestore: (
    data: PreviewData,
    expectedLocalRaw: string | null,
    restoreKind?: 'manual-recovery'
  ) => string | null;
  onRepair: (data: PreviewData, expectedLocalRaw: string) => string | null;
  onManualOperationLockChange: (locked: boolean) => void;
};

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Account sync could not be completed.';
}

function conflictResolutionFailureMessage(
  error: unknown,
  phase: ConflictResolutionPhase,
  accountSaveStarted: boolean,
  accountSaveConfirmed: boolean
): string {
  const safeMessages = new Set([
    'A different account recovery copy already exists. It was left unchanged; no account write was attempted.',
    'A different device recovery copy already exists. Download or preserve it before using the account version again.'
  ]);
  if (error instanceof RecoveryArchivePersistenceError) {
    switch (error.code) {
      case 'storage-unavailable':
        return 'Recovery storage is unavailable (storage-unavailable). No account write was attempted; existing archives were not changed.';
      case 'archive-read-failed':
        return 'The recovery archive could not be read (archive-read-failed). No account write was attempted; no archive was overwritten.';
      case 'archive-write-failed':
        return 'The recovery archive write failed (archive-write-failed). No account write was attempted; the archive may have been created. Do not clear it.';
      case 'archive-readback-failed':
        return 'Recovery archive read-back failed (archive-readback-failed). No account write was attempted; do not clear the archive.';
      case 'archive-readback-missing':
        return 'Recovery archive read-back was missing (archive-readback-missing). No account write was attempted; no archive was visible after writing.';
      case 'archive-readback-mismatch':
        return 'Recovery archive read-back mismatched (archive-readback-mismatch). No account write was attempted; do not clear or replace any archive.';
      case 'archive-serialization-failed':
        return 'The recovery archive could not be serialized (archive-serialization-failed). No archive or account write was attempted.';
      case 'archive-invalid':
        return 'The existing recovery archive is invalid (archive-invalid). It was left unchanged; no account write was attempted.';
      case 'account-archive-write-failed':
        return 'The previous account copy could not be preserved remotely (account-archive-write-failed). No account replacement was attempted; the archive may have been created.';
      case 'account-archive-readback-failed':
        return 'The remote recovery archive could not be read back (account-archive-readback-failed). No account replacement was attempted; do not clear any archive.';
      case 'account-archive-readback-missing':
        return 'The remote recovery archive was missing after preservation (account-archive-readback-missing). No account replacement was attempted.';
      case 'account-archive-readback-mismatch':
        return 'The remote recovery archive did not match the reviewed account copy (account-archive-readback-mismatch). No account replacement was attempted; the archive was left unchanged.';
    }
  }
  if (error instanceof Error && safeMessages.has(error.message)) return error.message;
  if (accountSaveConfirmed) {
    return 'The account copy was confirmed, but local recovery or sync bookkeeping could not be completed. Check Save & sync before retrying; no second account write was attempted.';
  }
  if (accountSaveStarted) {
    return 'The account save may have completed, but its result could not be confirmed. Check the account status before retrying; no automatic retry was made.';
  }
  if (phase === 'account-read') {
    return 'The latest account copy could not be read or validated. No recovery archive or account write was attempted; use the read-only conflict check before proceeding.';
  }
  if (phase === 'recovery-archive') {
    return 'The recovery archive could not be verified. No account write was attempted; the archive may have been created. Do not clear it; use the read-only conflict check before proceeding.';
  }
  return 'An unexpected error stopped conflict resolution before the account write. No account write was attempted; the conflict and recovery archive were left in place. Use the read-only conflict check before proceeding.';
}

function hasPreviewStorage(storage: PreviewStorage | null | undefined): storage is PreviewStorage {
  return storage !== null
    && storage !== undefined
    && typeof storage.getItem === 'function'
    && typeof storage.setItem === 'function';
}

function readRecoveryArchive(storage: PreviewStorage, key: string, readBack = false): string | null {
  if (!hasPreviewStorage(storage)) throw new RecoveryArchivePersistenceError('storage-unavailable');
  try {
    return storage.getItem(key);
  } catch {
    throw new RecoveryArchivePersistenceError(readBack ? 'archive-readback-failed' : 'archive-read-failed');
  }
}

function writeAndVerifyMissingRecoveryArchive(
  storage: PreviewStorage,
  key: string,
  raw: string
): string {
  if (!hasPreviewStorage(storage)) throw new RecoveryArchivePersistenceError('storage-unavailable');
  try {
    storage.setItem(key, raw);
  } catch {
    throw new RecoveryArchivePersistenceError('archive-write-failed');
  }
  const savedRaw = readRecoveryArchive(storage, key, true);
  if (savedRaw === null) throw new RecoveryArchivePersistenceError('archive-readback-missing');
  if (savedRaw !== raw) throw new RecoveryArchivePersistenceError('archive-readback-mismatch');
  return savedRaw;
}

function serializeRecoveryArchive(value: unknown): string {
  try {
    const raw = JSON.stringify(value);
    if (typeof raw !== 'string') throw new Error('not-serializable');
    return raw;
  } catch {
    throw new RecoveryArchivePersistenceError('archive-serialization-failed');
  }
}

function accountReadErrorCode(error: unknown): ConflictReadOnlyCheckReport['errorCode'] {
  if (error instanceof PreviewAccountBackupError) return error.kind;
  return 'unknown';
}

function compareAccountRecoveryArchive(
  priorRaw: string | null,
  accountId: string,
  latestCloud: PreviewAccountBackupRecord,
  validated: ValidatedPreviewAccountBackup,
  currentDate: string
): ConflictReadOnlyCheckReport['archiveMatch'] {
  if (priorRaw === null) return 'missing';
  try {
    const existing: unknown = JSON.parse(priorRaw);
    if (typeof existing !== 'object' || existing === null || Array.isArray(existing)) return 'invalid';
    const value = existing as Record<string, unknown>;
    const existingDocument = value.document;
    if (value.accountId !== accountId || value.revision !== latestCloud.revision) return 'mismatch';
    if (typeof existingDocument !== 'object' || existingDocument === null || Array.isArray(existingDocument)) {
      return 'invalid';
    }
    const schemaVersion = (existingDocument as { schemaVersion?: unknown }).schemaVersion;
    if (typeof schemaVersion !== 'number') return 'invalid';
    const existingRecord: PreviewAccountBackupRecord = {
      document: existingDocument,
      schemaVersion,
      revision: latestCloud.revision,
      updatedAt: latestCloud.updatedAt
    };
    const existingValidated = validatePreviewAccountBackup(existingRecord, currentDate);
    return previewEnvelopesEqual(existingValidated.envelope, validated.envelope) ? 'match' : 'mismatch';
  } catch {
    return 'invalid';
  }
}

function timestampsMatch(left: string | null, right: string): boolean {
  if (left === null) return false;
  if (left === right) return true;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && leftTime === rightTime;
}

function compareRemoteAccountRecoveryArchive(
  archive: PreviewAccountRecoveryArchive | null,
  latestCloud: PreviewAccountBackupRecord,
  validated: ValidatedPreviewAccountBackup,
  currentDate: string
): ConflictReadOnlyCheckReport['archiveMatch'] {
  if (archive === null) return 'missing';
  if (archive.revision !== latestCloud.revision
    || archive.schemaVersion !== latestCloud.schemaVersion
    || !timestampsMatch(latestCloud.updatedAt, archive.updatedAt)) return 'mismatch';
  if (!Number.isFinite(Date.parse(archive.preservedAt))) return 'invalid';
  try {
    const archived = validatePreviewAccountBackup({
      document: archive.document,
      schemaVersion: archive.schemaVersion,
      revision: archive.revision,
      updatedAt: archive.updatedAt
    }, currentDate);
    return previewEnvelopesEqual(archived.envelope, validated.envelope) ? 'match' : 'mismatch';
  } catch {
    return 'invalid';
  }
}

function conflictReadOnlyCheckMessage(report: ConflictReadOnlyCheckReport): string {
  return `Read-only conflict check — phase: ${report.phase}; error code: ${report.errorCode}; revision match: ${report.revisionMatch}; archive match: ${report.archiveMatch}.`;
}

function conflictProgressMessage(progress: ConflictResolutionProgress): string {
  if (progress.phase === 'checking') return 'Checking the latest account copy…';
  if (progress.choice === 'device') {
    if (progress.phase === 'preserving') return 'Preserving the current account copy…';
    if (progress.phase === 'saving') return 'Saving this device’s copy to your account…';
    return 'Checking whether the account save completed…';
  }
  if (progress.phase === 'preserving') return 'Preserving this device’s copy…';
  return 'Applying the account copy to this device…';
}

function syncAttentionSummary(message: string): string {
  if (message.includes('archive-readback-missing')) {
    return 'The previous account version could not be verified, so the account was not updated.';
  }
  if (message.includes('archive-write-failed') || message.includes('archive-readback-failed')
    || message.includes('archive-readback-mismatch')) {
    return 'The previous account version could not be safely preserved, so the account was not updated.';
  }
  if (message.includes('latest account copy could not be read')) {
    return 'The account copy could not be checked. No upload was made.';
  }
  if (message.includes('may have completed') || message.includes('could not be confirmed')) {
    return 'The account save needs confirmation before another upload.';
  }
  return 'Automatic sync did not finish. Review the details before retrying.';
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

export function PreviewAccountSync({
  children,
  portalTarget,
  recoveryPortalTarget,
  api,
  accountId,
  email,
  authRefreshSequence,
  storage,
  data,
  localIsPristine,
  currentDate,
  localRaw,
  importRecoveryRaw = null,
  importRecoverySourceRaw = null,
  importRecoveryArchiveRaw = null,
  importRecoveryError = null,
  localRecoveryRaw,
  localRecoveryError,
  repairRecoveryRaw,
  repairRecoveryError,
  onRepairRecoveryChanged,
  onRecoveryArchiveChanged,
  enabled,
  localSaveConfirmed,
  localSaveStatus,
  localSaveError,
  onRetryLocalSave,
  autoSyncEnabled,
  visible,
  onOpenRecovery,
  manualOperationLocked,
  isIdentityCurrent,
  onRestore,
  onRepair,
  onManualOperationLockChange
}: PreviewAccountSyncProps) {
  const [status, setStatus] = useState<SyncStatus>({ kind: 'checking' });
  const statusRef = useRef(status);
  const [verifiedAccountStatus, setVerifiedAccountStatus] = useState<{
    accountId: string;
    status: VerifiedAccountStatus;
  } | null>(null);
  const [conflict, setConflictState] = useState<SyncConflict | null>(null);
  const [syncMessage, setSyncMessage] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [restoreFailure, setRestoreFailure] = useState<string | null>(null);
  const [conflictResolutionProgress, setConflictResolutionProgress] =
    useState<ConflictResolutionProgress | null>(null);
  const conflictResolutionInFlight = useRef(false);
  const [conflictReadOnlyCheckBusy, setConflictReadOnlyCheckBusy] = useState(false);
  const conflictReadOnlyCheckInFlight = useRef(false);
  const [conflictReadOnlyCheckReport, setConflictReadOnlyCheckReport] =
    useState<ConflictReadOnlyCheckReport | null>(null);
  const [cloudRecoveryRaw, setCloudRecoveryRaw] = useState<string | null>(null);
  const [cloudRecoveryError, setCloudRecoveryError] = useState('');
  const [deviceRecoveryRaw, setDeviceRecoveryRaw] = useState<string | null>(null);
  const [deviceRecoveryError, setDeviceRecoveryError] = useState('');
  useEffect(() => {
    if (!syncMessage) return;
    const timeout = window.setTimeout(() => setSyncMessage(''), 5_000);
    return () => window.clearTimeout(timeout);
  }, [syncMessage]);
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
  const skipNextManualUnlockRefresh = useRef(false);
  const previousLocalInputs = useRef({ data, localRaw });
  const previousAuthRefreshSequence = useRef(authRefreshSequence);
  useEffect(() => {
    setRestoreFailure(null);
  }, [accountId]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
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

    function hasPendingLocalChanges(): boolean | null {
      if (metadata === null) return null;
      const local = readLocalSnapshot(
        latest.current.data,
        latest.current.localRaw,
        latest.current.currentDate
      );
      if (metadata.syncedEnvelope === null) return local.raw !== null;
      return !previewEnvelopesEqual(local.envelope, metadata.syncedEnvelope);
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
        setStatus({ kind: 'checking' });
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
      if (!current() || latest.current.manualOperationLocked) return;
      if (!started) {
        localChangedDuringStartup = true;
        if (navigator.onLine) return;
      }
      clearLocalTimer();
      let hasPendingChanges: boolean | null;
      try {
        metadata ??= parseMetadata(storage, accountId, latest.current.currentDate);
        hasPendingChanges = hasPendingLocalChanges();
      } catch (error) {
        setAttention(error);
        return;
      }
      if (!navigator.onLine) {
        if (hasPendingChanges) setStatus({ kind: 'offline' });
        return;
      }
      if (hasPendingChanges) setStatus({ kind: 'pending' });
      localTimer = setTimeout(() => {
        localTimer = null;
        void reconcile();
      }, syncDebounceMs);
    }

    async function refreshFromLifecycle(): Promise<void> {
      if (!navigator.onLine) {
        if (current() && ['pending', 'saving'].includes(statusRef.current.kind)) {
          setStatus({ kind: 'offline' });
        } else if (current()) {
          try {
            metadata ??= parseMetadata(storage, accountId, latest.current.currentDate);
            if (hasPendingLocalChanges()) setStatus({ kind: 'offline' });
          } catch (error) {
            setAttention(error);
          }
        }
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
      if (current() && ['pending', 'saving'].includes(statusRef.current.kind)) {
        setStatus({ kind: 'offline' });
      }
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
    if (wasLocked && autoSyncEnabled) {
      if (skipNextManualUnlockRefresh.current) skipNextManualUnlockRefresh.current = false;
      else controlRef.current?.refresh();
    }
  }, [manualOperationLocked, enabled, autoSyncEnabled, api]);

  useEffect(() => {
    const changed = previousLocalInputs.current.data !== data
      || previousLocalInputs.current.localRaw !== localRaw;
    previousLocalInputs.current = { data, localRaw };
    if (!changed) return;
    if (!enabled || !autoSyncEnabled || conflict) return;
    controlRef.current?.changed();
  }, [data, localRaw, enabled, autoSyncEnabled, conflict]);

  async function checkConflictReadOnly() {
    const pending = conflict;
    const current = latest.current;
    const currentApi = current.api;
    if (conflictReadOnlyCheckInFlight.current
      || conflictResolutionInFlight.current
      || manualBusy
      || manualOperationLocked
      || !pending
      || !currentApi
      || !current.autoSyncEnabled) return;

    try {
      if (!current.isIdentityCurrent()) {
        setConflictReadOnlyCheckReport({
          phase: 'identity-change',
          errorCode: 'none',
          revisionMatch: 'not-checked',
          archiveMatch: 'not-checked'
        });
        setStatus({
          kind: 'attention',
          message: 'The signed-in account changed during conflict review. No account data was changed; reopen Save & sync for the current account.'
        });
        return;
      }
    } catch {
      setConflictReadOnlyCheckReport({
        phase: 'unexpected',
        errorCode: 'unexpected',
        revisionMatch: 'not-checked',
        archiveMatch: 'not-checked'
      });
      return;
    }

    conflictReadOnlyCheckInFlight.current = true;
    setConflictReadOnlyCheckBusy(true);
    setConflictReadOnlyCheckReport(null);
    let revisionMatch: ConflictReadOnlyCheckReport['revisionMatch'] = 'not-checked';
    let archiveMatch: ConflictReadOnlyCheckReport['archiveMatch'] = 'not-checked';
    try {
      let latestCloud: PreviewAccountBackupRecord | null;
      try {
        latestCloud = await currentApi.read();
      } catch (error) {
        setConflictReadOnlyCheckReport({
          phase: 'account-read',
          errorCode: accountReadErrorCode(error),
          revisionMatch,
          archiveMatch
        });
        return;
      }

      let identityCurrent = false;
      try {
        identityCurrent = latest.current.isIdentityCurrent();
      } catch {
        setConflictReadOnlyCheckReport({
          phase: 'unexpected',
          errorCode: 'unexpected',
          revisionMatch,
          archiveMatch
        });
        return;
      }
      if (!identityCurrent) {
        setConflictReadOnlyCheckReport({
          phase: 'identity-change',
          errorCode: 'none',
          revisionMatch,
          archiveMatch
        });
        setStatus({
          kind: 'attention',
          message: 'The signed-in account changed during conflict review. No account data was changed; reopen Save & sync for the current account.'
        });
        return;
      }

      if (!latestCloud || latestCloud.revision !== pending.revision) {
        revisionMatch = 'mismatch';
        if (latestCloud) {
          let validated: ValidatedPreviewAccountBackup;
          try {
            validated = validatePreviewAccountBackup(latestCloud, latest.current.currentDate);
          } catch (error) {
            setConflictReadOnlyCheckReport({
              phase: 'account-read',
              errorCode: accountReadErrorCode(error),
              revisionMatch,
              archiveMatch
            });
            return;
          }
          const local = readLocalSnapshot(
            latest.current.data,
            latest.current.localRaw,
            latest.current.currentDate
          );
          setConflictState({
            localRaw: local.raw,
            localEnvelope: local.envelope,
            cloud: validated,
            revision: latestCloud.revision,
            updatedAt: latestCloud.updatedAt
          });
          setStatus({
            kind: 'attention',
            message: 'The account copy changed while this conflict was open. The comparison is refreshed; choose again to use the current account revision. No overwrite was attempted.'
          });
        } else {
          setStatus({
            kind: 'attention',
            message: 'The account backup disappeared while this conflict was open. No data was changed; refresh the comparison before choosing again.'
          });
        }
        setConflictReadOnlyCheckReport({
          phase: 'revision-conflict',
          errorCode: 'none',
          revisionMatch,
          archiveMatch
        });
        return;
      }

      revisionMatch = 'match';
      let validated: ValidatedPreviewAccountBackup;
      try {
        validated = validatePreviewAccountBackup(latestCloud, latest.current.currentDate);
      } catch (error) {
        setConflictReadOnlyCheckReport({
          phase: 'account-read',
          errorCode: accountReadErrorCode(error),
          revisionMatch,
          archiveMatch
        });
        return;
      }

      let priorRecovery: string | null;
      try {
        priorRecovery = current.storage.getItem(syncCloudRecoveryKey);
      } catch {
        setConflictReadOnlyCheckReport({
          phase: 'recovery-archive',
          errorCode: 'storage-unavailable',
          revisionMatch,
          archiveMatch: 'unavailable'
        });
        return;
      }
      if (priorRecovery === null && currentApi.readRecovery) {
        let remoteRecovery: PreviewAccountRecoveryArchive | null;
        try {
          remoteRecovery = await currentApi.readRecovery(latestCloud.revision);
        } catch (error) {
          setConflictReadOnlyCheckReport({
            phase: 'recovery-archive',
            errorCode: accountReadErrorCode(error),
            revisionMatch,
            archiveMatch: 'unavailable'
          });
          return;
        }
        archiveMatch = compareRemoteAccountRecoveryArchive(
          remoteRecovery,
          latestCloud,
          validated,
          current.currentDate
        );
      } else {
        archiveMatch = compareAccountRecoveryArchive(
          priorRecovery,
          current.accountId,
          latestCloud,
          validated,
          current.currentDate
        );
      }
      setConflictReadOnlyCheckReport({
        phase: 'recovery-archive',
        errorCode: archiveMatch === 'invalid'
          ? 'archive-invalid'
          : archiveMatch === 'mismatch'
            ? 'archive-mismatch'
            : 'none',
        revisionMatch,
        archiveMatch
      });
    } catch {
      setConflictReadOnlyCheckReport({
        phase: 'unexpected',
        errorCode: 'unexpected',
        revisionMatch,
        archiveMatch
      });
    } finally {
      conflictReadOnlyCheckInFlight.current = false;
      setConflictReadOnlyCheckBusy(false);
    }
  }

  async function resolveConflict(choice: 'cloud' | 'device') {
    const pending = conflict;
    const currentApi = latest.current.api;
    if (conflictResolutionInFlight.current
      || conflictReadOnlyCheckInFlight.current
      || manualOperationLocked
      || !pending
      || !currentApi
      || !latest.current.autoSyncEnabled) return;
    let identityCurrent = false;
    try {
      identityCurrent = latest.current.isIdentityCurrent();
    } catch {
      setStatus({
        kind: 'attention',
        message: 'An unexpected error prevented account identity verification. No recovery archive or account write was attempted.'
      });
      return;
    }
    if (!identityCurrent) {
      setConflictState(null);
      setStatus({
        kind: 'attention',
        message: 'The signed-in account changed during conflict review. No recovery archive or account write was attempted; reopen Save & sync for the current account.'
      });
      return;
    }
    conflictResolutionInFlight.current = true;
    setConflictResolutionProgress({ choice, phase: 'checking' });
    setConflictReadOnlyCheckReport(null);
    setManualBusy(true);
    onManualOperationLockChange(true);
    let accountSaveStarted = false;
    let accountSaveConfirmed = false;
    let phase: ConflictResolutionPhase = 'account-read';
    try {
      const latestCloud = await currentApi.read();
      phase = 'identity-check';
      if (!latest.current.isIdentityCurrent()) {
        setConflictState(null);
        setStatus({
          kind: 'attention',
          message: 'The signed-in account changed during conflict review. No recovery archive or account write was attempted; reopen Save & sync for the current account.'
        });
        return;
      }
      phase = 'revision-check';
      if (!latestCloud || latestCloud.revision !== pending.revision) {
        if (latestCloud) {
          phase = 'account-read';
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
          setStatus({
            kind: 'attention',
            message: 'The account copy changed while this conflict was open. The comparison is refreshed; choose again to use the current account revision. No overwrite was attempted.'
          });
        } else {
          setStatus({
            kind: 'attention',
            message: 'The account backup disappeared while this conflict was open. No data was changed; refresh the comparison before choosing again.'
          });
        }
        return;
      }
      phase = 'account-read';
      const validated = validatePreviewAccountBackup(latestCloud, latest.current.currentDate);
      phase = 'device-check';
      const local = readLocalSnapshot(
        latest.current.data,
        latest.current.localRaw,
        latest.current.currentDate
      );
      if (local.raw !== pending.localRaw) {
        setStatus({
          kind: 'attention',
          message: 'This device changed while the conflict was open. No account write was attempted; review the current versions.'
        });
        setConflictState(null);
        controlRef.current?.refresh();
        return;
      }

      if (choice === 'cloud') {
        phase = 'recovery-archive';
        setConflictResolutionProgress({ choice, phase: 'preserving' });
        if (local.raw !== null) {
          const priorDeviceRecovery = readRecoveryArchive(storage, syncDeviceRecoveryKey);
          if (priorDeviceRecovery !== null && priorDeviceRecovery !== local.raw) {
            throw new Error('A different device recovery copy already exists. Download or preserve it before using the account version again.');
          }
          const savedDeviceRecovery = priorDeviceRecovery === null
            ? writeAndVerifyMissingRecoveryArchive(storage, syncDeviceRecoveryKey, local.raw)
            : readRecoveryArchive(storage, syncDeviceRecoveryKey, true);
          if (savedDeviceRecovery === null) throw new RecoveryArchivePersistenceError('archive-readback-missing');
          if (savedDeviceRecovery !== local.raw) throw new RecoveryArchivePersistenceError('archive-readback-mismatch');
          setDeviceRecoveryRaw(savedDeviceRecovery);
        }
        setConflictResolutionProgress({ choice, phase: 'restoring' });
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
        phase = 'recovery-archive';
        setConflictResolutionProgress({ choice, phase: 'preserving' });
        const priorRecovery = readRecoveryArchive(storage, syncCloudRecoveryKey);
        if (priorRecovery !== null) {
          const archiveMatch = compareAccountRecoveryArchive(
            priorRecovery,
            accountId,
            latestCloud,
            validated,
            latest.current.currentDate
          );
          if (archiveMatch === 'invalid') {
            throw new RecoveryArchivePersistenceError('archive-invalid');
          }
          if (archiveMatch !== 'match') {
            throw new Error('A different account recovery copy already exists. It was left unchanged; no account write was attempted.');
          }
        }
        let savedRecovery: string;
        if (priorRecovery !== null) {
          const verifiedRecovery = readRecoveryArchive(storage, syncCloudRecoveryKey, true);
          if (verifiedRecovery === null) {
            throw new RecoveryArchivePersistenceError('archive-readback-missing');
          }
          if (verifiedRecovery !== priorRecovery) {
            throw new RecoveryArchivePersistenceError('archive-readback-mismatch');
          }
          savedRecovery = verifiedRecovery;
        } else if (currentApi.preserveRecovery && currentApi.readRecovery) {
          let archiveWriteFailed = false;
          try {
            await currentApi.preserveRecovery(latestCloud.revision);
          } catch (error) {
            if (error instanceof PreviewAccountBackupError && error.kind === 'stale') throw error;
            archiveWriteFailed = true;
          }
          let remoteRecovery: PreviewAccountRecoveryArchive | null;
          try {
            remoteRecovery = await currentApi.readRecovery(latestCloud.revision);
          } catch {
            throw new RecoveryArchivePersistenceError('account-archive-readback-failed');
          }
          if (remoteRecovery === null) {
            throw new RecoveryArchivePersistenceError(
              archiveWriteFailed
                ? 'account-archive-write-failed'
                : 'account-archive-readback-missing'
            );
          }
          const archiveMatch = compareRemoteAccountRecoveryArchive(
            remoteRecovery,
            latestCloud,
            validated,
            latest.current.currentDate
          );
          if (archiveMatch !== 'match') {
            throw new RecoveryArchivePersistenceError('account-archive-readback-mismatch');
          }
          savedRecovery = serializeRecoveryArchive({
            accountId,
            revision: remoteRecovery.revision,
            document: remoteRecovery.document,
            updatedAt: remoteRecovery.updatedAt,
            preservedAt: remoteRecovery.preservedAt
          });
        } else {
          const cloudRecovery = {
            accountId,
            revision: latestCloud.revision,
            document: latestCloud.document,
            updatedAt: latestCloud.updatedAt,
            preservedAt: new Date().toISOString()
          };
          const recoveryRaw = serializeRecoveryArchive(cloudRecovery);
          try {
            savedRecovery = writeAndVerifyMissingRecoveryArchive(storage, syncCloudRecoveryKey, recoveryRaw);
          } catch (error) {
            if (error instanceof RecoveryArchivePersistenceError) throw error;
            throw new RecoveryArchivePersistenceError('account-archive-write-failed');
          }
        }
        if (!latest.current.isIdentityCurrent()) {
          setStatus({
            kind: 'attention',
            message: 'The signed-in account changed during recovery preservation. The archive was kept, but no account replacement was attempted.'
          });
          return;
        }
        const latestLocal = readLocalSnapshot(
          latest.current.data,
          latest.current.localRaw,
          latest.current.currentDate
        );
        if (latestLocal.raw !== pending.localRaw) {
          setStatus({
            kind: 'attention',
            message: 'This device changed while its recovery copy was being preserved. The account was not replaced; review the current versions.'
          });
          setConflictState(null);
          controlRef.current?.refresh();
          return;
        }
        setCloudRecoveryRaw(savedRecovery);
        setConflictResolutionProgress({ choice, phase: 'saving' });
        phase = 'account-save';
        accountSaveStarted = true;
        let savedRevision: number;
        let savedAt: string | null;
        try {
          savedRevision = await currentApi.save(local.envelope, latestCloud.revision);
          accountSaveConfirmed = true;
          savedAt = new Date().toISOString();
        } catch {
          setConflictResolutionProgress({ choice, phase: 'verifying' });
          phase = 'save-verification';
          let observed: PreviewAccountBackupRecord | null;
          try {
            observed = await currentApi.read();
          } catch {
            throw new Error('The account save may have completed, but its result could not be confirmed. Check the account status before retrying; no automatic retry was made.');
          }
          if (!latest.current.isIdentityCurrent()) return;
          if (observed) {
            const observedValidated = validatePreviewAccountBackup(observed, latest.current.currentDate);
            if (previewEnvelopesEqual(observedValidated.envelope, local.envelope)) {
              accountSaveConfirmed = true;
              savedRevision = observed.revision;
              savedAt = observed.updatedAt;
            } else {
              setConflictState({
                localRaw: local.raw,
                localEnvelope: local.envelope,
                cloud: observedValidated,
                revision: observed.revision,
                updatedAt: observed.updatedAt
              });
              setStatus({
                kind: 'attention',
                message: 'The account now has a different copy. No overwrite was forced; review the updated conflict.'
              });
              return;
            }
          } else {
            throw new Error('The account save may have completed, but no account copy was available to confirm it. Check the account status before retrying; no automatic retry was made.');
          }
        }
        phase = 'identity-check';
        if (!latest.current.isIdentityCurrent()) return;
        phase = 'post-save-bookkeeping';
        const guardError = resolvePendingImportGuard(storage);
        if (guardError) throw new Error(guardError);
        saveMetadata(storage, {
          accountId,
          revision: savedRevision,
          syncedEnvelope: local.envelope,
          syncedAt: savedAt
        });
        setConflictState(null);
        setStatus({ kind: 'account', savedAt });
        setSyncMessage('This device’s data is now saved to your account. The previous account version is recoverable.');
      }
    } catch (error) {
      if (phase === 'recovery-archive'
        && error instanceof PreviewAccountBackupError
        && error.kind === 'stale') {
        try {
          const refreshedCloud = await currentApi.read();
          if (!latest.current.isIdentityCurrent()) {
            setConflictState(null);
            setStatus({
              kind: 'attention',
              message: 'The signed-in account changed during recovery preservation. No account replacement was attempted; any recovery archive remains available.'
            });
            return;
          }
          if (refreshedCloud && refreshedCloud.revision !== pending.revision) {
            const refreshed = validatePreviewAccountBackup(refreshedCloud, latest.current.currentDate);
            const refreshedLocal = readLocalSnapshot(
              latest.current.data,
              latest.current.localRaw,
              latest.current.currentDate
            );
            setConflictState({
              localRaw: refreshedLocal.raw,
              localEnvelope: refreshedLocal.envelope,
              cloud: refreshed,
              revision: refreshedCloud.revision,
              updatedAt: refreshedCloud.updatedAt
            });
            setStatus({
              kind: 'attention',
              message: 'The account copy changed while its recovery archive was being created. The comparison is refreshed; choose again against the current revision. No replacement was attempted.'
            });
            return;
          }
          if (!refreshedCloud) {
            setStatus({
              kind: 'attention',
              message: 'The account backup disappeared during recovery preservation. No replacement was attempted; refresh the comparison before choosing again.'
            });
            return;
          }
        } catch {
          setStatus({
            kind: 'attention',
            message: 'The account revision changed during recovery preservation, but the latest copy could not be refreshed. No replacement was attempted; any recovery archive remains available.'
          });
          return;
        }
      }
      setStatus({
        kind: 'attention',
        message: conflictResolutionFailureMessage(error, phase, accountSaveStarted, accountSaveConfirmed)
      });
    } finally {
      conflictResolutionInFlight.current = false;
      setConflictResolutionProgress(null);
      setManualBusy(false);
      skipNextManualUnlockRefresh.current = true;
      onManualOperationLockChange(false);
    }
  }

  if (!visible || !portalTarget) return null;

  const statusText = !api
    ? 'Needs attention'
    : localSaveStatus === 'saving' || status.kind === 'saving'
      ? 'Saving…'
      : !localSaveConfirmed
      ? 'Needs attention'
      : !autoSyncEnabled || status.kind === 'checking'
        ? 'Saved on this device'
        : status.kind === 'device' || status.kind === 'pending'
          ? 'Saved on this device'
          : status.kind === 'account'
            ? 'Saved to your account'
            : status.kind === 'offline'
              ? 'Saved on this device — waiting for connection'
              : 'Needs attention';
  const formattedSavedAt = status.kind === 'account' ? formatTime(status.savedAt) : null;
  const fullSavedAt = status.kind === 'account' && status.savedAt
    ? new Date(status.savedAt).toLocaleString()
    : null;
  const statusDescription = !api
    ? 'Account saving is unavailable. Check your connection or account setup.'
    : localSaveStatus === 'saving'
      ? 'Saving your changes on this device.'
    : !localSaveConfirmed
      ? 'Your latest changes are not confirmed saved on this device.'
      : !autoSyncEnabled
        ? 'Automatic account sync is off.'
        : status.kind === 'checking'
          ? 'Checking this device against your account.'
          : status.kind === 'device'
            ? 'An account copy has not been confirmed for this device yet.'
            : status.kind === 'pending'
              ? 'Waiting to sync.'
              : status.kind === 'offline'
                ? 'Your saved data will sync when a connection is available.'
                : status.kind === 'saving'
                  ? 'Saving your changes to your account.'
                  : status.kind === 'account'
                    ? 'Your latest changes were confirmed in your account.'
                    : status.kind === 'conflict'
                      ? 'Your device and account copies differ. Choose which copy to keep.'
                      : status.kind === 'attention'
                        ? syncAttentionSummary(status.message)
                        : '';

  return (
    <>
      {createPortal((
        <section className="settings-section preview-account-sync" aria-labelledby="preview-account-sync-title">
          <h3 id="preview-account-sync-title">Save &amp; sync</h3>
          <div className={`preview-account-sync__status-row preview-account-sync__status-row--${status.kind}`}>
            <span className="preview-account-sync__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M7.3 18.2h10.1a4.1 4.1 0 0 0 .4-8.2A6.2 6.2 0 0 0 6 8.5a4.9 4.9 0 0 0 1.3 9.7Z" />
                {status.kind === 'account'
                  ? <path d="m9.2 13.1 2.1 2.1 4.2-4.4" />
                  : status.kind === 'attention' || status.kind === 'conflict'
                    ? <path d="M12 9v4m0 2h.01" />
                    : <path d="M12 8.5v4l2.4 1.4" />}
              </svg>
            </span>
            <div className="preview-account-sync__status-copy">
              <p className="preview-account-sync__status" role="status">{statusText}</p>
              <p className="preview-account-sync__description">{statusDescription}</p>
              {formattedSavedAt && status.kind === 'account' && (
                <p className="preview-account-sync__saved-at">
                  <time dateTime={status.savedAt ?? undefined}
                    aria-label={fullSavedAt ? `Last confirmed account sync: ${fullSavedAt}` : undefined}
                    title={fullSavedAt ?? undefined}>
                    Last synced {formattedSavedAt}
                  </time>
                </p>
              )}
            </div>
            {status.kind === 'attention' && api && autoSyncEnabled && localSaveConfirmed && !conflict && (
              <button
                type="button"
                className="btn mini ghost preview-account-sync__retry"
                disabled={manualBusy || manualOperationLocked}
                onClick={() => {
                  setStatus({ kind: 'checking' });
                  controlRef.current?.refresh();
                }}
              >
                Try again
              </button>
            )}
          </div>
          {!localSaveConfirmed && (
            <button
              type="button"
              className="btn mini ghost preview-account-sync__retry"
              disabled={localSaveStatus === 'saving' || manualBusy}
              onClick={onRetryLocalSave}
            >
              Try saving again
            </button>
          )}
          {(status.kind === 'attention' || !localSaveConfirmed) && (
            <details className="preview-account-backup__technical">
              <summary>Technical details</summary>
              {status.kind === 'attention' && <p role="alert">{status.message}</p>}
              {!localSaveConfirmed && restoreFailure && <p role="alert">{restoreFailure}</p>}
              {!localSaveConfirmed && !manualBusy && !restoreFailure && localSaveError
                && <p role="alert">{localSaveError}</p>}
              <p>Account identity: {accountId.slice(-4)}.</p>
            </details>
          )}
          {syncMessage && status.kind !== 'attention' && status.kind !== 'conflict' && (
            <p className="preview-account-sync__message" role="status">{syncMessage}</p>
          )}
          {conflict && (
            <div
              className="preview-account-sync__conflict"
              role="group"
              aria-busy={conflictResolutionProgress !== null || conflictReadOnlyCheckBusy}
              aria-labelledby="preview-account-sync-conflict-title"
            >
              <h4 id="preview-account-sync-conflict-title">This device and your account have different copies</h4>
              <p>
                Automatic sync paused. Choose one version to keep; the other is preserved as a recovery copy. Tend will not merge these changes.
              </p>
              <p>
                <strong>Keep this device’s copy:</strong> save this device’s data to the account and preserve the current account copy.
              </p>
              <p>
                <strong>Use the account copy:</strong> replace this device’s data with the account version and preserve the current device copy.
              </p>
              {formatTime(conflict.updatedAt) && <p>Account copy updated: {formatTime(conflict.updatedAt)}.</p>}
              {conflictResolutionProgress && (
                <p className="preview-account-sync__message" role="status">
                  {conflictProgressMessage(conflictResolutionProgress)}
                </p>
              )}
              {conflictReadOnlyCheckBusy && (
                <p className="preview-account-sync__message" role="status">
                  Checking the current account revision and recovery archive (read-only)…
                </p>
              )}
              {conflictReadOnlyCheckReport && (
                <p className="preview-account-sync__message" role="status">
                  {conflictReadOnlyCheckMessage(conflictReadOnlyCheckReport)}
                </p>
              )}
              <div className="preview-account-sync__actions">
                <button
                  type="button"
                  className="btn mini"
                  disabled={manualBusy || manualOperationLocked || conflictReadOnlyCheckBusy}
                  onClick={() => void resolveConflict('device')}
                >
                  {conflictResolutionProgress?.choice === 'device'
                    ? conflictResolutionProgress.phase === 'verifying' ? 'Confirming save…' : 'Working…'
                    : 'Keep this device’s copy'}
                </button>
                <button
                  type="button"
                  className="btn mini ghost"
                  disabled={manualBusy || manualOperationLocked || conflictReadOnlyCheckBusy}
                  onClick={() => void resolveConflict('cloud')}
                >
                  {conflictResolutionProgress?.choice === 'cloud' ? 'Applying…' : 'Use the account copy'}
                </button>
                <button
                  type="button"
                  className="btn mini ghost"
                  disabled={manualBusy || manualOperationLocked || conflictReadOnlyCheckBusy}
                  onClick={() => void checkConflictReadOnly()}
                >
                  {conflictReadOnlyCheckBusy ? 'Checking…' : 'Check conflict state (read-only)'}
                </button>
              </div>
            </div>
          )}
          {email && (
            <div className="preview-account-sync__account">
              <span>Account</span>
              <span>{email}</span>
            </div>
          )}
          <button type="button" className="settings-link preview-account-sync__recovery-link" onClick={onOpenRecovery}>
            <span>Backup &amp; recovery</span>
            <span aria-hidden="true">›</span>
          </button>
        </section>
      ), portalTarget)}
      {recoveryPortalTarget && createPortal((
        <section className="settings-section preview-account-recovery" aria-label="Account recovery tools">
          {children}
          <details className="preview-account-backup__technical">
            <summary>Advanced recovery</summary>
            <PreviewAccountBackupControls
              api={api}
              accountId={accountId}
              storage={storage}
              data={data}
              currentDate={currentDate}
              localRaw={localRaw}
              importRecoveryRaw={importRecoveryRaw}
              importRecoverySourceRaw={importRecoverySourceRaw}
              importRecoveryArchiveRaw={importRecoveryArchiveRaw}
              importRecoveryError={importRecoveryError}
              localRecoveryRaw={localRecoveryRaw}
              localRecoveryError={localRecoveryError}
              repairRecoveryRaw={repairRecoveryRaw}
              repairRecoveryError={repairRecoveryError}
              cloudRecoveryRaw={cloudRecoveryRaw}
              cloudRecoveryError={cloudRecoveryError}
              deviceRecoveryRaw={deviceRecoveryRaw}
              deviceRecoveryError={deviceRecoveryError}
              autoSyncEnabled={autoSyncEnabled}
              restoreInvalidDeviceAvailable={
                !localSaveConfirmed
                && localRaw !== null
                && (localSaveStatus === 'corrupt' || localSaveStatus === 'unsupported')
              }
              enabled={enabled && !manualBusy && (!autoSyncEnabled || (status.kind !== 'saving' && status.kind !== 'checking'))}
              localSaveConfirmed={localSaveConfirmed}
              localSavePending={localSaveStatus === 'loading' || localSaveStatus === 'saving'}
              recoveryOperationLocked={manualBusy || manualOperationLocked}
              syncBusy={autoSyncEnabled && (status.kind === 'saving' || status.kind === 'checking')}
              syncStatus={status.kind}
              verifiedAccountStatus={verifiedAccountStatus?.accountId === accountId
                ? verifiedAccountStatus.status
                : null}
              isIdentityCurrent={isIdentityCurrent}
              onRestore={onRestore}
              onRestoreFailure={setRestoreFailure}
              onRepair={onRepair}
              onRepairRecoveryChanged={onRepairRecoveryChanged}
              {...(onRecoveryArchiveChanged ? { onRecoveryArchiveChanged } : {})}
              onRecoveryChanged={() => {}}
              onExclusiveChange={locked => {
                setManualBusy(locked);
                onManualOperationLockChange(locked);
              }}
              onOperationFinished={() => controlRef.current?.refresh()}
            />
          </details>
        </section>
      ), recoveryPortalTarget)}
    </>
  );
}
